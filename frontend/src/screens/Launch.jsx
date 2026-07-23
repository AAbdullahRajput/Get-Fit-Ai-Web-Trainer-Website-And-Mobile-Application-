import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'

export default function Launch() {
    const navigate = useNavigate()
    const [progress, setProgress] = useState(0)

    useEffect(() => {
        const session = localStorage.getItem('session');
        const trainer = localStorage.getItem('trainer');

        // If already signed in, redirect straight to dashboard
        if (session && trainer) {
            navigate('/dashboard');
            return;
        }

        const interval = setInterval(() => {
            setProgress((p) => {
                if (p >= 100) {
                    clearInterval(interval)
                    // Navigate to the Landing page after a short delay so user sees 100%
                    setTimeout(() => navigate('/home'), 400)
                    return 100
                }
                // Randomize progress jumps slightly for realism
                return Math.min(p + Math.floor(Math.random() * 10) + 2, 100)
            })
        }, 80)
        return () => clearInterval(interval)
    }, [navigate])

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
