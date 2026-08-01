import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import RealtimeService from '../services/RealtimeService';
import { PhoneOffIcon, ClockIcon, WarningIcon, CheckCircleIcon } from '../components/NavIcons';

export default function OutgoingCallPage() {
  const { callId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { clientName, clientAvatar } = location.state || {};

  const [statusText, setStatusText] = useState('Calling...');
  const [isCancelling, setIsCancelling] = useState(false);
  const [endDialog, setEndDialog] = useState(null); // { type, title, message }
  const timeoutRef = useRef(null);
  const channelRef = useRef(null);
  const navTimeoutRef = useRef(null);

  useEffect(() => {
    RealtimeService.initialize(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    );

    channelRef.current = RealtimeService.listenToCallStatus(callId, (call) => {
      if (call.status === 'ringing') {
        setStatusText('Ringing...');
      } else if (call.status === 'accepted') {
        clearTimeout(timeoutRef.current);
        navigate(`/video-call/${callId}`, { replace: true });
      } else if (call.status === 'declined') {
        clearTimeout(timeoutRef.current);
        showEndDialog('declined', `${clientName || 'The client'} declined your call.`);
      } else if (call.status === 'ended') {
        clearTimeout(timeoutRef.current);
        showEndDialog('ended', 'Call ended. Thanks for connecting!');
      } else if (call.status === 'missed') {
        clearTimeout(timeoutRef.current);
        showEndDialog('missed', `${clientName || 'The client'} is not available right now.`);
      }
    });

    timeoutRef.current = setTimeout(async () => {
      await RealtimeService.updateCallStatus(callId, 'missed');
      showEndDialog('missed', `${clientName || 'The client'} is not available right now.`);
    }, 45000);

    return () => {
      clearTimeout(timeoutRef.current);
      clearTimeout(navTimeoutRef.current);
      RealtimeService.stopListeningToCallStatus(channelRef.current);
    };
  }, [callId, navigate, clientName]);

  const showEndDialog = (type, message) => {
    const titles = {
      declined: 'Call Declined',
      ended: 'Call Ended',
      missed: 'Not Available',
    };
    setEndDialog({ type, title: titles[type] || 'Call Ended', message });
    navTimeoutRef.current = setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 2500);
  };

  const dialogConfig = {
    declined: {
      icon: PhoneOffIcon,
      color: '#EF4444',
      bgLight: 'rgba(239, 68, 68, 0.1)',
    },
    ended: {
      icon: CheckCircleIcon,
      color: '#10B981',
      bgLight: 'rgba(16, 185, 129, 0.1)',
    },
    missed: {
      icon: ClockIcon,
      color: '#F59E0B',
      bgLight: 'rgba(245, 158, 11, 0.1)',
    },
  };

  const config = dialogConfig[endDialog?.type] || dialogConfig.ended;

  const handleCancel = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    clearTimeout(timeoutRef.current);
    try {
      await RealtimeService.updateCallStatus(callId, 'ended');
    } finally {
      navigate('/dashboard', { replace: true });
    }
  };

  const initials = (clientName || 'Client')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0F0F0F',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '60px 20px',
        zIndex: 10000,
      }}
    >
      <div />

      {/* Caller Info Card */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Avatar Circle */}
        <div
          style={{
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: 'var(--lime)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 56,
            fontWeight: 800,
            color: '#000',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          }}
        >
          {clientAvatar ? (
            <img
              src={clientAvatar}
              alt={clientName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            initials
          )}
        </div>

        {/* Client Name */}
        <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginTop: 32 }}>
          {clientName || 'Client'}
        </div>

        {/* Status Badge */}
        <div
          style={{
            marginTop: 20,
            padding: '10px 18px',
            borderRadius: 99,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {statusText}
        </div>
      </div>

      {/* Cancel Button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <button
          onClick={handleCancel}
          disabled={isCancelling}
          style={{
            width: 76,
            height: 76,
            borderRadius: '50%',
            border: 'none',
            background: '#EF4444',
            color: '#fff',
            cursor: isCancelling ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 30px rgba(239,68,68,0.4)',
            opacity: isCancelling ? 0.7 : 1,
            transition: 'opacity 0.2s',
          }}
          title="End call"
        >
          <PhoneOffIcon size={32} color="#fff" />
        </button>
        <div
          style={{
            color: 'rgba(255,255,255,0.6)',
            marginTop: 12,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {isCancelling ? 'Ending...' : 'End Call'}
        </div>
      </div>

      {/* End Dialog */}
      {endDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            style={{
              background: '#1A1A1A',
              borderRadius: 20,
              padding: '40px 32px',
              width: 'min(360px, 90vw)',
              textAlign: 'center',
              border: `1px solid ${config.color}22`,
              boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 40px ${config.color}15`,
              animation: 'slideIn 0.3s ease-out',
            }}
          >
            {/* Icon Circle */}
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                margin: '0 auto 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: config.bgLight,
                color: config.color,
              }}
            >
              {React.createElement(config.icon, { size: 32 })}
            </div>

            {/* Title */}
            <div
              style={{
                color: '#fff',
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              {endDialog.title}
            </div>

            {/* Message */}
            <div
              style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: 15,
                lineHeight: 1.5,
              }}
            >
              {endDialog.message}
            </div>

            {/* Redirect hint */}
            <div
              style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: 12,
                marginTop: 16,
                fontWeight: 500,
              }}
            >
              Returning to dashboard...
            </div>
          </div>

          {/* Animation Keyframes */}
          <style>{`
            @keyframes slideIn {
              from {
                opacity: 0;
                transform: scale(0.95) translateY(-20px);
              }
              to {
                opacity: 1;
                transform: scale(1) translateY(0);
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}