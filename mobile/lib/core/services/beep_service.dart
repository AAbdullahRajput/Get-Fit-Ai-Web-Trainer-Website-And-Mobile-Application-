import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';

/// Generates and plays simple synthesized beep tones — no asset files,
/// no system ringtone dependency. Mirrors the web dashboard's
/// AudioContext oscillator beep (800Hz sine, ~0.5s, fading gain).
class BeepService {
  static final BeepService _instance = BeepService._internal();
  factory BeepService() => _instance;
  BeepService._internal();

  final AudioPlayer _player = AudioPlayer();

  /// Generates a mono 16-bit PCM WAV buffer for a sine tone.
  /// [frequency] in Hz, [durationMs] length of the tone,
  /// fades out exponentially like the web version's gain ramp.
  Uint8List _generateBeepWav({
    required double frequency,
    int durationMs = 500,
    int sampleRate = 44100,
    double amplitude = 0.3,
  }) {
    final int numSamples = (sampleRate * durationMs / 1000).round();
    final Int16List samples = Int16List(numSamples);

    for (int i = 0; i < numSamples; i++) {
      final double t = i / sampleRate;
      // Exponential decay envelope, similar to gain.exponentialRampToValueAtTime
      final double decayProgress = i / numSamples;
      final double envelope = amplitude * math.exp(-decayProgress * 4.6); // ~0.01 at end
      final double sample = envelope * math.sin(2 * math.pi * frequency * t);
      samples[i] = (sample * 32767).clamp(-32768, 32767).toInt();
    }

    return _wrapInWav(samples, sampleRate);
  }

  Uint8List _wrapInWav(Int16List samples, int sampleRate) {
    final int byteRate = sampleRate * 2; // mono, 16-bit
    final int dataLength = samples.length * 2;
    final int fileLength = 44 + dataLength;

    final ByteData header = ByteData(44);
    void writeString(int offset, String s) {
      for (int i = 0; i < s.length; i++) {
        header.setUint8(offset + i, s.codeUnitAt(i));
      }
    }

    writeString(0, 'RIFF');
    header.setUint32(4, fileLength - 8, Endian.little);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    header.setUint32(16, 16, Endian.little); // PCM chunk size
    header.setUint16(20, 1, Endian.little); // PCM format
    header.setUint16(22, 1, Endian.little); // mono
    header.setUint32(24, sampleRate, Endian.little);
    header.setUint32(28, byteRate, Endian.little);
    header.setUint16(32, 2, Endian.little); // block align
    header.setUint16(34, 16, Endian.little); // bits per sample
    writeString(36, 'data');
    header.setUint32(40, dataLength, Endian.little);

    final Uint8List wav = Uint8List(fileLength);
    wav.setRange(0, 44, header.buffer.asUint8List());
    wav.setRange(44, fileLength, samples.buffer.asUint8List());
    return wav;
  }

  Future<void> _playTone(double frequency, {int durationMs = 500, double amplitude = 0.3}) async {
    try {
      final wav = _generateBeepWav(
        frequency: frequency,
        durationMs: durationMs,
        amplitude: amplitude,
      );
      await _player.play(BytesSource(wav, mimeType: 'audio/wav'));
    } catch (e) {
      debugPrint('\x1B[31m[BEEP] Error playing tone: $e\x1B[0m');
    }
  }

  // -----------------------------------------------------------
  // Outgoing call — single beep repeated every 2s (matches web)
  // -----------------------------------------------------------
  Timer? _ringbackTimer;

  void startRingback() {
    stopRingback();
    _playTone(800);
    _ringbackTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      _playTone(800);
    });
  }

  void stopRingback() {
    _ringbackTimer?.cancel();
    _ringbackTimer = null;
  }

  // -----------------------------------------------------------
  // Incoming call — two-tone pattern repeated, more attention-grabbing
  // -----------------------------------------------------------
  Timer? _ringtoneTimer;

  void startRingtone() {
    stopRingtone();
    _playIncomingPattern();
    _ringtoneTimer = Timer.periodic(const Duration(milliseconds: 1800), (_) {
      _playIncomingPattern();
    });
  }

  Future<void> _playIncomingPattern() async {
    await _playTone(900, durationMs: 350, amplitude: 0.4);
    await Future.delayed(const Duration(milliseconds: 150));
    await _playTone(700, durationMs: 350, amplitude: 0.4);
  }

  void stopRingtone() {
    _ringtoneTimer?.cancel();
    _ringtoneTimer = null;
  }

  void dispose() {
    stopRingback();
    stopRingtone();
    _player.dispose();
  }
}