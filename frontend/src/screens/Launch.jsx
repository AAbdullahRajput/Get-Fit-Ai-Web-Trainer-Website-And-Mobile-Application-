import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthenticateWithRedirectCallback, useAuth } from '@clerk/clerk-react'
import Logo from '../components/Logo'

// Launch-1 / Launch-2: lime loading screen -> Launch-3: hero image screen -> auto go to Login
export default function Launch() {
    const navigate = useNavigate()
    const [progress, setProgress] = useState(0)
    const { isSignedIn, isLoaded: authLoaded } = useAuth()

    const hasClerkStatus = new URLSearchParams(window.location.search).has('__clerk_status')

    useEffect(() => {
        if (!authLoaded) return;
        if (hasClerkStatus) return;

        // If already signed into Clerk, redirect immediately to callback handler
        if (isSignedIn) {
            navigate('/sso-callback');
            return;
        }

        const interval = setInterval(() => {
            setProgress((p) => {
                if (p >= 100) {
                    clearInterval(interval)
                    // Navigate to the new Landing page after a short delay so user sees 100%
                    setTimeout(() => navigate('/home'), 400)
                    return 100
                }
                // Randomize progress jumps slightly for realism
                return Math.min(p + Math.floor(Math.random() * 10) + 2, 100)
            })
        }, 80)
        return () => clearInterval(interval)
    }, [navigate, hasClerkStatus, isSignedIn, authLoaded])

    if (hasClerkStatus) {
        return (
            <div className="screen launch-screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-dark)' }}>
                <Logo size={80} />
                <div className="launch-loading" style={{ marginTop: '24px', textAlign: 'center' }}>
                    <span className="label" style={{ color: 'var(--lime)', fontSize: '14px', letterSpacing: '2px', fontWeight: 'bold' }}>SSO PROCESSING...</span>
                </div>
                <AuthenticateWithRedirectCallback />
            </div>
        );
    }

    return (
        <div className="screen launch-screen">
            <Logo size={80} />
            <div className="launch-loading">
                <span className="label">LOADING... {progress}%</span>
                <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                    <div 
                        className="progress-circle" 
                        style={{ left: `calc(${progress}% - ${progress * 0.36}px)` }} 
                    />
                </div>
            </div>
        </div>
    )
}
