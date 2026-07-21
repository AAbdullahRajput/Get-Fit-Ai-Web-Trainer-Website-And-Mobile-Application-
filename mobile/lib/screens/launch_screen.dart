import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/theme.dart';
import 'landing_screen.dart';
import 'dashboard_screen.dart';

class LaunchScreen extends StatefulWidget {
  const LaunchScreen({super.key});

  @override
  State<LaunchScreen> createState() => _LaunchScreenState();
}

class _LaunchScreenState extends State<LaunchScreen> {
  double _progress = 0.0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startLoading();
  }

  void _startLoading() {
    _timer = Timer.periodic(const Duration(milliseconds: 80), (timer) {
      setState(() {
        if (_progress >= 100.0) {
          _timer?.cancel();
          _onLoadingComplete();
        } else {
          // Randomize increments to simulate realistic loading
          _progress = min(_progress + (Random().nextInt(8) + 3), 100.0);
        }
      });
    });
  }

  void _onLoadingComplete() {
    Future.delayed(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      final session = Supabase.instance.client.auth.currentSession;
      if (session != null) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const DashboardScreen()),
        );
      } else {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const LandingScreen()),
        );
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final trackWidth = min(width * 0.7, 280.0);

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.lightLimeGrad),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // High-resolution Clean Logo
              Container(
                width: 140,
                height: 140,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(28),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.15),
                      blurRadius: 24,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(28),
                  child: Image.asset(
                    'assets/logo_clean.png',
                    fit: BoxFit.contain,
                    errorBuilder: (context, error, stackTrace) {
                      return const Center(
                        child: Text(
                          'GETFIT',
                          style: TextStyle(
                            color: AppColors.black,
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
              const SizedBox(height: 48),
              // Progress percent label
              Text(
                'LOADING... ${_progress.toInt()}%',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.black,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 2,
                ),
              ),
              const SizedBox(height: 16),
              // Custom Progress Tracker (black contrast for light background)
              SizedBox(
                width: trackWidth,
                height: 12,
                child: Stack(
                  alignment: Alignment.centerLeft,
                  clipBehavior: Clip.none,
                  children: [
                    // Gray progress track line
                    Container(
                      height: 4,
                      width: trackWidth,
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    // Black progress fill line
                    Positioned(
                      left: 0,
                      child: Container(
                        height: 4,
                        width: trackWidth * (_progress / 100.0),
                        decoration: BoxDecoration(
                          color: AppColors.black,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    // Handle on top of progress line
                    Positioned(
                      left: (trackWidth * (_progress / 100.0)) - 6,
                      child: Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: AppColors.black,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.3),
                              blurRadius: 6,
                              spreadRadius: 1,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
