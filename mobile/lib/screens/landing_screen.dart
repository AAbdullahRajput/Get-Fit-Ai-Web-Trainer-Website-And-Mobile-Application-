import 'package:flutter/material.dart';
import '../core/theme.dart';
import 'auth_screen.dart';

class LandingScreen extends StatelessWidget {
  const LandingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.black,
        elevation: 0,
        title: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.asset(
                'assets/logo_clean.png',
                height: 32,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const Text(
                  'GETFIT',
                  style: TextStyle(
                      color: AppColors.lime,
                      fontWeight: FontWeight.bold,
                      fontSize: 18),
                ),
              ),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: TextButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const AuthScreen(isLogin: true)),
                );
              },
              style: TextButton.styleFrom(
                foregroundColor: AppColors.lime,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                  side: const BorderSide(color: AppColors.lime, width: 1.5),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 16),
              ),
              child: const Text(
                'Log In',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // --- Hero Section (Dark Radial Gradient) ---
            Container(
              decoration: const BoxDecoration(
                gradient: AppColors.backgroundGrad,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // New feature badge
                  Container(
                    decoration: BoxDecoration(
                      color: AppColors.nearBlack,
                      border: Border.all(color: Colors.white10),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    child: const Text(
                      'NEW: Advanced Client Tracking',
                      style: TextStyle(
                        color: AppColors.lime,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  // Title
                  Text(
                    'Train Smarter.\nScale Faster.',
                    style: Theme.of(context).textTheme.displayLarge?.copyWith(
                          height: 1.1,
                          fontSize: 36,
                        ),
                  ),
                  const SizedBox(height: 16),
                  // Subtitle
                  Text(
                    'The ultimate platform for personal trainers. Manage your clients, schedule sessions, track progress, and grow your fitness business—all in one place.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontSize: 14,
                          height: 1.5,
                        ),
                  ),
                  const SizedBox(height: 28),
                  // Action Buttons
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                  builder: (_) => const AuthScreen(isLogin: false)),
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.lime,
                            foregroundColor: AppColors.black,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: const Text(
                            'Get Started',
                            style: TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                  builder: (_) => const AuthScreen(isLogin: true)),
                            );
                          },
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.textLight,
                            side: const BorderSide(color: AppColors.inputBorder),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: const Text(
                            'Trainer Login',
                            style: TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 36),
                  // Quote Card
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.02),
                      border: Border.all(color: Colors.white.withOpacity(0.06)),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          '"Empowering personal trainers to deliver elite coaching, track progress effortlessly, and scale their business without limits."',
                          style: TextStyle(
                            color: AppColors.textLight,
                            fontSize: 13,
                            fontStyle: FontStyle.italic,
                            height: 1.4,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '— Built For Trainers, By Trainers',
                          style: TextStyle(
                            color: AppColors.lime.withOpacity(0.8),
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 36),
                  // Floating Stats Cards (rebuilt layout for mobile)
                  Row(
                    children: [
                      Expanded(
                        child: _buildStatCard('18', 'Active Clients'),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _buildStatCard('450+', 'Workouts Logged'),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _buildStatCard('4.9★', 'Avg Rating'),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // --- Features Section (Lime Green Gradient) ---
            Container(
              color: AppColors.lime,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Everything you need to dominate.',
                    style: TextStyle(
                      fontFamily: 'Archivo Black',
                      fontWeight: FontWeight.bold,
                      fontSize: 26,
                      color: AppColors.black,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Stop juggling spreadsheets and apps. GetFit gives you powerful tools to manage your entire client roster effortlessly.',
                    style: TextStyle(
                      color: Colors.black87,
                      fontSize: 14,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 36),
                  // Feature 1
                  _buildFeatureCard(
                    icon: Icons.calendar_month,
                    title: 'Smart Scheduling',
                    description:
                        'Book sessions, manage your calendar, and automatically notify clients of upcoming workouts without lifting a finger.',
                  ),
                  const SizedBox(height: 16),
                  // Feature 2
                  _buildFeatureCard(
                    icon: Icons.trending_up,
                    title: 'Progress Tracking',
                    description:
                        'Log weights, body metrics, and personal records. Show your clients their exact progress over time with beautiful charts.',
                  ),
                  const SizedBox(height: 16),
                  // Feature 3
                  _buildFeatureCard(
                    icon: Icons.chat_bubble_outline,
                    title: 'Direct Messaging',
                    description:
                        'Keep your clients accountable. Send automated check-ins and chat directly within the app.',
                  ),
                ],
              ),
            ),

            // --- Bottom CTA (Dark) ---
            Container(
              color: AppColors.nearBlack,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
              child: Column(
                children: [
                  const Text(
                    'Ready to level up your coaching?',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontFamily: 'Archivo Black',
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textLight,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Join thousands of elite trainers who are scaling their business with GetFit.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.textDim,
                    ),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                            builder: (_) => const AuthScreen(isLogin: false)),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.lime,
                      foregroundColor: AppColors.black,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 32, vertical: 16),
                    ),
                    child: const Text(
                      'Create Your Account',
                      style: TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                  ),
                ],
              ),
            ),

            // --- Footer ---
            Container(
              color: AppColors.black,
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.asset(
                      'assets/logo_clean.png',
                      height: 28,
                      fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    '© 2026 GetFit. All rights reserved. Designed for elite coaches.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white24,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard(String val, String label) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.nearBlack,
        border: Border.all(color: AppColors.inputBorder),
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
      child: Column(
        children: [
          Text(
            val,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: AppColors.lime,
              fontFamily: 'Archivo Black',
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 10,
              color: AppColors.textDim,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureCard({
    required IconData icon,
    required String title,
    required String description,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.black,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white10),
      ),
      padding: const EdgeInsets.all(20),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            decoration: BoxDecoration(
              color: AppColors.lime.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            padding: const EdgeInsets.all(10),
            child: Icon(
              icon,
              color: AppColors.lime,
              size: 24,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textLight,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  description,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textDim,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
