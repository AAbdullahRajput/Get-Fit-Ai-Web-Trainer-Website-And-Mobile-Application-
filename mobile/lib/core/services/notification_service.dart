import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _localNotificationsPlugin =
      FlutterLocalNotificationsPlugin();

  static const String _channelId = 'booking_alerts';
  static const String _channelName = 'Booking Alerts';
  static const String _channelDesc = 'Notifications for new trainer appointments';

  bool _isInitialized = false;

  /// Initialize local notifications
  Future<void> init() async {
    if (_isInitialized) return;

    // Android settings - use the launcher icon
    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/launcher_icon');

    // iOS/macOS settings
    const DarwinInitializationSettings initializationSettingsDarwin =
        DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );

    const InitializationSettings initializationSettings = InitializationSettings(
      android: initializationSettingsAndroid,
      iOS: initializationSettingsDarwin,
    );

    try {
      await _localNotificationsPlugin.initialize(
        initializationSettings,
      );
      
      // Create Android Notification Channel
      const AndroidNotificationChannel channel = AndroidNotificationChannel(
        _channelId,
        _channelName,
        description: _channelDesc,
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
      );

      final AndroidFlutterLocalNotificationsPlugin? androidPlugin =
          _localNotificationsPlugin.resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();

      if (androidPlugin != null) {
        await androidPlugin.createNotificationChannel(channel);
      }

      _isInitialized = true;
      debugPrint('[NotificationService] Initialized successfully');
    } catch (e) {
      debugPrint('[NotificationService] Initialization error: $e');
    }
  }

  /// Request notification permissions (particularly Android 13+ and iOS)
  Future<void> requestPermissions() async {
    try {
      // Request Android permissions
      final AndroidFlutterLocalNotificationsPlugin? androidPlugin =
          _localNotificationsPlugin.resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();
      if (androidPlugin != null) {
        await androidPlugin.requestNotificationsPermission();
      }

      // Request iOS permissions
      final IOSFlutterLocalNotificationsPlugin? iosPlugin =
          _localNotificationsPlugin.resolvePlatformSpecificImplementation<
              IOSFlutterLocalNotificationsPlugin>();
      if (iosPlugin != null) {
        await iosPlugin.requestPermissions(
          alert: true,
          badge: true,
          sound: true,
        );
      }
    } catch (e) {
      debugPrint('[NotificationService] Request permission error: $e');
    }
  }

  /// Trigger a local notification banner
  Future<void> showNotification({
    required String title,
    required String body,
  }) async {
    if (!_isInitialized) {
      await init();
    }

    const AndroidNotificationDetails androidNotificationDetails =
        AndroidNotificationDetails(
      _channelId,
      _channelName,
      channelDescription: _channelDesc,
      importance: Importance.max,
      priority: Priority.high,
      ticker: 'ticker',
      playSound: true,
      enableVibration: true,
    );

    const DarwinNotificationDetails darwinNotificationDetails =
        DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const NotificationDetails notificationDetails = NotificationDetails(
      android: androidNotificationDetails,
      iOS: darwinNotificationDetails,
    );

    try {
      // Use timestamp-based ID to ensure multiple notifications show separately
      final int id = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      await _localNotificationsPlugin.show(
        id,
        title,
        body,
        notificationDetails,
      );
      debugPrint('[NotificationService] Displayed notification: $title - $body');
    } catch (e) {
      debugPrint('[NotificationService] Failed to show notification: $e');
    }
  }
}
