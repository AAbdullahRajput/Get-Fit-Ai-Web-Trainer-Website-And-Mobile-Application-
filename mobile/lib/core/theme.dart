import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  static const lime = Color(0xFFD7FF1E);
  static const limeDim = Color(0xFFB9DE00);
  static const black = Color(0xFF0A0A0A);
  static const nearBlack = Color(0xFF121212);
  static const olive1 = Color(0xFF4B4A2F);
  static const olive2 = Color(0xFF232316);
  static const olive3 = Color(0xFF16160E);

  static const textLight = Color(0xFFF5F5F0);
  static const textDim = Color(0x8CF5F5F0); // 55% opacity
  static const inputBg = Color(0x14FFFFFF);   // 8% opacity
  static const inputBorder = Color(0x2EFFFFFF); // 18% opacity

  static const cardGrad = LinearGradient(
    colors: [olive1, olive2, olive3],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    stops: [0.0, 0.55, 1.0],
  );

  static const backgroundGrad = RadialGradient(
    center: Alignment.topCenter,
    radius: 1.8,
    colors: [
      Color(0xFF2C2C2C),
      Color(0xFF000000),
    ],
    stops: [0.0, 0.55],
  );

  static const lightBackgroundGrad = RadialGradient(
    center: Alignment.topCenter,
    radius: 1.8,
    colors: [
      Color(0xFFF9F9F6),
      Color(0xFFE5E5E0),
    ],
    stops: [0.0, 0.55],
  );

  static const lightLimeGrad = RadialGradient(
    center: Alignment.topCenter,
    radius: 1.6,
    colors: [
      Color(0xFFF7FCE8),
      Color(0xFFD2F556),
    ],
    stops: [0.0, 0.85],
  );
}

class AppTheme {
  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.black,
      primaryColor: AppColors.lime,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.lime,
        secondary: AppColors.limeDim,
        surface: AppColors.nearBlack,
        error: Colors.redAccent,
      ),
      textTheme: TextTheme(
        displayLarge: GoogleFonts.archivoBlack(
          color: AppColors.textLight,
          fontSize: 32,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.5,
        ),
        displayMedium: GoogleFonts.archivoBlack(
          color: AppColors.textLight,
          fontSize: 24,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.2,
        ),
        titleLarge: GoogleFonts.poppins(
          color: AppColors.textLight,
          fontSize: 20,
          fontWeight: FontWeight.w600,
        ),
        titleMedium: GoogleFonts.poppins(
          color: AppColors.textLight,
          fontSize: 16,
          fontWeight: FontWeight.w500,
        ),
        bodyLarge: GoogleFonts.poppins(
          color: AppColors.textLight,
          fontSize: 14,
          fontWeight: FontWeight.normal,
        ),
        bodyMedium: GoogleFonts.poppins(
          color: AppColors.textDim,
          fontSize: 13,
          fontWeight: FontWeight.normal,
        ),
        labelLarge: GoogleFonts.poppins(
          color: AppColors.textLight,
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.inputBg,
        hintStyle: GoogleFonts.poppins(
          color: AppColors.textDim,
          fontSize: 13,
        ),
        labelStyle: GoogleFonts.poppins(
          color: AppColors.textLight,
          fontSize: 13,
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.inputBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.inputBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.lime),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.redAccent),
        ),
      ),
      buttonTheme: const ButtonThemeData(
        buttonColor: AppColors.lime,
        textTheme: ButtonTextTheme.primary,
      ),
    );
  }

  static ThemeData get lightTheme {
    return ThemeData(
      brightness: Brightness.light,
      scaffoldBackgroundColor: const Color(0xFFF5F5F0),
      primaryColor: AppColors.limeDim,
      colorScheme: const ColorScheme.light(
        primary: AppColors.limeDim,
        secondary: AppColors.olive1,
        surface: Colors.white,
        error: Colors.redAccent,
      ),
      textTheme: TextTheme(
        displayLarge: GoogleFonts.archivoBlack(
          color: AppColors.black,
          fontSize: 32,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.5,
        ),
        displayMedium: GoogleFonts.archivoBlack(
          color: AppColors.black,
          fontSize: 24,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.2,
        ),
        titleLarge: GoogleFonts.poppins(
          color: AppColors.black,
          fontSize: 20,
          fontWeight: FontWeight.w600,
        ),
        titleMedium: GoogleFonts.poppins(
          color: AppColors.black,
          fontSize: 16,
          fontWeight: FontWeight.w500,
        ),
        bodyLarge: GoogleFonts.poppins(
          color: AppColors.black,
          fontSize: 14,
          fontWeight: FontWeight.normal,
        ),
        bodyMedium: GoogleFonts.poppins(
          color: Colors.black54,
          fontSize: 13,
          fontWeight: FontWeight.normal,
        ),
        labelLarge: GoogleFonts.poppins(
          color: AppColors.black,
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        hintStyle: GoogleFonts.poppins(
          color: Colors.black38,
          fontSize: 13,
        ),
        labelStyle: GoogleFonts.poppins(
          color: AppColors.black,
          fontSize: 13,
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.black12),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.black12),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.limeDim),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.redAccent),
        ),
      ),
      buttonTheme: const ButtonThemeData(
        buttonColor: AppColors.limeDim,
        textTheme: ButtonTextTheme.primary,
      ),
    );
  }
}
