import React, { useState, useEffect } from 'react';
import { PhoneOffIcon, CheckCircleIcon, VideoIcon } from './NavIcons';
import '../styles/IncomingCallModal.css';

const IncomingCallModal = ({ 
  callId, 
  callerName, 
  callerEmail, 
  callerAvatar, 
  onAccept, 
  onDecline 
}) => {
  const [isRinging, setIsRinging] = useState(true);
  const [timeoutId, setTimeoutId] = useState(null);
  const [ringDuration, setRingDuration] = useState(0);
  const [autoDeclineCountdown, setAutoDeclineCountdown] = useState(30);

  // Track ringing duration and auto-decline countdown
  useEffect(() => {
    const ringTimerInterval = setInterval(() => {
      setRingDuration(prev => prev + 1);
    }, 1000);

    const countdownInterval = setInterval(() => {
      setAutoDeclineCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-decline after 30 seconds if no action
    const id = setTimeout(() => {
      console.log('[CALL] Auto-declined after 30 seconds');
      setIsRinging(false);
      onDecline();
    }, 30000); // 30 seconds

    setTimeoutId(id);

    return () => {
      clearInterval(ringTimerInterval);
      clearInterval(countdownInterval);
      clearTimeout(id);
    };
  }, [onDecline]);

  // Handle accept
  const handleAccept = () => {
    clearTimeout(timeoutId);
    setIsRinging(false);
    onAccept();
  };

  // Handle decline
  const handleDecline = () => {
    clearTimeout(timeoutId);
    setIsRinging(false);
    onDecline();
  };

  // Format duration (MM:SS)
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="incoming-call-modal-overlay">
      {/* Animated background blur */}
      <div className="modal-background-blur" />

      {/* Modal card with animations */}
      <div className={`incoming-call-modal ${isRinging ? 'ringing' : ''}`}>
        
        {/* Pulsing ring circles (only when ringing) */}
        {isRinging && (
          <>
            <div className="ringing-circle ring-1" />
            <div className="ringing-circle ring-2" />
            <div className="ringing-circle ring-3" />
          </>
        )}

        {/* Large caller avatar with glow */}
        <div className="caller-avatar-container">
          <div className="avatar-glow" />
          {callerAvatar ? (
            <img 
              src={callerAvatar} 
              alt={callerName} 
              className="caller-avatar"
              onError={(e) => {
                e.target.src = '/default-avatar.png';
              }}
            />
          ) : (
            <div className="avatar-placeholder">
              {callerName?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
        </div>

        {/* Caller information section */}
        <div className="caller-info-section">
          <h2 className="caller-name">{callerName}</h2>
          <p className="caller-email">{callerEmail}</p>
          
          {/* Status with animation */}
          <div className="call-status-wrapper">
            <p className="call-status">
              {isRinging ? (
                <>
                  <span className="status-dot" />
                  Incoming Video Call
                </>
              ) : (
                'Connecting...'
              )}
            </p>
          </div>

          {/* Ring duration & Auto-decline countdown */}
          <div className="call-timers">
            <span className="ring-timer">Ringing: {formatDuration(ringDuration)}</span>
            <span className="countdown-timer">Auto-decline in {autoDeclineCountdown}s</span>
          </div>
        </div>

        {/* Call action buttons */}
        <div className="call-actions">
          {/* Decline button */}
          <button
            className="action-btn decline-btn"
            onClick={handleDecline}
            title="Decline call"
          >
            <span className="btn-icon-wrapper">
              <PhoneOffIcon size={24} color="#ef4444" />
            </span>
            <span className="btn-text">Decline</span>
          </button>

          {/* Accept button */}
          <button
            className="action-btn accept-btn"
            onClick={handleAccept}
            title="Accept call"
          >
            <span className="btn-icon-wrapper">
              <CheckCircleIcon size={24} color="var(--lime)" />
            </span>
            <span className="btn-text">Accept</span>
          </button>
        </div>

        {/* Footer info */}
        <div className="modal-footer">
          <div className="footer-icon">
            <VideoIcon size={14} color="var(--text-dim)" />
          </div>
          <small>Tap Accept to start the video call</small>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;