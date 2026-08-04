import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../../screens/call/incoming_call_page.dart';
import '../../main.dart' show navigatorKey;

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

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  bool _isInitialized = false;

  Future<void> init() async {
    if (_isInitialized) return;

    const AndroidInitializationSettings androidSettings =
        AndroidInitializationSettings('@mipmap/launcher_icon');
    const DarwinInitializationSettings iosSettings = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    const InitializationSettings settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    try {
      await _plugin.initialize(
        settings,
        onDidReceiveNotificationResponse: _onNotificationResponse,
        onDidReceiveBackgroundNotificationResponse: _onBackgroundNotificationResponse,
      );

      const AndroidNotificationChannel channel = AndroidNotificationChannel(
        _channelId,
        _channelName,
        description: _channelDesc,
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
      );

      final AndroidFlutterLocalNotificationsPlugin? androidPlugin =
          _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      if (androidPlugin != null) {
        await androidPlugin.createNotificationChannel(channel);
      }

      _isInitialized = true;
      debugPrint('[CallNotificationService] Initialized');
    } catch (e) {
      debugPrint('[CallNotificationService] Init error: $e');
    }
  }

  /// Called from the FCM background handler and foreground onMessage listener.
  Future<void> showIncomingCall({
    required String callId,
    required String channelName,
    required String callerName,
    String? callerImageUrl,
  }) async {
    if (!_isInitialized) await init();

    final payload = jsonEncode({
      'call_id': callId,
      'channel_name': channelName,
      'caller_name': callerName,
      'caller_image_url': callerImageUrl,
    });

    final androidDetails = AndroidNotificationDetails(
      _channelId,
      _channelName,
      channelDescription: _channelDesc,
      importance: Importance.max,
      priority: Priority.high,
      category: AndroidNotificationCategory.call,
      fullScreenIntent: true,
      ongoing: true,
      autoCancel: false,
      playSound: true,
      enableVibration: true,
      visibility: NotificationVisibility.public,
      actions: const [
        AndroidNotificationAction(
          'accept_call',
          'Accept',
          showsUserInterface: true,
          cancelNotification: true,
        ),
        AndroidNotificationAction(
          'decline_call',
          'Decline',
          cancelNotification: true,
        ),
      ],
    );

    const darwinDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
      interruptionLevel: InterruptionLevel.timeSensitive,
    );

    final details = NotificationDetails(android: androidDetails, iOS: darwinDetails);

    await _plugin.show(
      _notificationId,
      'Incoming call',
      '$callerName is calling you',
      details,
      payload: payload,
    );
    debugPrint('[CallNotificationService] Shown incoming call notification for $callerName');
  }

  Future<void> cancelIncomingCall() async {
    await _plugin.cancel(_notificationId);
  }

  static void _onNotificationResponse(NotificationResponse response) {
    _handleResponse(response);
  }

  @pragma('vm:entry-point')
  static void _onBackgroundNotificationResponse(NotificationResponse response) {
    _handleResponse(response);
  }

  static void _handleResponse(NotificationResponse response) {
    if (response.payload == null) return;
    final data = jsonDecode(response.payload!) as Map<String, dynamic>;
    final callId = data['call_id'] as String;
    final channelName = data['channel_name'] as String;
    final callerName = data['caller_name'] as String? ?? 'Someone';
    final callerImageUrl = data['caller_image_url'] as String?;

    debugPrint('[CallNotificationService] Action tapped: ${response.actionId ?? "notification body"}');

    if (response.actionId == 'decline_call') {
      // Decline path handled by IncomingCallPage normally requires the UI;
      // for a pure background decline we do a lightweight status update
      // via CallService, wired in main.dart's callback.
      _declineCallback?.call(callId);
      return;
    }

    // Accept, or a tap on the notification body — both open the call screen.
    navigatorKey.currentState?.push(
      MaterialPageRoute(
        builder: (_) => IncomingCallPage(
          callId: callId,
          channelName: channelName,
          callerName: callerName,
          callerImageUrl: callerImageUrl,
        ),
      ),
    );
  }

  /// Set from main.dart so a background "Decline" tap can update call_sessions
  /// status without needing to open the app UI.
  static void Function(String callId)? _declineCallback;
  static void setDeclineCallback(void Function(String callId) callback) {
    _declineCallback = callback;
  }
}