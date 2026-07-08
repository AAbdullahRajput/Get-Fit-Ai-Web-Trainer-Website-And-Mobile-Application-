import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useAuth, useClerk } from '@clerk/clerk-react';
import Logo from '../components/Logo';

export default function SsoCallback() {
    const navigate = useNavigate();
    const { user, isLoaded: userLoaded } = useUser();
    const { isSignedIn, isLoaded: authLoaded } = useAuth();
    const clerk = useClerk();
    const backendCalledRef = useRef(false);

    useEffect(() => {
        const verifyUserAndLogin = async () => {
            if (userLoaded && authLoaded && isSignedIn && user && !backendCalledRef.current) {
                backendCalledRef.current = true;

                const email = user.primaryEmailAddress?.emailAddress;
                const name = user.fullName || user.firstName || email?.split('@')[0];
                const clerkUserId = user.id;

                const params = new URLSearchParams(window.location.hash.split('?')[1] || window.location.search);
                let action = params.get('action');

                // Read and clear oauth_intent from sessionStorage
                const storedIntent = sessionStorage.getItem('oauth_intent');
                if (!action && storedIntent) {
                    action = storedIntent;
                }
                sessionStorage.removeItem('oauth_intent');

                if (email) {
                    try {
                        const response = await fetch('/api/auth/google-oauth', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email, name, clerkUserId, action })
                        });
                        const data = await response.json();
                        if (!response.ok) throw new Error(data.error || 'Google sign-in failed');

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
                        const errMsg = err.message || 'Google login failed';
                        sessionStorage.setItem('auth_error', errMsg);
                        try {
                            await clerk.signOut({ redirectUrl: window.location.origin + '/login' });
                        } catch (signOutErr) {
                            console.error('Clerk signOut error during callback failure:', signOutErr);
                            navigate('/login', { state: { error: errMsg } });
                        }
                    }
                }
            }
        };

        verifyUserAndLogin();
    }, [userLoaded, authLoaded, isSignedIn, user, navigate, clerk]);

    return (
        <div className="screen launch-screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-dark)' }}>
            <Logo size={80} />
            <div className="launch-loading" style={{ marginTop: '24px' }}>
                <span className="label" style={{ color: 'var(--lime)', fontSize: '14px', letterSpacing: '2px', fontWeight: 'bold' }}>COMPLETING LOGIN...</span>
                <div className="progress-track" style={{ width: '140px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '12px', overflow: 'hidden', position: 'relative' }}>
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