import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:mobile/core/theme.dart';

/// Professional line-icon set for call screens. All icons share a 24x24
/// viewBox, 2px rounded stroke, no fill — swap {color} at render time.
class CallIcons {
  static const String mic = '''
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="9" y="2" width="6" height="12" rx="3" stroke="{color}" stroke-width="2"/>
  <path d="M5 11a7 7 0 0 0 14 0" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <path d="M12 18v3" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
</svg>''';

  static const String micOff = '''
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M9 4a3 3 0 0 1 6 0v6c0 .5-.08.97-.23 1.41" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <path d="M9 9v1a3 3 0 0 0 4.24 2.74" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <path d="M5 11a7 7 0 0 0 10.5 6.06" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <path d="M19 11a6.98 6.98 0 0 1-.6 2.84" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <path d="M12 18v3" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <path d="M3 3l18 18" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
</svg>''';

  static const String camera = '''
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="6" width="14" height="12" rx="3" stroke="{color}" stroke-width="2"/>
  <path d="M16 10.5l5-2.8v8.6l-5-2.8" stroke="{color}" stroke-width="2" stroke-linejoin="round"/>
</svg>''';

  static const String cameraOff = '''
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M2 9a3 3 0 0 1 3-3h4l2 2h1a3 3 0 0 1 3 3v1" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <path d="M16 10.5l5-2.8v8.6l-5-2.8" stroke="{color}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M2 12v3a3 3 0 0 0 3 3h8a3 3 0 0 0 2.5-1.34" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <path d="M2 2l20 20" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
</svg>''';

  static const String callEnd = '''
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3.5 12.5c2.9-2.6 6-3.9 8.5-3.9s5.6 1.3 8.5 3.9c.5.45.5 1.2.02 1.66l-2.1 2.02a1.1 1.1 0 0 1-1.4.1l-2.1-1.5a1.1 1.1 0 0 0-1.28.02c-.62.46-1.4.75-2.14.75s-1.52-.29-2.14-.75a1.1 1.1 0 0 0-1.28-.02l-2.1 1.5a1.1 1.1 0 0 1-1.4-.1l-2.1-2.02a1.15 1.15 0 0 1 .02-1.66Z" stroke="{color}" stroke-width="2" stroke-linejoin="round"/>
</svg>''';

  static const String callAccept = '''
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3.5 11.5c2.9 2.6 6 3.9 8.5 3.9s5.6-1.3 8.5-3.9c.5-.45.5-1.2.02-1.66l-2.1-2.02a1.1 1.1 0 0 0-1.4-.1l-2.1 1.5a1.1 1.1 0 0 1-1.28-.02A3.4 3.4 0 0 0 12 8.6c-.74 0-1.52.29-2.14.75a1.1 1.1 0 0 1-1.28.02l-2.1-1.5a1.1 1.1 0 0 0-1.4.1l-2.1 2.02a1.15 1.15 0 0 0 .02 1.66Z" stroke="{color}" stroke-width="2" stroke-linejoin="round"/>
</svg>''';

  static const String switchCamera = '''
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 12a8 8 0 0 1 13.66-5.66L20 8" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <path d="M20 4v4h-4" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M20 12a8 8 0 0 1-13.66 5.66L4 16" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
  <path d="M4 20v-4h4" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>''';

  static const String personFallback = '''
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="8" r="4" stroke="{color}" stroke-width="2"/>
  <path d="M4 20c0-3.86 3.58-6 8-6s8 2.14 8 6" stroke="{color}" stroke-width="2" stroke-linecap="round"/>
</svg>''';
}

/// Renders one of the [CallIcons] strings at the given size/color.
class CallSvgIcon extends StatelessWidget {
  final String svg;
  final double size;
  final Color color;

  const CallSvgIcon({
    super.key,
    required this.svg,
    required this.size,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final colored = svg.replaceAll('{color}', '#${color.value.toRadixString(16).substring(2)}');
    return SvgPicture.string(colored, width: size, height: size);
  }
}

/// Responsive circular call-control button (mute, camera, switch, end, etc).
class CallActionButton extends StatelessWidget {
  final String svg;
  final VoidCallback onTap;
  final bool active;
  final bool loading;
  final Color? background;
  final Color? iconColor;
  final double? size;
  final String? label;

  const CallActionButton({
    super.key,
    required this.svg,
    required this.onTap,
    this.active = false,
    this.loading = false,
    this.background,
    this.iconColor,
    this.size,
    this.label,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accentColor = isDark ? AppColors.lime : AppColors.limeDim;
    final screenWidth = MediaQuery.of(context).size.width;
    final btnSize = size ?? (screenWidth * 0.15).clamp(52.0, 68.0);
    final bg = background ?? (active ? accentColor : Colors.white.withOpacity(0.14));
    final fg = iconColor ?? (background != null ? Colors.white : (active ? Colors.black : Colors.white));

    final button = GestureDetector(
      onTap: loading ? null : onTap,
      child: Container(
        width: btnSize,
        height: btnSize,
        decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
        child: loading
            ? Padding(
                padding: EdgeInsets.all(btnSize * 0.28),
                child: CircularProgressIndicator(color: fg, strokeWidth: 2),
              )
            : Center(child: CallSvgIcon(svg: svg, size: btnSize * 0.42, color: fg)),
      ),
    );

    if (label == null) return button;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        button,
        const SizedBox(height: 10),
        Text(label!, style: const TextStyle(color: Colors.white54, fontSize: 12.5)),
      ],
    );
  }
}

/// Avatar with a soft pulsing ring — used for calling/ringing states so the
/// UI reads as "live" instead of static.
class PulsingAvatar extends StatefulWidget {
  final String? imageUrl;
  final Color? ringColor;

  const PulsingAvatar({super.key, this.imageUrl, this.ringColor});

  @override
  State<PulsingAvatar> createState() => _PulsingAvatarState();
}

class _PulsingAvatarState extends State<PulsingAvatar> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accentColor = isDark ? AppColors.lime : AppColors.limeDim;
    final ringColor = widget.ringColor ?? accentColor;
    final screenWidth = MediaQuery.of(context).size.width;
    final radius = (screenWidth * 0.2).clamp(64.0, 88.0);

    return SizedBox(
      width: radius * 2.6,
      height: radius * 2.6,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          return Stack(
            alignment: Alignment.center,
            children: List.generate(2, (i) {
              final t = (_controller.value + i * 0.5) % 1.0;
              return Opacity(
                opacity: (1 - t) * 0.35,
                child: Container(
                  width: radius * 2 + (t * radius * 0.6),
                  height: radius * 2 + (t * radius * 0.6),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: ringColor, width: 2),
                  ),
                ),
              );
            })
              ..add(child!),
          );
        },
        child: CircleAvatar(
          radius: radius,
          backgroundColor: accentColor,
          backgroundImage: (widget.imageUrl ?? '').isNotEmpty ? NetworkImage(widget.imageUrl!) : null,
          child: (widget.imageUrl ?? '').isEmpty
              ? CallSvgIcon(svg: CallIcons.personFallback, size: radius * 0.85, color: Colors.black)
              : null,
        ),
      ),
    );
  }
}

/// Small rounded status pill — "Calling...", "Ringing...", "In call 00:32".
class CallStatusPill extends StatelessWidget {
  final String text;
  final bool showDot;
  final Color? dotColor;

  const CallStatusPill({
    super.key,
    required this.text,
    this.showDot = false,
    this.dotColor,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accentColor = isDark ? AppColors.lime : AppColors.limeDim;
    final color = dotColor ?? accentColor;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.08),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showDot) ...[
            _BlinkingDot(color: color),
            const SizedBox(width: 7),
          ],
          Text(text, style: const TextStyle(color: Colors.white70, fontSize: 12.5, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _BlinkingDot extends StatefulWidget {
  final Color color;
  const _BlinkingDot({required this.color});

  @override
  State<_BlinkingDot> createState() => _BlinkingDotState();
}

class _BlinkingDotState extends State<_BlinkingDot> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween(begin: 0.3, end: 1.0).animate(_controller),
      child: Container(
        width: 7,
        height: 7,
        decoration: BoxDecoration(shape: BoxShape.circle, color: widget.color),
      ),
    );
  }
}