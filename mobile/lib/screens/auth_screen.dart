import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/theme.dart';
import '../core/services/supabase_service.dart';
import 'dashboard_screen.dart';
import 'forgot_password_screen.dart';

class CountryInfo {
  final String code;
  final String name;
  final int length;
  final RegExp pattern;
  final String placeholder;
  final String errorMsg;

  CountryInfo({
    required this.code,
    required this.name,
    required this.length,
    required this.pattern,
    required this.placeholder,
    required this.errorMsg,
  });
}

class AuthScreen extends StatefulWidget {
  final bool isLogin;
  const AuthScreen({super.key, this.isLogin = true});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  late bool _isLoginMode;
  final SupabaseService _supabaseService = SupabaseService();

  // Controllers
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();

  // Form keys
  final _formKey = GlobalKey<FormState>();

  // State flags
  bool _obscurePassword = true;
  bool _isLoading = false;
  bool _isGoogleLoading = false;
  bool _isPasswordFocused = false;
  StreamSubscription<AuthState>? _authStateSubscription;

  // Validation errors
  String? _emailError;
  String? _passwordError;
  String? _nameError;
  String? _phoneError;

  // Countries config matching JS
  final List<CountryInfo> _countries = [
    CountryInfo(
      code: '+92',
      name: 'PK',
      length: 10,
      pattern: RegExp(r'^3\d{9}$'),
      placeholder: '3XXXXXXXXX',
      errorMsg: 'Please enter a valid 10-digit PK mobile number starting with 3.',
    ),
    CountryInfo(
      code: '+1',
      name: 'US/CA',
      length: 10,
      pattern: RegExp(r'^[2-9]\d{9}$'),
      placeholder: 'NXXNXXXXXX',
      errorMsg: 'Please enter a valid 10-digit US/CA phone number.',
    ),
    CountryInfo(
      code: '+44',
      name: 'UK',
      length: 10,
      pattern: RegExp(r'^7\d{9}$'),
      placeholder: '7XXXXXXXXX',
      errorMsg: 'Please enter a valid 10-digit UK mobile number starting with 7.',
    ),
    CountryInfo(
      code: '+966',
      name: 'SA',
      length: 9,
      pattern: RegExp(r'^5\d{8}$'),
      placeholder: '5XXXXXXXX',
      errorMsg: 'Please enter a valid 9-digit Saudi mobile number starting with 5.',
    ),
    CountryInfo(
      code: '+971',
      name: 'AE',
      length: 9,
      pattern: RegExp(r'^5\d{8}$'),
      placeholder: '5XXXXXXXX',
      errorMsg: 'Please enter a valid 9-digit UAE mobile number starting with 5.',
    ),
  ];

  late CountryInfo _selectedCountry;

  @override
  void initState() {
    super.initState();
    _isLoginMode = widget.isLogin;
    _selectedCountry = _countries[0];

    // Realtime formatting for name: remove numbers
    _nameController.addListener(() {
      final text = _nameController.text;
      final filtered = text.replaceAll(RegExp(r'[0-9]'), '');
      if (filtered != text) {
        _nameController.value = TextEditingValue(
          text: filtered,
          selection: TextSelection.collapsed(offset: filtered.length),
        );
      }
    });

    // Realtime formatting for phone: digits only
    _phoneController.addListener(() {
      final text = _phoneController.text;
      final filtered = text.replaceAll(RegExp(r'\D'), '');
      if (filtered != text) {
        _phoneController.value = TextEditingValue(
          text: filtered,
          selection: TextSelection.collapsed(offset: filtered.length),
        );
      }
    });

    // Realtime formatting for password: remove spaces
    _passwordController.addListener(() {
      final text = _passwordController.text;
      if (text.contains(' ')) {
        final filtered = text.replaceAll(' ', '');
        int currentOffset = _passwordController.selection.start;
        int spacesBeforeSelection = 0;
        for (int i = 0; i < currentOffset && i < text.length; i++) {
          if (text[i] == ' ') {
            spacesBeforeSelection++;
          }
        }
        int newOffset = (currentOffset - spacesBeforeSelection).clamp(0, filtered.length);
        _passwordController.value = TextEditingValue(
          text: filtered,
          selection: TextSelection.collapsed(offset: newOffset),
        );
      }
    });

    // Listen to Supabase Auth State Changes for Google OAuth callback
    _authStateSubscription = _supabaseService.client.auth.onAuthStateChange.listen((data) async {
      final session = data.session;
      final event = data.event;
      
      if (session != null && (event == AuthChangeEvent.signedIn || event == AuthChangeEvent.tokenRefreshed)) {
        if (!mounted || _isLoading) return;

        final prefs = await SharedPreferences.getInstance();
        final hasSavedTrainer = prefs.getString('trainer') != null;

        // Only process if we triggered Google login or don't have saved trainer yet
        if (_isGoogleLoading || !hasSavedTrainer) {
          setState(() => _isGoogleLoading = true);
          try {
            // Fetch or auto-create trainer profile (validates client account too)
            final trainer = await _supabaseService.fetchOrCreateTrainerProfile(session.user);
            
            await prefs.setString('trainer', jsonEncode(trainer.toJson()));
            await prefs.setString('session', jsonEncode(session.toJson()));

            if (mounted) {
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const DashboardScreen()),
                (route) => false,
              );
            }
          } catch (e) {
            if (mounted) {
              _showErrorModal(_supabaseService.getFriendlyErrorMessage(e));
            }
          } finally {
            if (mounted) {
              setState(() => _isGoogleLoading = false);
            }
          }
        }
      }
    });
  }

  @override
  void dispose() {
    _authStateSubscription?.cancel();
    _emailController.dispose();
    _passwordController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  // -----------------------------------------
  // Input Validation Rules matching React
  // -----------------------------------------

  bool _validateEmail(String email) {
    return RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$').hasMatch(email);
  }

  String? _validatePassword(String password) {
    if (password.length < 8 || password.length > 16) {
      return "Password must be between 8 and 16 characters long.";
    }
    if (!RegExp(r'[A-Z]').hasMatch(password)) {
      return "Password must contain at least one uppercase letter.";
    }
    if (!RegExp(r'\d').hasMatch(password)) {
      return "Password must contain at least one number.";
    }
    if (!RegExp(r'[^A-Za-z0-9]').hasMatch(password)) {
      return "Password must contain at least one special character.";
    }
    return null;
  }

  void _validateField(String field, String val) {
    setState(() {
      if (field == 'email') {
        if (val.isEmpty) {
          _emailError = 'Email is required.';
        } else if (!_validateEmail(val)) {
          _emailError = 'Please enter a valid email address.';
        } else {
          _emailError = null;
        }
      } else if (field == 'password') {
        if (val.isEmpty) {
          _passwordError = 'Password is required.';
        } else if (!_isLoginMode) {
          _passwordError = _validatePassword(val.trim());
        } else {
          _passwordError = null;
        }
      } else if (field == 'name') {
        if (val.isEmpty) {
          _nameError = 'Name is required.';
        } else {
          _nameError = null;
        }
      } else if (field == 'phone') {
        if (val.isEmpty) {
          _phoneError = 'Phone number is required.';
        } else if (!_selectedCountry.pattern.hasMatch(val)) {
          _phoneError = _selectedCountry.errorMsg;
        } else {
          _phoneError = null;
        }
      }
    });
  }

  // Password components check for live validation widget
  bool get _hasMinLen => _passwordController.text.trim().length >= 8 && _passwordController.text.trim().length <= 16;
  bool get _hasUppercase => RegExp(r'[A-Z]').hasMatch(_passwordController.text.trim());
  bool get _hasNumber => RegExp(r'\d').hasMatch(_passwordController.text.trim());
  bool get _hasSpecial => RegExp(r'[^A-Za-z0-9]').hasMatch(_passwordController.text.trim());

  // -----------------------------------------
  // Form submission
  // -----------------------------------------

  Future<void> _handleSubmit() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    // Run validations
    _validateField('email', email);
    _validateField('password', password);

    if (!_isLoginMode) {
      _validateField('name', _nameController.text.trim());
      _validateField('phone', _phoneController.text.trim());
    }

    if (_emailError != null || _passwordError != null || _nameError != null || _phoneError != null) {
      return;
    }

    setState(() => _isLoading = true);

    try {
      Map<String, dynamic> result;

      if (_isLoginMode) {
        result = await _supabaseService.signInTrainer(
          email: email,
          password: password,
        );
      } else {
        final phone = _selectedCountry.code + _phoneController.text.trim();
        result = await _supabaseService.signUpTrainer(
          email: email,
          password: password,
          username: _nameController.text.trim(),
          phone: phone,
        );
      }

      // Save user / session data to local Storage equivalent (SharedPreferences)
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('trainer', jsonEncode(result['trainer'].toJson()));
      await prefs.setString('session', jsonEncode(result['session']?.toJson()));

      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const DashboardScreen()),
          (route) => false,
        );
      }
    } catch (e) {
      _showErrorModal(_supabaseService.getFriendlyErrorMessage(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleGoogleAuth() async {
    setState(() => _isGoogleLoading = true);
    try {
      await _supabaseService.signInWithGoogle();
    } catch (e) {
      _showErrorModal('Google sign-in failed: ${_supabaseService.getFriendlyErrorMessage(e)}');
    } finally {
      if (mounted) setState(() => _isGoogleLoading = false);
    }
  }

  void _handleForgotPassword() {
    final email = _emailController.text.trim();
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ForgotPasswordScreen(initialEmail: email),
      ),
    );
  }

  // Premium Custom Error Modal matches custom-modal CSS perfectly
  void _showErrorModal(String message) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.symmetric(horizontal: 40),
          child: Container(
            decoration: BoxDecoration(
              gradient: AppColors.cardGrad,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: AppColors.inputBorder),
              boxShadow: const [
                BoxShadow(
                  color: Colors.black54,
                  blurRadius: 32,
                  offset: Offset(0, 8),
                )
              ],
            ),
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  '⚠️',
                  style: TextStyle(fontSize: 40),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Error',
                  style: TextStyle(
                    fontFamily: 'Archivo Black',
                    fontSize: 18,
                    color: AppColors.textLight,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textDim,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.lime,
                    foregroundColor: AppColors.black,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 36, vertical: 12),
                  ),
                  child: const Text(
                    'OK',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: AppColors.backgroundGrad,
        ),
        child: SafeArea(
          child: Stack(
            children: [
              // Back Button
              Positioned(
                top: 10,
                left: 10,
                child: IconButton(
                  icon: const Icon(Icons.arrow_back, color: AppColors.textLight, size: 24),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ),
              // Main Scroll Form
              Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Logo
                        Center(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(16),
                            child: Image.asset(
                              'assets/logo_clean.png',
                              height: 50,
                              fit: BoxFit.contain,
                              errorBuilder: (_, __, ___) => const Text(
                                'GETFIT',
                                style: TextStyle(
                                  fontFamily: 'Archivo Black',
                                  fontSize: 24,
                                  color: AppColors.lime,
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),
                        // Title
                        Text(
                          _isLoginMode ? 'Welcome Back' : 'Create Account',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.displayMedium,
                        ),
                        const SizedBox(height: 6),
                        // Subtitle
                        Text(
                          _isLoginMode
                              ? 'Log in to manage your clients'
                              : 'Become a Trainer today',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 36),

                        // Form Inputs
                        if (!_isLoginMode) ...[
                          // Username field
                          _buildTextField(
                            controller: _nameController,
                            hintText: 'Full Name',
                            keyboardType: TextInputType.name,
                            errorText: _nameError,
                            prefixIcon: Icons.person_outline,
                            onChanged: (val) => _validateField('name', val),
                          ),
                          const SizedBox(height: 12),
                          // Phone country picker + field
                          _buildPhoneField(),
                          const SizedBox(height: 12),
                        ],

                        // Email Field
                        _buildTextField(
                          controller: _emailController,
                          hintText: 'Email',
                          keyboardType: TextInputType.emailAddress,
                          errorText: _emailError,
                          prefixIcon: Icons.email_outlined,
                          onChanged: (val) => _validateField('email', val),
                        ),
                        const SizedBox(height: 12),

                        // Password Field
                        _buildPasswordField(),
                        const SizedBox(height: 8),

                        // Live password requirement check list for Signup
                        if (!_isLoginMode && _isPasswordFocused) ...[
                          _buildPasswordRequirements(),
                          const SizedBox(height: 12),
                        ],

                        // Forgot password button
                        if (_isLoginMode) ...[
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton.icon(
                              onPressed: _isLoading ? null : _handleForgotPassword,
                              icon: const Icon(Icons.key_outlined, size: 14, color: AppColors.lime),
                              label: const Text(
                                'Forgot Password?',
                                style: TextStyle(
                                  color: AppColors.lime,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 12,
                                ),
                              ),
                              style: TextButton.styleFrom(
                                backgroundColor: AppColors.lime.withOpacity(0.08),
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  side: BorderSide(color: AppColors.lime.withOpacity(0.25)),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],

                        // Action button
                        ElevatedButton(
                          onPressed: _isLoading || _isGoogleLoading ? null : _handleSubmit,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.lime,
                            foregroundColor: AppColors.black,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: Text(
                            _isLoading
                                ? (_isLoginMode ? 'Logging in...' : 'Signing up...')
                                : (_isLoginMode ? 'Log In' : 'Sign Up'),
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Divider and Google Sign-In
                        Row(
                          children: [
                            Expanded(
                              child: Container(
                                height: 1,
                                color: Colors.white10,
                              ),
                            ),
                            const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 10),
                              child: Text(
                                'or continue with',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: AppColors.textDim,
                                ),
                              ),
                            ),
                            Expanded(
                              child: Container(
                                height: 1,
                                color: Colors.white10,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Google Sign-In button (premium, matches css styling)
                        OutlinedButton(
                          onPressed: _isLoading || _isGoogleLoading ? null : _handleGoogleAuth,
                          style: OutlinedButton.styleFrom(
                            backgroundColor: Colors.white.withOpacity(0.06),
                            foregroundColor: AppColors.textLight,
                            side: const BorderSide(color: AppColors.inputBorder),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Image.network(
                                'https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg',
                                height: 18,
                                width: 18,
                                errorBuilder: (_, __, ___) => const Icon(
                                  Icons.g_mobiledata,
                                  color: AppColors.textLight,
                                  size: 18,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                _isGoogleLoading ? 'Connecting...' : 'Continue with Google',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 36),

                        // Toggle Mode Link
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              _isLoginMode
                                  ? "Don't have an account? "
                                  : "Already have an account? ",
                              style: const TextStyle(
                                color: AppColors.textDim,
                                fontSize: 13,
                              ),
                            ),
                            GestureDetector(
                              onTap: () {
                                if (_isLoading || _isGoogleLoading) return;
                                setState(() {
                                  _isLoginMode = !_isLoginMode;
                                  _emailError = null;
                                  _passwordError = null;
                                  _nameError = null;
                                  _phoneError = null;
                                  _emailController.clear();
                                  _passwordController.clear();
                                  _nameController.clear();
                                  _phoneController.clear();
                                });
                              },
                              child: Text(
                                _isLoginMode ? 'Sign up' : 'Log in',
                                style: const TextStyle(
                                  color: AppColors.lime,
                                  fontWeight: FontWeight.bold,
                                  decoration: TextDecoration.underline,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hintText,
    required TextInputType keyboardType,
    required String? errorText,
    required IconData prefixIcon,
    required ValueChanged<String> onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          onChanged: onChanged,
          style: const TextStyle(color: AppColors.textLight, fontSize: 13),
          decoration: InputDecoration(
            hintText: hintText,
            prefixIcon: Icon(prefixIcon, color: AppColors.textDim, size: 20),
          ),
        ),
        if (errorText != null) ...[
          const SizedBox(height: 4),
          Padding(
            padding: const EdgeInsets.only(left: 4),
            child: Text(
              errorText,
              style: const TextStyle(color: Colors.redAccent, fontSize: 11),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildPasswordField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Focus(
          onFocusChange: (focused) {
            setState(() {
              _isPasswordFocused = focused;
            });
          },
          child: TextField(
            controller: _passwordController,
            obscureText: _obscurePassword,
            onChanged: (val) => _validateField('password', val),
            style: const TextStyle(color: AppColors.textLight, fontSize: 13),
            decoration: InputDecoration(
              hintText: 'Password',
              prefixIcon: const Icon(Icons.lock_outline, color: AppColors.textDim, size: 20),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword ? Icons.visibility : Icons.visibility_off,
                  color: AppColors.textDim,
                  size: 20,
                ),
                onPressed: () {
                  setState(() {
                    _obscurePassword = !_obscurePassword;
                  });
                },
              ),
            ),
          ),
        ),
        if (_passwordError != null) ...[
          const SizedBox(height: 4),
          Padding(
            padding: const EdgeInsets.only(left: 4),
            child: Text(
              _passwordError!,
              style: const TextStyle(color: Colors.redAccent, fontSize: 11),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildPhoneField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          decoration: BoxDecoration(
            color: AppColors.inputBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.inputBorder),
          ),
          child: Row(
            children: [
              // Custom Country picker dropdown
              Padding(
                padding: const EdgeInsets.only(left: 12),
                child: DropdownButton<CountryInfo>(
                  value: _selectedCountry,
                  underline: const SizedBox.shrink(),
                  dropdownColor: AppColors.black,
                  icon: const Icon(Icons.arrow_drop_down, color: AppColors.textDim, size: 16),
                  onChanged: (CountryInfo? value) {
                    if (value != null) {
                      setState(() {
                        _selectedCountry = value;
                        _phoneController.clear();
                        _phoneError = null;
                      });
                    }
                  },
                  items: _countries.map((c) {
                    return DropdownMenuItem<CountryInfo>(
                      value: c,
                      child: Text(
                        '${c.name} (${c.code})',
                        style: const TextStyle(
                          color: AppColors.textLight,
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              // Line separator
              Container(
                height: 18,
                margin: const EdgeInsets.symmetric(horizontal: 8),
                width: 1,
                color: Colors.white12,
              ),
              // Text Field
              Expanded(
                child: TextField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  maxLength: _selectedCountry.length,
                  style: const TextStyle(color: AppColors.textLight, fontSize: 13),
                  onChanged: (val) => _validateField('phone', val),
                  decoration: InputDecoration(
                    counterText: '',
                    hintText: _selectedCountry.placeholder,
                    filled: false,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
            ],
          ),
        ),
        if (_phoneError != null) ...[
          const SizedBox(height: 4),
          Padding(
            padding: const EdgeInsets.only(left: 4),
            child: Text(
              _phoneError!,
              style: const TextStyle(color: Colors.redAccent, fontSize: 11),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildPasswordRequirements() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.02),
        border: Border.all(color: Colors.white10),
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Password Requirements:',
            style: TextStyle(
              color: AppColors.lime,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          _buildRequirementItem('8 to 16 characters long', _hasMinLen),
          const SizedBox(height: 4),
          _buildRequirementItem('At least one uppercase letter (A-Z)', _hasUppercase),
          const SizedBox(height: 4),
          _buildRequirementItem('At least one number (0-9)', _hasNumber),
          const SizedBox(height: 4),
          _buildRequirementItem('At least one special character (e.g. !, @, #)', _hasSpecial),
        ],
      ),
    );
  }

  Widget _buildRequirementItem(String text, bool isMet) {
    return Row(
      children: [
        Text(
          isMet ? '✓ ' : '• ',
          style: TextStyle(
            color: isMet ? Colors.green : AppColors.textDim,
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
        ),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              color: isMet ? Colors.green : AppColors.textDim,
              fontSize: 11,
              fontWeight: isMet ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
        ),
      ],
    );
  }
}
