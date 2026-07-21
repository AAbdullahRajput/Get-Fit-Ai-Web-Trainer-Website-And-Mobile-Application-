import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/theme.dart';
import 'core/constants.dart';
import 'screens/launch_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

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
