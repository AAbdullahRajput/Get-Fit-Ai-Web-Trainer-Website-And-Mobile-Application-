import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RealtimeService from '../services/RealtimeService';
import IncomingCallModal from './IncomingCallModal';
import { WarningIcon, PhoneOffIcon, ClockIcon } from './NavIcons';

const IncomingCallListener = ({ trainerId, supabaseUrl, supabaseKey }) => {
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [callerDetails, setCallerDetails] = useState(null);
  const [error, setError] = useState(null);
  const [ringIntervalId, setRingIntervalId] = useState(null);
  const [endNotice, setEndNotice] = useState(null); // { title, message, icon }
  const incomingCallRef = React.useRef(null);
  const ringIntervalRef = React.useRef(null);
  const callerDetailsRef = React.useRef(null);
  const noticeTimeoutRef = React.useRef(null);

  // Initialize Realtime listener on mount
  useEffect(() => {
    const startListening = async () => {
      try {
        // Initialize Supabase client
        RealtimeService.initialize(supabaseUrl, supabaseKey);

        // Start listening for incoming calls
        RealtimeService.startListeningForCalls(trainerId, {
          onIncomingCall: handleIncomingCall,
          onCallStatusChange: handleCallStatusChange,
        });

        console.log('[CALL] Incoming call listener started');
      } catch (err) {
        console.error('[CALL] Failed to start listener:', err);
        setError('Failed to initialize call listener');
      }
    };

    startListening();

    // Cleanup on unmount
    return () => {
      RealtimeService.stopListeningForCalls();
      if (ringIntervalRef.current) {
        clearInterval(ringIntervalRef.current);
        ringIntervalRef.current = null;
      }
      if (noticeTimeoutRef.current) {
        clearTimeout(noticeTimeoutRef.current);
      }
    };
  }, [trainerId, supabaseUrl, supabaseKey]);

  // Handle incoming call
  const handleIncomingCall = async (call) => {
    try {
      console.log('[CALL] Incoming call:', call);
      incomingCallRef.current = call;
      setIncomingCall(call);
      setIsModalOpen(true);

      // Fetch caller details
      const caller = await RealtimeService.getCallerDetails(call.caller_user_id);
      callerDetailsRef.current = caller;
      setCallerDetails(caller);

      // Optional: Play notification sound
      playNotificationSound();

      // Optional: Send browser notification
      sendBrowserNotification(caller);
    } catch (err) {
      console.error('[CALL] Error handling incoming call:', err);
      setError('Failed to process incoming call');
    }
  };

  // Show a brief toast explaining how the call ended
  const showEndNotice = (status) => {
    const name = callerDetailsRef.current?.username || 'The client';
    const presets = {
      ended: { title: 'Call Ended', message: `${name} ended the call before it connected.`, icon: PhoneOffIcon },
      missed: { title: 'Missed Call', message: `You missed a call from ${name}.`, icon: ClockIcon },
      declined: { title: 'Call Declined', message: `You declined the call from ${name}.`, icon: PhoneOffIcon },
    };
    const preset = presets[status] || presets.ended;

    clearTimeout(noticeTimeoutRef.current);
    setEndNotice(preset);
    noticeTimeoutRef.current = setTimeout(() => setEndNotice(null), 4000);
  };

  // Handle call status updates (other end declined/ended, ring timeout, etc.)
  const handleCallStatusChange = (call) => {
    console.log('[CALL] Call status changed:', call.status);

    const isTerminal = call.status === 'declined' || call.status === 'ended' || call.status === 'missed';
    if (isTerminal && incomingCallRef.current?.id === call.id) {
      stopRinging();
      setIsModalOpen(false);
      setIncomingCall(null);
      incomingCallRef.current = null;

      // Only surface a notice when the OTHER side caused the end (i.e. the
      // trainer never clicked accept/decline themselves) — those cases
      // already get their own feedback inline in the modal flow.
      showEndNotice(call.status);
      callerDetailsRef.current = null;
      setCallerDetails(null);
    }
  };

  // Accept call
  const handleAcceptCall = async () => {
    try {
      stopRinging();
      await RealtimeService.acceptCall(incomingCall.id);
      setIsModalOpen(false);
      const callId = incomingCall.id;
      incomingCallRef.current = null;

      // Navigate to video call page (client-side, stays inside HashRouter)
      navigate(`/video-call/${callId}`);
    } catch (err) {
      console.error('[CALL] Failed to accept call:', err);
      setError('Failed to accept call');
    }
  };

  // Decline call
  const handleDeclineCall = async () => {
    try {
      stopRinging();
      await RealtimeService.declineCall(incomingCall.id);
      setIsModalOpen(false);
      setIncomingCall(null);
      incomingCallRef.current = null;
      callerDetailsRef.current = null;
      setCallerDetails(null);
    } catch (err) {
      console.error('[CALL] Failed to decline call:', err);
      setError('Failed to decline call');
    }
  };

  // Play single beep sound
  const playBeep = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gain.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (err) {
      console.warn('[CALL] Audio notification failed:', err);
    }
  };

  // Play continuous ringing until call is answered/declined
  const startContinuousRing = () => {
    // Play initial beep immediately
    playBeep();

    // Then repeat every 2 seconds
    const intervalId = setInterval(() => {
      playBeep();
    }, 2000);

    ringIntervalRef.current = intervalId;
    setRingIntervalId(intervalId);
  };

  // Stop the ringing
  const stopRinging = () => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
      setRingIntervalId(null);
    }
  };

  // Play notification sound (starts continuous ring)
  const playNotificationSound = () => {
    startContinuousRing();
  };

  // Send browser notification
  const sendBrowserNotification = (caller) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Incoming Call', {
        body: `${caller?.username || 'A user'} is calling...`,
        icon: caller?.avatar_url || '/default-avatar.png',
        tag: 'incoming-call',
        requireInteraction: true,
      });
    }
  };

  return (
    <>
      {error && (
        <div style={{
          position: 'fixed',
          top: 10,
          right: 10,
          background: '#ef4444',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <WarningIcon size={18} color="#fff" />
          <span>{error}</span>
        </div>
      )}

      {endNotice && (
        <div style={{
          position: 'fixed',
          top: 16,
          right: 16,
          background: '#1A1A1A',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff',
          padding: '14px 18px',
          borderRadius: '12px',
          zIndex: 998,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          minWidth: 260,
          maxWidth: 340,
          boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.08)',
          }}>
            {React.createElement(endNotice.icon, { size: 18 })}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
              {endNotice.title}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
              {endNotice.message}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && incomingCall && callerDetails && (
        <IncomingCallModal
          callId={incomingCall.id}
          callerName={callerDetails.username}
          callerEmail={callerDetails.email}
          callerAvatar={callerDetails.avatar_url}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}
    </>
  );
};

export default IncomingCallListener;