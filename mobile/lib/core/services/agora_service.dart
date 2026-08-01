import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';
import 'supabase_service.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Thin wrapper around the Agora RTC engine — handles engine lifecycle,
/// joining/leaving a video channel, and exposes simple callbacks for the
/// call UI to react to (remote user joined, remote left, connection state).
class AgoraService {
  static final AgoraService _instance = AgoraService._internal();
  factory AgoraService() => _instance;
  AgoraService._internal();

  RtcEngine? _engine;
  RtcEngine? get engine => _engine;

  int? localUid;
  int? remoteUid;

  VoidCallback? onRemoteUserJoined;
  VoidCallback? onRemoteUserLeft;
  VoidCallback? onLocalJoinSuccess;
  void Function(String reason)? onError;

  static String get _appId => dotenv.env['AGORA_APP_ID'] ?? '';

  /// Requests camera + mic permissions. Must be called before joining.
  Future<bool> requestPermissions() async {
    debugPrint('\x1B[33m[AGORA] Requesting camera + mic permissions\x1B[0m');
    final statuses = await [Permission.camera, Permission.microphone].request();
    final granted = statuses[Permission.camera]!.isGranted &&
        statuses[Permission.microphone]!.isGranted;
    debugPrint(granted
        ? '\x1B[32m[AGORA] Permissions granted\x1B[0m'
        : '\x1B[31m[AGORA] Permissions DENIED\x1B[0m');
    return granted;
  }

  /// Fetches a fresh Agora token from the Supabase Edge Function.
  /// Never generate/store the App Certificate in the app — this is why
  /// the token comes from the server on every call.
  Future<Map<String, dynamic>?> _fetchToken(String channelName) async {
    try {
      debugPrint('\x1B[33m[AGORA] Fetching token for channel: $channelName\x1B[0m');
      final supabase = SupabaseService();
      final response = await supabase.client.functions.invoke(
        'generate-agora-token',
        body: {'channelName': channelName},
      );
      if (response.data == null || response.data['token'] == null) {
        debugPrint('\x1B[31m[AGORA] Token fetch failed: ${response.data}\x1B[0m');
        return null;
      }
      debugPrint('\x1B[32m[AGORA] Token fetched | uid=${response.data['uid']}\x1B[0m');
      return Map<String, dynamic>.from(response.data);
    } catch (e) {
      debugPrint('\x1B[31m[AGORA] ERROR | _fetchToken | $e\x1B[0m');
      return null;
    }
  }

  /// Initializes the engine (idempotent — safe to call once per call session)
  /// and joins the given channel as a video+audio publisher.
  Future<bool> joinChannel(String channelName) async {
    try {
      final hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        onError?.call('Camera/microphone permission denied');
        return false;
      }

      final tokenData = await _fetchToken(channelName);
      if (tokenData == null) {
        onError?.call('Failed to get call token');
        return false;
      }

      final token = tokenData['token'] as String;
      final uid = tokenData['uid'] as int;
      localUid = uid;

      debugPrint('\x1B[33m[AGORA] Creating engine\x1B[0m');
      _engine = createAgoraRtcEngine();
      await _engine!.initialize(RtcEngineContext(appId: _appId));

      await _engine!.enableVideo();
      await _engine!.enableAudio();
      await _engine!.setDefaultAudioRouteToSpeakerphone(true);
      await _engine!.startPreview();

      _engine!.registerEventHandler(
        RtcEngineEventHandler(
          onJoinChannelSuccess: (connection, elapsed) {
            debugPrint('\x1B[32m[AGORA] Local join success | uid=${connection.localUid}\x1B[0m');
            onLocalJoinSuccess?.call();
          },
          onUserJoined: (connection, uid, elapsed) {
            debugPrint('\x1B[32m[AGORA] Remote user joined | uid=$uid\x1B[0m');
            remoteUid = uid;
            onRemoteUserJoined?.call();
          },
          onUserOffline: (connection, uid, reason) {
            debugPrint('\x1B[33m[AGORA] Remote user left | uid=$uid | reason=$reason\x1B[0m');
            remoteUid = null;
            onRemoteUserLeft?.call();
          },
          onError: (err, msg) {
            debugPrint('\x1B[31m[AGORA] Engine error | $err | $msg\x1B[0m');
            onError?.call(msg);
          },
          onConnectionStateChanged: (connection, state, reason) {
            debugPrint('\x1B[35m[AGORA] Connection state: $state | reason: $reason\x1B[0m');
          },
        ),
      );

      debugPrint('\x1B[33m[AGORA] Joining channel: $channelName as uid=$uid\x1B[0m');
      await _engine!.joinChannel(
        token: token,
        channelId: channelName,
        uid: uid,
        options: const ChannelMediaOptions(
          clientRoleType: ClientRoleType.clientRoleBroadcaster,
          channelProfile: ChannelProfileType.channelProfileCommunication,
        ),
      );

      return true;
    } catch (e) {
      debugPrint('\x1B[31m[AGORA] ERROR | joinChannel | $e\x1B[0m');
      onError?.call(e.toString());
      return false;
    }
  }

  Future<void> toggleMute(bool muted) async {
    await _engine?.muteLocalAudioStream(muted);
    debugPrint('\x1B[33m[AGORA] Mic ${muted ? 'muted' : 'unmuted'}\x1B[0m');
  }

  Future<void> toggleCamera(bool disabled) async {
    await _engine?.muteLocalVideoStream(disabled);
    debugPrint('\x1B[33m[AGORA] Camera ${disabled ? 'off' : 'on'}\x1B[0m');
  }

  Future<void> switchCamera() async {
    await _engine?.switchCamera();
    debugPrint('\x1B[33m[AGORA] Camera switched\x1B[0m');
  }

  /// Leaves the channel and fully tears down the engine — call this on
  /// every call end (declined, ended, or error) to avoid leaking resources.
  Future<void> leaveChannel() async {
    try {
      debugPrint('\x1B[33m[AGORA] Leaving channel\x1B[0m');
      await _engine?.leaveChannel();
      await _engine?.release();
      _engine = null;
      remoteUid = null;
      localUid = null;
      debugPrint('\x1B[32m[AGORA] Channel left, engine released\x1B[0m');
    } catch (e) {
      debugPrint('\x1B[31m[AGORA] ERROR | leaveChannel | $e\x1B[0m');
    }
  }
}