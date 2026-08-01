import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/VideoCallPage.css';
import CallService from '../services/CallService';
import RealtimeService from '../services/RealtimeService';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { MicIcon, MicOffIcon, VideoIcon, VideoOffIcon, PhoneOffIcon, WarningIcon } from '../components/NavIcons';

const VideoCallPage = () => {
  const { callId } = useParams();
  const navigate = useNavigate();

  // Video/Audio states
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState('connecting'); // connecting, active, ended
  const [callData, setCallData] = useState(null);
  const [error, setError] = useState(null);
  const [endReason, setEndReason] = useState(null); // 'remote' | 'self'

  // Refs for video containers
  const localVideoRef = useRef(null);
  const remoteVideoContainerRef = useRef(null);
  const callDurationTimerRef = useRef(null);
  const callStartTimeRef = useRef(null);

  // Initialize call
  useEffect(() => {
    let cancelled = false;

    const initializeCall = async () => {
      try {
        if (cancelled) return;
        // Ensure Supabase client is initialized (singleton may not be set
        // if this page is reached directly, e.g. on refresh)
        RealtimeService.initialize(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY
        );

        // 1. Fetch call details from Supabase
        const callDetails = await RealtimeService.getCallDetails(callId);
        setCallData(callDetails);

        // 2. Initialize Agora client
        await CallService.initialize(import.meta.env.VITE_AGORA_APP_ID);
        if (cancelled) return;

        // 3. Fetch token + uid from Supabase Edge Function (same as mobile)
        const tokenData = await RealtimeService.fetchAgoraToken(callDetails.channel_name);
        if (!tokenData) {
          throw new Error('Failed to get call token');
        }
        const { token, uid } = tokenData;

        // 4. Join Agora channel
        await CallService.joinChannel(callDetails.channel_name, token, uid);

        if (cancelled) return;

        // React immediately when the remote side hangs up, instead of
        // waiting for the video to silently disappear.
        CallService.onRemoteUserLeft = () => {
          if (cancelled) return;
          clearInterval(callDurationTimerRef.current);
          setEndReason('remote');
          setCallStatus('ended');
          RealtimeService.endCall(callId, callDuration).catch(() => {});
          setTimeout(() => {
            CallService.leaveChannel().catch(() => {});
            navigate('/dashboard');
          }, 2200);
        };

        // 4. Render local video
        if (localVideoRef.current && CallService.getLocalVideoTrack()) {
          await CallService.getLocalVideoTrack().play(localVideoRef.current);
        }

        // 5. Setup remote user listener
        const remoteUsersInterval = setInterval(() => {
          const users = CallService.getRemoteUsers();
          setRemoteUsers(users);
          
          // Render each remote video
          users.forEach(user => {
            const containerId = `remote-video-${user.uid}`;
            const container = document.getElementById(containerId);
            if (container && !container.hasChildNodes()) {
              user.videoTrack?.play(containerId);
            }
          });
        }, 100);

        // 6. Mark call as accepted in DB
        await RealtimeService.updateCallStatus(callId, 'accepted');
        setCallStatus('active');

        // 7. Start call duration timer
        callStartTimeRef.current = Date.now();
        callDurationTimerRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
          setCallDuration(elapsed);
        }, 1000);

        return () => {
          clearInterval(remoteUsersInterval);
          clearInterval(callDurationTimerRef.current);
        };
      } catch (err) {
        if (!cancelled) {
          console.error('❌ Call initialization failed:', err);
          setError(err.message);
        }
      }
    };

    initializeCall();

    return () => {
      cancelled = true;
      CallService.leaveChannel().catch(() => {});
    };
  }, [callId]);

  // Handle audio toggle
  const toggleAudio = async () => {
    try {
      const newState = !audioEnabled;
      await CallService.toggleAudio(newState);
      setAudioEnabled(newState);
    } catch (err) {
      console.error('❌ Audio toggle failed:', err);
      setError('Failed to toggle audio');
    }
  };

  // Handle video toggle
  const toggleVideo = async () => {
    try {
      const newState = !videoEnabled;
      await CallService.toggleVideo(newState);
      setVideoEnabled(newState);
    } catch (err) {
      console.error('❌ Video toggle failed:', err);
      setError('Failed to toggle video');
    }
  };

  // Handle end call
  const handleEndCall = async () => {
    try {
      // Stop timer
      clearInterval(callDurationTimerRef.current);

      // Leave Agora channel
      await CallService.leaveChannel();

      // Update call status in DB
      await RealtimeService.endCall(callId, callDuration);

      setEndReason('self');
      setCallStatus('ended');
      setTimeout(() => {
        navigate('/dashboard');
      }, 1400);
    } catch (err) {
      console.error('❌ End call failed:', err);
      setError('Failed to end call');
    }
  };

  // Format call duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const dialogPresets = {
    error: { icon: WarningIcon, color: '#EF4444', title: 'Call Error' },
    self: { icon: PhoneOffIcon, color: '#9CA3AF', title: 'Call Ended' },
    remote: { icon: PhoneOffIcon, color: '#9CA3AF', title: 'Call Ended' },
  };

  const renderStatusDialog = (type, message) => {
    const preset = dialogPresets[type] || dialogPresets.self;
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#0F0F0F',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
      }}>
        <div style={{
          background: '#1A1A1A', borderRadius: 20, padding: '32px 28px',
          width: 'min(340px, 88vw)', textAlign: 'center',
          border: `1px solid ${preset.color}33`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${preset.color}22`, color: preset.color
          }}>
            {React.createElement(preset.icon, { size: 26 })}
          </div>
          <div style={{ color: '#fff', fontSize: 17, fontWeight: 700, marginBottom: 8 }}>
            {preset.title}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.4 }}>
            {message}
          </div>
          {type === 'error' && (
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                marginTop: 20, padding: '10px 24px', borderRadius: 10, border: 'none',
                background: preset.color, color: '#fff', fontWeight: 700, cursor: 'pointer'
              }}
            >
              Back to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  };

  if (error) {
    return renderStatusDialog('error', error);
  }

  if (callStatus === 'ended') {
    const message = endReason === 'remote'
      ? `${callData?.caller_email || 'The other person'} left the call.`
      : 'Returning to dashboard...';
    return renderStatusDialog(endReason || 'self', message);
  }

  return (
    <div className="video-call-container">
      {/* Remote Video (Main) */}
      <div className="video-main">
        {remoteUsers.length > 0 ? (
          remoteUsers.map(user => (
            <div key={user.uid} id={`remote-video-${user.uid}`} className="remote-video" />
          ))
        ) : (
          <div className="video-placeholder">
            <p>⏳ Waiting for remote user...</p>
          </div>
        )}
      </div>

      {/* Local Video (PiP) */}
      <div className="video-pip">
        <div ref={localVideoRef} className="local-video" />
        <div className="pip-label">You</div>
      </div>

      {/* Controls Bar */}
      <div className="call-controls">
        <div className="controls-left">
          <span className="call-duration">
            {formatDuration(callDuration)}
          </span>
          <span className="caller-info">
            Call with {callData?.caller_email || 'User'}
          </span>
        </div>

        <div className="controls-center">
          <button
            className={`control-btn ${audioEnabled ? 'active' : 'inactive'}`}
            onClick={toggleAudio}
            title={audioEnabled ? 'Mute' : 'Unmute'}
          >
            {audioEnabled ? <MicIcon size={22} /> : <MicOffIcon size={22} />}
          </button>

          <button
            className={`control-btn ${videoEnabled ? 'active' : 'inactive'}`}
            onClick={toggleVideo}
            title={videoEnabled ? 'Stop Video' : 'Start Video'}
          >
            {videoEnabled ? <VideoIcon size={22} /> : <VideoOffIcon size={22} />}
          </button>

          <button
            className="control-btn end-call-btn"
            onClick={handleEndCall}
            title="End Call"
          >
            <PhoneOffIcon size={24} />
          </button>
        </div>

        <div className="controls-right">
          <span className={`status-badge ${callStatus}`}>
            {callStatus === 'connecting' && 'Connecting...'}
            {callStatus === 'active' && 'Active'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default VideoCallPage;