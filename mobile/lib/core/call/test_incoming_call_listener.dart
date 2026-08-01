import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:mobile/core/services/supabase_service.dart';
import 'package:mobile/core/call/call_widgets.dart';
import 'package:mobile/screens/call/incoming_call_page.dart';

/// TEMPORARY testing helper — simulates what the React trainer dashboard
/// will eventually do: listen for new incoming calls for a given trainer
/// and pop up the incoming-call screen.
///
/// Wrap this around any page (e.g. HomePage) on your SECOND test device,
/// logged in as a different test account, and pass in the trainer id you
/// want that device to "answer calls for". Remove this once the real
/// React dashboard handles incoming calls instead.
class TestIncomingCallListener extends StatefulWidget {
  final String trainerId;
  final Widget child;

  const TestIncomingCallListener({
    super.key,
    required this.trainerId,
    required this.child,
  });

  @override
  State<TestIncomingCallListener> createState() =>
      _TestIncomingCallListenerState();
}

class _TestIncomingCallListenerState extends State<TestIncomingCallListener> {
  RealtimeChannel? _channel;
  final Set<String> _handledCallIds = {};

  @override
  void initState() {
    super.initState();
    debugPrint(
        '\x1B[36m[TEST-LISTENER] Listening for incoming calls | trainerId=${widget.trainerId}\x1B[0m');
    _subscribe();
  }

  void _subscribe() {
    final supabase = Supabase.instance.client;
    final channel = supabase.channel('trainer_incoming_calls_${widget.trainerId}');
    
    channel.onPostgresChanges(
      event: PostgresChangeEvent.insert,
      schema: 'public',
      table: 'call_sessions',
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'trainer_id',
        value: widget.trainerId,
      ),
      callback: (payload) {
        final record = Map<String, dynamic>.from(payload.newRecord);
        _handleNewCall(record);
      },
    );
    
    // Also listen for UPDATE in case status flips to 'ringing' right after
    // insert (matches how CallService.startCall works).
    channel.onPostgresChanges(
      event: PostgresChangeEvent.update,
      schema: 'public',
      table: 'call_sessions',
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'trainer_id',
        value: widget.trainerId,
      ),
      callback: (payload) {
        final record = Map<String, dynamic>.from(payload.newRecord);
        if (record['status'] == 'ringing') {
          _handleNewCall(record);
        }
      },
    );
    
    channel.subscribe();
    _channel = channel;
  }

  Future<void> _handleNewCall(Map<String, dynamic> record) async {
    final callId = record['id'] as String;
    final status = record['status'] as String?;
    if (status != 'ringing' && status != 'calling') return;
    if (_handledCallIds.contains(callId)) return;
    _handledCallIds.add(callId);

    debugPrint('\x1B[32m[TEST-LISTENER] Incoming call detected | id=$callId\x1B[0m');

    final callerUserId = record['caller_user_id'] as String;
    // Fetch the caller's name for display — since this is test-only,
    // a plain lookup against users table is fine here.
    String callerName = 'Someone';
    String? callerImage;
    try {
      final supabase = Supabase.instance.client;
      final caller = await supabase
          .from('users')
          .select('username, avatar_url')
          .eq('id', callerUserId)
          .maybeSingle();
      callerName = caller?['username'] as String? ?? 'Someone';
      callerImage = caller?['avatar_url'] as String?;
    } catch (e) {
      debugPrint('\x1B[31m[TEST-LISTENER] ERROR fetching caller info | $e\x1B[0m');
    }

    if (!mounted) return;
    Navigator.of(context, rootNavigator: true).push(
      MaterialPageRoute(
        builder: (_) => IncomingCallPage(
          callId: callId,
          channelName: record['channel_name'] as String,
          callerName: callerName,
          callerImageUrl: callerImage,
        ),
      ),
    );
  }

  @override
  void dispose() {
    if (_channel != null) {
      Supabase.instance.client.removeChannel(_channel!);
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}