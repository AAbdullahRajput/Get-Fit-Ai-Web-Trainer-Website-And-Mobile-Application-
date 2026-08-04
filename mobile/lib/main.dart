import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'core/theme.dart';
import 'core/constants.dart';
import 'screens/launch_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

 // Load environment variables (AGORA_APP_ID, etc.)
  await dotenv.load(fileName: '.env');

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
      title: 'GetFit Trainer',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: const LaunchScreen(),
    );
  }
}
