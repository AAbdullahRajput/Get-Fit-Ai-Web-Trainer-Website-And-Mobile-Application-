import 'package:flutter/foundation.dart';
import 'supabase_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Handles the "signaling" side of a call — creating the call_sessions row,
/// listening for status changes via Supabase Realtime, and updating status.
/// This is deliberately separate from AgoraService: this class only ever
/// talks to Postgres/Realtime, never to the video engine itself.
class CallService {
  static final CallService _instance = CallService._internal();
  factory CallService() => _instance;
  CallService._internal();

  RealtimeChannel? _channel;
  String? _activeCallId;
  RealtimeChannel? _incomingChannel;

  void Function(Map<String, dynamic> session)? onSessionUpdate;

  /// Global listener — call once per login session. Fires [onIncomingCall]
  /// whenever a new 'ringing' call_sessions row targets this trainer.
  void listenForIncomingCalls(
    String trainerId,
    void Function(Map<String, dynamic> call) onIncomingCall,
  ) {
    debugPrint('\x1B[35m[CALL] Listening for incoming calls | trainerId=$trainerId\x1B[0m');
    _incomingChannel?.unsubscribe();

    final supabase = SupabaseService();
    final channel = supabase.client.channel('incoming_calls_$trainerId');
    
    channel.onPostgresChanges(
      event: PostgresChangeEvent.insert,
      schema: 'public',
      table: 'call_sessions',
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'trainer_id',
        value: trainerId,
      ),
      callback: (payload) {
        final newRecord = Map<String, dynamic>.from(payload.newRecord);
        final initiatedBy = newRecord['initiated_by'] as String? ?? '';
        debugPrint('\x1B[35m[CALL] Incoming insert | status=${newRecord['status']} | by=$initiatedBy | trainer_id=${newRecord['trainer_id']} | user_id=${newRecord['user_id']} | caller_user_id=${newRecord['caller_user_id']} | ALL=${newRecord}\x1B[0m');
        if (newRecord['status'] == 'ringing' && initiatedBy == 'user') {
          onIncomingCall(newRecord);
        }
      },
    );

    channel.onPostgresChanges(
      event: PostgresChangeEvent.update,
      schema: 'public',
      table: 'call_sessions',
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'trainer_id',
        value: trainerId,
      ),
      callback: (payload) {
  final newRecord = Map<String, dynamic>.from(payload.newRecord);
  final initiatedBy = newRecord['initiated_by'] as String? ?? '';
  debugPrint('\x1B[35m[CALL] Incoming update | status=${newRecord['status']} | by=$initiatedBy | trainer_id=${newRecord['trainer_id']} | user_id=${newRecord['user_id']} | caller_user_id=${newRecord['caller_user_id']} | ALL=${newRecord}\x1B[0m');
  debugPrint('\x1B[35m[CALL] UPDATE check | initiatedBy=$initiatedBy | status=${newRecord['status']}\x1B[0m');
  if (newRecord['status'] == 'ringing' && initiatedBy == 'user') {
    onIncomingCall(newRecord);
  }
},
    );
    
    channel.subscribe();
    _incomingChannel = channel;
  }

  void stopListeningForIncomingCalls() {
    _incomingChannel?.unsubscribe();
    _incomingChannel = null;
  }

  /// Called by the trainer to start a new call to a user.
  /// Creates the call_sessions row with status='calling', then flips to
  /// 'ringing' once inserted (so listeners know the row is live).
  Future<Map<String, dynamic>?> startCall({
    required String trainerId,
    required String userId,
    String? appointmentId,
  }) async {
    try {
      final supabase = SupabaseService();
      final channelName = 'call_${DateTime.now().millisecondsSinceEpoch}_$trainerId';

      debugPrint('\x1B[33m[CALL] Creating call session | trainer=$trainerId user=$userId channel=$channelName\x1B[0m');

      final result = await supabase.client
          .from('call_sessions')
          .insert({
            'trainer_id': trainerId,
            'user_id': userId,
            'appointment_id': appointmentId,
            'caller_user_id': trainerId,
            'channel_name': channelName,
            'initiated_by': 'trainer',
            'status': 'calling',
          })
          .select()
          .single();

      _activeCallId = result['id'] as String;
      debugPrint('\x1B[32m[CALL] Session created | id=$_activeCallId\x1B[0m');

      // Immediately flip to 'ringing' — this is the signal the user's
      // mobile app listens for to show the incoming-call UI.
      await updateStatus(_activeCallId!, 'ringing');
      debugPrint('\x1B[32m[CALL] startCall complete | initiated_by=trainer | status=ringing | id=$_activeCallId\x1B[0m');

      return Map<String, dynamic>.from(result);
    } catch (e) {
      debugPrint('\x1B[31m[CALL] ERROR | startCall | $e\x1B[0m');
      return null;
    }
  }

  /// Subscribes to realtime updates for a specific call session row.
  /// Both caller and receiver use this to react to status changes
  /// (accepted, declined, ended) without polling.
  void listenToCall(String callId) {
    debugPrint('\x1B[35m[CALL] Listening to call_sessions | id=$callId\x1B[0m');
    _channel?.unsubscribe();

    final supabase = SupabaseService();
    final channel = supabase.client.channel('call_session_$callId');
    
    channel.onPostgresChanges(
      event: PostgresChangeEvent.update,
      schema: 'public',
      table: 'call_sessions',
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'id',
        value: callId,
      ),
      callback: (payload) {
        final newRecord = Map<String, dynamic>.from(payload.newRecord);
        debugPrint('\x1B[35m[CALL] Realtime update | status=${newRecord['status']}\x1B[0m');
        onSessionUpdate?.call(newRecord);
      },
    );
    
    channel.subscribe();
    _channel = channel;
  }

  Future<bool> updateStatus(String callId, String status) async {
    try {
      debugPrint('\x1B[33m[CALL] Updating status | id=$callId -> $status\x1B[0m');
      final data = <String, dynamic>{'status': status};
      if (status == 'accepted') {
        data['connected_at'] = DateTime.now().toIso8601String();
      }
      if (status == 'ended' || status == 'declined' || status == 'missed') {
        data['ended_at'] = DateTime.now().toIso8601String();
      }
      final supabase = SupabaseService();
      await supabase.client
          .from('call_sessions')
          .update(data)
          .eq('id', callId);
      debugPrint('\x1B[32m[CALL] Status updated -> $status\x1B[0m');
      return true;
    } catch (e) {
      debugPrint('\x1B[31m[CALL] ERROR | updateStatus | $e\x1B[0m');
      return false;
    }
  }

  /// Ends the call and records the duration if it was ever connected.
  Future<void> endCall(String callId, {DateTime? connectedAt}) async {
    try {
      int? durationSeconds;
      if (connectedAt != null) {
        durationSeconds = DateTime.now().difference(connectedAt).inSeconds;
      }
      debugPrint('\x1B[33m[CALL] Ending call | id=$callId duration=${durationSeconds}s\x1B[0m');
      final supabase = SupabaseService();
      await supabase.client.from('call_sessions').update({
        'status': 'ended',
        'ended_at': DateTime.now().toIso8601String(),
        if (durationSeconds != null) 'duration_seconds': durationSeconds,
      }).eq('id', callId);
      debugPrint('\x1B[32m[CALL] Call ended and logged\x1B[0m');
    } catch (e) {
      debugPrint('\x1B[31m[CALL] ERROR | endCall | $e\x1B[0m');
    }
  }

  void stopListening() {
    debugPrint('\x1B[33m[CALL] Stopping realtime listener\x1B[0m');
    _channel?.unsubscribe();
    _channel = null;
    _activeCallId = null;
  }
}