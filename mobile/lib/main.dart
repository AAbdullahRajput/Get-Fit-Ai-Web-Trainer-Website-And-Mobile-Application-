import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'core/theme.dart';
import 'core/constants.dart';
import 'core/services/call_notification_service.dart';
import 'package:flutter_callkit_incoming/flutter_callkit_incoming.dart';
import 'core/services/call_service.dart';
import 'screens/launch_screen.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint('[FCM] Background message received: ${message.data}');
  await _handleIncomingCallMessage(message);
}

Future<void> _handleIncomingCallMessage(RemoteMessage message) async {
  if (message.data['type'] != 'incoming_call') return;

  final callId = message.data['call_id'] as String?;
  final channelName = message.data['channel_name'] as String?;
  final callerName = message.data['caller_name'] as String? ?? 'Someone';
  final callerImageUrl = message.data['caller_image_url'] as String?;
  if (callId == null || channelName == null) return;

  CallNotificationService.setDeclineCallback((id) {
    CallService().updateStatus(id, 'declined');
  });

  await CallNotificationService().showIncomingCall(
    callId: callId,
    channelName: channelName,
    callerName: callerName,
    callerImageUrl: (callerImageUrl != null && callerImageUrl.isNotEmpty) ? callerImageUrl : null,
  );
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

 // Load environment variables (AGORA_APP_ID, etc.)
  await dotenv.load(fileName: '.env');

  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

  FirebaseMessaging.onMessage.listen((message) {
    _handleIncomingCallMessage(message);
  });

  // Listen for CallKit accept/decline events while the app is alive.
  FlutterCallkitIncoming.onEvent.listen((event) {
    CallNotificationService.handleCallEvent(event);
  });

  // Handle the case where the app was fully killed and launched by tapping
  // Accept on the CallKit screen.
  final activeCalls = await FlutterCallkitIncoming.activeCalls();
  if (activeCalls is List && activeCalls.isNotEmpty) {
    // No-op here — the onEvent stream above still fires actionCallAccept
    // on cold start in this plugin, so nothing extra is needed. This block
    // is a hook in case you need to inspect activeCalls later.
  }

  debugPrint('\x1B[35m[BOOT] SUPABASE_URL="${AppConstants.supabaseUrl}"\x1B[0m');
  debugPrint('\x1B[35m[BOOT] SUPABASE_KEY length=${AppConstants.supabaseKey.length}\x1B[0m');
  debugPrint('\x1B[35m[BOOT] Parsed host="${Uri.tryParse(AppConstants.supabaseUrl)?.host}"\x1B[0m');

  // Initialize Supabase Connection
  await Supabase.initialize(
    url: AppConstants.supabaseUrl,
    publishableKey: AppConstants.supabaseKey,
  );

  runApp(const GetFitApp());
}

class GetFitApp extends StatelessWidget {
  const GetFitApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: navigatorKey,
      title: 'GetFit Trainer',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: const LaunchScreen(),
    );
  }
}
