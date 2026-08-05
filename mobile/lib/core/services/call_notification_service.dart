import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_callkit_incoming/flutter_callkit_incoming.dart';
import 'package:flutter_callkit_incoming/entities/entities.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../screens/call/incoming_call_page.dart';
import '../../screens/call/video_call_page.dart';
import '../../main.dart' show navigatorKey;
import 'call_service.dart';

/// Shows a full-screen, high-priority "incoming call" notification with
/// Accept/Decline actions — this is what fires when a call arrives while
/// the app is backgrounded, the screen is locked, or another app is open.
/// Separate from NotificationService (which handles plain booking alerts)
/// because calls need a distinct channel: max importance, full-screen intent,
/// action buttons, and no auto-dismiss.
class CallNotificationService {
  static final CallNotificationService _instance = CallNotificationService._internal();
  factory CallNotificationService() => _instance;
  CallNotificationService._internal();

  static const String _channelId = 'incoming_calls';
  static const String _channelName = 'Incoming Calls';
  static const String _channelDesc = 'Full-screen alerts for incoming trainer calls';
  static const int _notificationId = 9911;

  bool _isInitialized = false;

  // Watches call_sessions for a specific ringing call, independent of
  // whether any UI page is open, so CallKit auto-dismisses the instant the
  // other side hangs up/declines/times out — not just when our own page
  // happens to be listening.
  static final Map<String, RealtimeChannel> _dismissWatchers = {};

  static void _watchForRemoteEnd(String callId) {
    final client = Supabase.instance.client;
    final channel = client.channel('callkit_dismiss_$callId');
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
        final status = payload.newRecord['status'] as String?;
        debugPrint('[CallNotificationService] Remote watcher | status=$status');
        if (status == 'ended' || status == 'missed' || status == 'declined') {
          FlutterCallkitIncoming.endCall(callId);
          _stopWatching(callId);
        }
      },
    );
    channel.subscribe();
    _dismissWatchers[callId] = channel;
  }

  static void _stopWatching(String callId) {
    _dismissWatchers[callId]?.unsubscribe();
    _dismissWatchers.remove(callId);
  }

  Future<void> init() async {
    if (_isInitialized) return;
    // CallKit needs no separate init call on Android — showCallkitIncoming
    // creates its own channel/PhoneAccount on first use.
    _isInitialized = true;
    debugPrint('[CallNotificationService] Initialized');
  }

  /// Called from the FCM background handler and foreground onMessage listener.
  /// Shows the native CallKit-style incoming call screen — this works even
  /// when the app is fully killed, unlike a plain local notification.
  Future<void> showIncomingCall({
    required String callId,
    required String channelName,
    required String callerName,
    String? callerImageUrl,
  }) async {
    if (!_isInitialized) await init();

    final params = CallKitParams(
      id: callId,
      nameCaller: callerName,
      appName: 'GetFit',
      avatar: callerImageUrl,
      handle: callerName,
      type: 1, // 1 = video call
      duration: 45000,
      textAccept: 'Accept',
      textDecline: 'Decline',
      missedCallNotification: NotificationParams(
        showNotification: true,
        isShowCallback: true,
        subtitle: 'Missed call from $callerName',
        callbackText: 'Call Back',
      ),
      extra: <String, dynamic>{
        'call_id': callId,
        'channel_name': channelName,
        'caller_name': callerName,
        'caller_image_url': callerImageUrl,
      },
      android: const AndroidParams(
        isCustomNotification: true,
        isShowLogo: false,
        ringtonePath: 'system_ringtone_default',
        backgroundColor: '#000000',
        actionColor: '#D2F556',
        incomingCallNotificationChannelName: 'Incoming Calls',
        missedCallNotificationChannelName: 'Missed Calls',
      ),
    );

    await FlutterCallkitIncoming.showCallkitIncoming(params);
    debugPrint('[CallNotificationService] Shown CallKit incoming call for $callerName');
    _watchForRemoteEnd(callId);
  }

  Future<void> cancelIncomingCall(String callId) async {
    await FlutterCallkitIncoming.endCall(callId);
  }

  /// Handles CallKit accept/decline events. Call this once from main.dart's
  /// FlutterCallkitIncoming.onEvent.listen(...).
  static void handleCallEvent(CallEvent? event) {
    if (event == null) return;
    final body = event.body as Map<Object?, Object?>?;
    final extra = body?['extra'] as Map<Object?, Object?>?;
    if (extra == null) return;

    final callId = extra['call_id'] as String?;
    final channelName = extra['channel_name'] as String?;
    final callerName = extra['caller_name'] as String? ?? 'Someone';
    if (callId == null || channelName == null) return;

    debugPrint('[CallNotificationService] CallKit event: ${event.event}');

    switch (event.event) {
      case Event.actionCallAccept:
        // CallKit's own Accept button IS the accept decision — go straight
        // into the call instead of showing a second Accept/Decline screen.
        _stopWatching(callId);
        CallService().updateStatus(callId, 'accepted').then((_) {
          navigatorKey.currentState?.push(
            MaterialPageRoute(
              builder: (_) => VideoCallPage(
                callId: callId,
                channelName: channelName,
                remoteName: callerName,
              ),
            ),
          );
        });
        break;
      case Event.actionCallDecline:
        _stopWatching(callId);
        _declineCallback?.call(callId);
        FlutterCallkitIncoming.endCall(callId);
        break;
      case Event.actionCallEnded:
        // Caller cancelled/hung up while still ringing, or the call ended
        // normally — clear any lingering call UI/banner.
        _stopWatching(callId);
        FlutterCallkitIncoming.endCall(callId);
        break;
      case Event.actionCallTimeout:
        _stopWatching(callId);
        // Don't call endCall here — the plugin already shows its own
        // missed-call notification the moment duration expires, and
        // calling endCall right after can dismiss that notification.
        debugPrint('[CallNotificationService] Call timed out — missed call notification shown by plugin');
        break;
      default:
        break;
    }
  }

  /// Set from main.dart so a background "Decline" tap can update call_sessions
  /// status without needing to open the app UI.
  static void Function(String callId)? _declineCallback;
  static void setDeclineCallback(void Function(String callId) callback) {
    _declineCallback = callback;
  }
}