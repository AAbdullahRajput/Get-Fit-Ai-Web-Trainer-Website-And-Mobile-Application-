import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from '../components/Logo';

export default function SsoCallback() {
    const navigate = useNavigate();
    const location = useLocation();
    const backendCalledRef = useRef(false);

    useEffect(() => {
        const verifyUserAndLogin = async () => {
            if (backendCalledRef.current) return;

            // Parse URL parameters from query (main.jsx rewrote hash parameters into query search parameters)
            const params = new URLSearchParams(location.search);
            const accessToken = params.get('access_token');
            const action = params.get('action') || 'login';

            if (!accessToken) {
                console.error('No access token found in URL hash/query');
                sessionStorage.setItem('auth_error', 'Invalid Google authentication session. Please try again.');
                navigate(action === 'signup' ? '/signup' : '/login');
                return;
            }

            backendCalledRef.current = true;

            try {
                // Call the backend to verify the Supabase token and complete profile checks
                const response = await fetch('/api/auth/google-oauth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accessToken, action })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Google authentication failed');
                }

                // Store trainer profile and session details locally
                localStorage.setItem('trainer', JSON.stringify(data.trainer));
                if (data.session) {
                    localStorage.setItem('session', JSON.stringify(data.session));
                }

                // If trainer profile is incomplete (e.g. missing phone_number), redirect to profile tab
                if (!data.trainer?.phone_number) {
                    navigate('/dashboard?tab=profile');
                } else {
                    navigate('/dashboard');
                }
            } catch (err) {
                console.error('Google OAuth callback error:', err);
                // Save error in sessionStorage to display as a custom modal dialog on the target screen
                sessionStorage.setItem('auth_error', err.message || 'Google authentication failed');
                // Redirect user back to the appropriate form
                navigate(action === 'signup' ? '/signup' : '/login');
            }
        };

        verifyUserAndLogin();
    }, [location, navigate]);

    return (
        <div className="screen launch-screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--near-black)' }}>
            <Logo size={80} />
            <div className="launch-loading" style={{ marginTop: '24px', textAlign: 'center' }}>
                <span className="label" style={{ color: 'var(--lime)', fontSize: '14px', letterSpacing: '2px', fontWeight: 'bold' }}>COMPLETING LOGIN...</span>
                <div className="progress-track" style={{ width: '140px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '12px', overflow: 'hidden', position: 'relative', margin: '12px auto 0' }}>
                    <div className="progress-fill" style={{
                        width: '100%',
                        height: '100%',
                        background: 'var(--lime)',
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        animation: 'loading-bar 1.5s infinite ease-in-out'
                    }} />
                </div>
            </div>

            <style>{`
                @keyframes loading-bar {
                    0% { left: -100%; right: 100%; }
                    50% { left: 0%; right: 0%; }
                    100% { left: 100%; right: -100%; }
                }
            `}</style>
        </div>
    );
}