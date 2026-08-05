import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:mobile/core/services/call_service.dart';
import 'package:mobile/core/services/agora_service.dart';
import 'package:mobile/core/services/beep_service.dart';
import 'package:flutter_callkit_incoming/flutter_callkit_incoming.dart';
import 'video_call_page.dart';
import 'package:mobile/core/call/call_widgets.dart';
import 'package:mobile/core/theme.dart';

class IncomingCallPage extends StatefulWidget {
  final String callId;
  final String channelName;
  final String callerName;
  final String? callerImageUrl;
  final bool playRingtone;

  const IncomingCallPage({
    super.key,
    required this.callId,
    required this.channelName,
    required this.callerName,
    this.callerImageUrl,
    this.playRingtone = true,
  });

  @override
  State<IncomingCallPage> createState() => _IncomingCallPageState();
}

class _IncomingCallPageState extends State<IncomingCallPage> {
  final _callService = CallService();
  final _beepService = BeepService();
  bool _isResponding = false;
  bool _isDeclining = false;
  bool _hasEnded = false;

  bool _isDark(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark;

  void _showStyledSnackBar(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(
              isError ? Icons.error_outline_rounded : Icons.call_end_rounded,
              color: isError ? const Color(0xFFE5484D) : Colors.white,
              size: 20,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(color: Colors.white, fontSize: 14.5),
              ),
            ),
          ],
        ),
        backgroundColor: const Color(0xFF2C2C2C),
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    debugPrint('\x1B[35m[CALL] IncomingCallPage opened | id=${widget.callId}\x1B[0m');
    _callService.listenToCall(widget.callId);
    _callService.onSessionUpdate = _handleSessionUpdate;
    if (widget.playRingtone) {
      _beepService.startRingtone();
    }
  }

 void _handleSessionUpdate(Map<String, dynamic> session) {
    final status = session['status'] as String?;
    debugPrint('\x1B[35m[CALL] Session update | status=$status\x1B[0m');
    if (!mounted || _hasEnded) return;

    if (status == 'ended' || status == 'missed') {
      _hasEnded = true;
      _beepService.stopRingtone();
      _showStyledSnackBar('Missed call — the caller hung up');
      Navigator.of(context).pop();
    } else if (status == 'declined') {
      _hasEnded = true;
      _beepService.stopRingtone();
      Navigator.of(context).pop();
    }
  }

  Future<void> _acceptCall() async {
    setState(() => _isResponding = true);
    _beepService.stopRingtone();
    _hasEnded = true;

    try {
      await _callService.updateStatus(widget.callId, 'accepted');
      await FlutterCallkitIncoming.endCall(widget.callId);

      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (context) => VideoCallPage(
            callId: widget.callId,
            channelName: widget.channelName,
            remoteName: widget.callerName,
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        _showStyledSnackBar('Couldn\'t accept the call. Please try again.', isError: true);
        setState(() => _isResponding = false);
      }
    }
  }

  Future<void> _declineCall() async {
    setState(() => _isDeclining = true);
    _beepService.stopRingtone();
    _hasEnded = true;

    try {
      await _callService.updateStatus(widget.callId, 'declined');
      await FlutterCallkitIncoming.endCall(widget.callId);
      if (mounted) {
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        _hasEnded = false;
        _showStyledSnackBar('Couldn\'t decline the call. Please try again.', isError: true);
        setState(() => _isDeclining = false);
      }
    }
  }

  @override
  void dispose() {
    _callService.stopListening();
    _beepService.stopRingtone();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = _isDark(context);
    final bgColor = isDark ? AppColors.black : const Color(0xFFF5F5F0);
    final cardBgColor = isDark ? AppColors.nearBlack : Colors.white;
    final accentColor = isDark ? AppColors.lime : AppColors.limeDim;
    final textColor = isDark ? AppColors.textLight : AppColors.black;
    final subtextColor = isDark ? AppColors.textDim : Colors.black54;

    return Scaffold(
      backgroundColor: bgColor,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Caller avatar
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: accentColor.withOpacity(0.2),
              ),
              child: widget.callerImageUrl != null
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(60),
                      child: Image.network(
                        widget.callerImageUrl!,
                        fit: BoxFit.cover,
                      ),
                    )
                  : Icon(
                      Icons.person,
                      size: 60,
                      color: accentColor,
                    ),
            ),
            const SizedBox(height: 30),

            // Caller name
            Text(
              widget.callerName,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: textColor,
              ),
            ),
            const SizedBox(height: 10),

            // Incoming call status
            Text(
              'Incoming call...',
              style: TextStyle(
                fontSize: 14,
                color: subtextColor,
              ),
            ),
            const SizedBox(height: 60),

            // Accept/Decline buttons
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Decline button
                GestureDetector(
                  onTap: _isDeclining ? null : _declineCall,
                  child: Container(
                    width: 70,
                    height: 70,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.red.withOpacity(0.2),
                    ),
                    child: _isDeclining
                        ? Center(
                            child: SizedBox(
                              width: 30,
                              height: 30,
                              child: CircularProgressIndicator(
                                valueColor: AlwaysStoppedAnimation(
                                  Colors.red.shade600,
                                ),
                              ),
                            ),
                          )
                        : Icon(
                            Icons.call_end,
                            color: Colors.red.shade600,
                            size: 32,
                          ),
                  ),
                ),
                const SizedBox(width: 50),

                // Accept button
                GestureDetector(
                  onTap: _isResponding ? null : _acceptCall,
                  child: Container(
                    width: 70,
                    height: 70,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: accentColor.withOpacity(0.2),
                    ),
                    child: _isResponding
                        ? Center(
                            child: SizedBox(
                              width: 30,
                              height: 30,
                              child: CircularProgressIndicator(
                                valueColor: AlwaysStoppedAnimation(accentColor),
                              ),
                            ),
                          )
                        : Icon(
                            Icons.call,
                            color: accentColor,
                            size: 32,
                          ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}