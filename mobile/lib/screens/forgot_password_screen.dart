import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../core/services/supabase_service.dart';
import 'auth_screen.dart';

class ForgotPasswordScreen extends StatefulWidget {
  final String initialEmail;
  const ForgotPasswordScreen({super.key, this.initialEmail = ''});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final SupabaseService _supabaseService = SupabaseService();

  int _step = 1; // 1: Email, 2: OTP Code, 3: Update Password, 4: Success
  late String _email;

  // Controllers
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  // Code input box state
  final List<TextEditingController> _codeControllers = List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _codeFocusNodes = List.generate(6, (_) => FocusNode());

  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _isPasswordFocused = false;

  String? _emailError;
  String? _passwordError;
  String? _confirmPasswordError;

  @override
  void initState() {
    super.initState();
    _email = widget.initialEmail;
    _emailController.text = _email;

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

    // Realtime formatting for confirm password: remove spaces
    _confirmPasswordController.addListener(() {
      final text = _confirmPasswordController.text;
      if (text.contains(' ')) {
        final filtered = text.replaceAll(' ', '');
        int currentOffset = _confirmPasswordController.selection.start;
        int spacesBeforeSelection = 0;
        for (int i = 0; i < currentOffset && i < text.length; i++) {
          if (text[i] == ' ') {
            spacesBeforeSelection++;
          }
        }
        int newOffset = (currentOffset - spacesBeforeSelection).clamp(0, filtered.length);
        _confirmPasswordController.value = TextEditingValue(
          text: filtered,
          selection: TextSelection.collapsed(offset: newOffset),
        );
      }
    });
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    for (var c in _codeControllers) {
      c.dispose();
    }
    for (var f in _codeFocusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  // -----------------------------------------
  // Validations
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

  bool get _hasMinLen => _passwordController.text.trim().length >= 8 && _passwordController.text.trim().length <= 16;
  bool get _hasUppercase => RegExp(r'[A-Z]').hasMatch(_passwordController.text.trim());
  bool get _hasNumber => RegExp(r'\d').hasMatch(_passwordController.text.trim());
  bool get _hasSpecial => RegExp(r'[^A-Za-z0-9]').hasMatch(_passwordController.text.trim());

  // -----------------------------------------
  // Actions
  // -----------------------------------------

  Future<void> _handleSendCode() async {
    final email = _emailController.text.trim();
    if (email.isEmpty || !_validateEmail(email)) {
      setState(() {
        _emailError = 'Please enter a valid email address.';
      });
      return;
    }

    setState(() {
      _emailError = null;
      _isLoading = true;
    });

    try {
      await _supabaseService.sendPasswordRecoveryOtp(email);
      setState(() {
        _email = email;
        _step = 2;
      });
    } catch (e) {
      _showErrorModal(_supabaseService.getFriendlyErrorMessage(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleVerifyCode() async {
    final code = _codeControllers.map((c) => c.text).join('');
    if (code.length < 6) return;

    setState(() => _isLoading = true);

    try {
      await _supabaseService.verifyRecoveryCode(_email, code);
      setState(() {
        _step = 3;
      });
    } catch (e) {
      _showErrorModal(_supabaseService.getFriendlyErrorMessage(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleUpdatePassword() async {
    final pwd = _passwordController.text.trim();
    final cpwd = _confirmPasswordController.text.trim();

    final pwdErr = _validatePassword(pwd);
    if (pwdErr != null) {
      setState(() => _passwordError = pwdErr);
      return;
    }

    if (pwd != cpwd) {
      setState(() => _confirmPasswordError = 'Passwords do not match.');
      return;
    }

    setState(() => _isLoading = true);

    try {
      await _supabaseService.updatePassword(pwd);
      setState(() {
        _step = 4;
      });
    } catch (e) {
      _showErrorModal(_supabaseService.getFriendlyErrorMessage(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _handleBackClick() {
    if (_step == 1) {
      Navigator.of(context).pop();
    } else if (_step == 2) {
      setState(() => _step = 1);
    } else if (_step == 3) {
      setState(() => _step = 2);
    }
  }

  void _showErrorModal(String message) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return Dialog(
          backgroundColor: Colors.transparent,
          child: Container(
            decoration: BoxDecoration(
              gradient: AppColors.cardGrad,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: AppColors.inputBorder),
            ),
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('⚠️', style: TextStyle(fontSize: 40)),
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
                  style: const TextStyle(fontSize: 13, color: AppColors.textDim, height: 1.5),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.lime,
                    foregroundColor: AppColors.black,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(horizontal: 36, vertical: 12),
                  ),
                  child: const Text('OK', style: TextStyle(fontWeight: FontWeight.bold)),
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
              // Back Button (only shown for steps before success)
              if (_step < 4)
                Positioned(
                  top: 10,
                  left: 10,
                  child: IconButton(
                    icon: const Icon(Icons.arrow_back, color: AppColors.textLight, size: 24),
                    onPressed: _handleBackClick,
                  ),
                ),
              Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
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
                          ),
                        ),
                      ),
                      const SizedBox(height: 36),

                      // Step 1: Send Recovery Email
                      if (_step == 1) ...[
                        Text(
                          'Reset Password',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.displayMedium,
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Enter your email address to recover your account',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppColors.textDim, fontSize: 13),
                        ),
                        const SizedBox(height: 36),
                        TextField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          onChanged: (val) {
                            if (_emailError != null) setState(() => _emailError = null);
                          },
                          style: const TextStyle(color: AppColors.textLight, fontSize: 13),
                          decoration: const InputDecoration(
                            hintText: 'Email Address',
                            prefixIcon: Icon(Icons.email_outlined, color: AppColors.textDim, size: 20),
                          ),
                        ),
                        if (_emailError != null) ...[
                          const SizedBox(height: 4),
                          Padding(
                            padding: const EdgeInsets.only(left: 4),
                            child: Text(
                              _emailError!,
                              style: const TextStyle(color: Colors.redAccent, fontSize: 11),
                            ),
                          ),
                        ],
                        const SizedBox(height: 24),
                        ElevatedButton(
                          onPressed: _isLoading ? null : _handleSendCode,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.lime,
                            foregroundColor: AppColors.black,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: Text(
                            _isLoading ? 'Sending...' : 'Send Recovery Code',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                        ),
                      ],

                      // Step 2: Input OTP
                      if (_step == 2) ...[
                        Text(
                          'Verify Code',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.displayMedium,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Please enter the recovery code sent to $_email',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.textDim, fontSize: 13),
                        ),
                        const SizedBox(height: 36),
                        // 6-digit OTP fields
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: List.generate(6, (index) => _buildOtpField(index)),
                        ),
                        const SizedBox(height: 36),
                        ElevatedButton(
                          onPressed: _isLoading || _codeControllers.map((c) => c.text).join('').length < 6
                              ? null
                              : _handleVerifyCode,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.lime,
                            foregroundColor: AppColors.black,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: Text(
                            _isLoading ? 'Verifying...' : 'Verify Code',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                        ),
                      ],

                      // Step 3: New Password
                      if (_step == 3) ...[
                        Text(
                          'New Password',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.displayMedium,
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Create a secure new password for your account',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppColors.textDim, fontSize: 13),
                        ),
                        const SizedBox(height: 36),
                        Focus(
                          onFocusChange: (focused) => setState(() => _isPasswordFocused = focused),
                          child: TextField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            style: const TextStyle(color: AppColors.textLight, fontSize: 13),
                            onChanged: (val) {
                              if (_passwordError != null) setState(() => _passwordError = null);
                            },
                            decoration: InputDecoration(
                              hintText: 'New Password',
                              prefixIcon: const Icon(Icons.lock_outline, color: AppColors.textDim, size: 20),
                              suffixIcon: IconButton(
                                icon: Icon(_obscurePassword ? Icons.visibility : Icons.visibility_off, color: AppColors.textDim, size: 20),
                                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                              ),
                            ),
                          ),
                        ),
                        if (_isPasswordFocused) ...[
                          const SizedBox(height: 8),
                          _buildPasswordRequirements(),
                        ],
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
                        const SizedBox(height: 12),
                        TextField(
                          controller: _confirmPasswordController,
                          obscureText: _obscurePassword,
                          style: const TextStyle(color: AppColors.textLight, fontSize: 13),
                          onChanged: (val) {
                            if (_confirmPasswordError != null) setState(() => _confirmPasswordError = null);
                          },
                          decoration: const InputDecoration(
                            hintText: 'Confirm New Password',
                            prefixIcon: Icon(Icons.lock_outline, color: AppColors.textDim, size: 20),
                          ),
                        ),
                        if (_confirmPasswordError != null) ...[
                          const SizedBox(height: 4),
                          Padding(
                            padding: const EdgeInsets.only(left: 4),
                            child: Text(
                              _confirmPasswordError!,
                              style: const TextStyle(color: Colors.redAccent, fontSize: 11),
                            ),
                          ),
                        ],
                        const SizedBox(height: 24),
                        ElevatedButton(
                          onPressed: _isLoading ? null : _handleUpdatePassword,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.lime,
                            foregroundColor: AppColors.black,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: Text(
                            _isLoading ? 'Updating...' : 'Update Password',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                        ),
                      ],

                      // Step 4: Success confirmation screen
                      if (_step == 4) ...[
                        const Icon(Icons.check_circle_outline, color: AppColors.lime, size: 64),
                        const SizedBox(height: 20),
                        Text(
                          'Password Reset!',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.displayMedium?.copyWith(fontSize: 28),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'Your password has been successfully updated. You can now log in with your new password.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppColors.textDim, fontSize: 13, height: 1.5),
                        ),
                        const SizedBox(height: 36),
                        ElevatedButton(
                          onPressed: () {
                            Navigator.of(context).pushAndRemoveUntil(
                              MaterialPageRoute(builder: (_) => const AuthScreen(isLogin: true)),
                              (route) => false,
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.lime,
                            foregroundColor: AppColors.black,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: const Text(
                            'Back to Login',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOtpField(int index) {
    return SizedBox(
      width: 44,
      height: 52,
      child: TextField(
        controller: _codeControllers[index],
        focusNode: _codeFocusNodes[index],
        keyboardType: TextInputType.number,
        maxLength: 1,
        textAlign: TextAlign.center,
        style: const TextStyle(color: AppColors.textLight, fontSize: 20, fontWeight: FontWeight.bold),
        decoration: InputDecoration(
          counterText: '',
          contentPadding: EdgeInsets.zero,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        ),
        onChanged: (value) {
          if (value.isNotEmpty) {
            // Forward focus
            if (index < 5) {
              _codeFocusNodes[index + 1].requestFocus();
            } else {
              _codeFocusNodes[index].unfocus();
            }
          } else {
            // Backward focus
            if (index > 0) {
              _codeFocusNodes[index - 1].requestFocus();
            }
          }
          setState(() {}); // Refresh state to update verify button status
        },
      ),
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
            style: TextStyle(color: AppColors.lime, fontSize: 12, fontWeight: FontWeight.bold),
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
          style: TextStyle(color: isMet ? Colors.green : AppColors.textDim, fontSize: 12, fontWeight: FontWeight.bold),
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
