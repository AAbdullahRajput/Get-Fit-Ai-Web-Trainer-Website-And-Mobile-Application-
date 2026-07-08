import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function OtpVerification() {
    const navigate = useNavigate()
    const [otp, setOtp] = useState(['', '', '', ''])
    const [seconds, setSeconds] = useState(50)
    const inputsRef = useRef([])

    useEffect(() => {
        if (seconds <= 0) return
        const t = setInterval(() => setSeconds((s) => s - 1), 1000)
        return () => clearInterval(t)
    }, [seconds])

    const handleChange = (idx, val) => {
        if (!/^[0-9]?$/.test(val)) return
        const next = [...otp]
        next[idx] = val
        setOtp(next)
        if (val && idx < 3) inputsRef.current[idx + 1]?.focus()
    }

    const handleVerify = (e) => {
        e.preventDefault()
        // TODO: verify code with backend
        navigate('/dashboard')
    }

    const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
    const ss = String(seconds % 60).padStart(2, '0')

    return (
        <div className="screen auth-screen">
            <div className="auth-hero" style={{ minHeight: 160, height: '22%' }}>
                <button className="back-btn" onClick={() => navigate(-1)}>&#8592;</button>
            </div>

            <form className="auth-card" onSubmit={handleVerify}>
                <div>
                    <h1 className="auth-title">Verification</h1>
                    <p className="auth-subtitle">We've sent a code to verify your account</p>
                </div>

                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: -6 }}>Mobile OTP</p>
                <div className="otp-boxes">
                    {otp.map((digit, i) => (
                        <input
                            key={i}
                            ref={(el) => (inputsRef.current[i] = el)}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleChange(i, e.target.value)}
                            className="field-otp"
                            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-light)' }}
                        />
                    ))}
                </div>

                <p className="otp-resend">
                    Resend :{' '}
                    {seconds > 0 ? <span className="timer">{mm}:{ss}</span> : (
                        <button type="button" className="link" style={{ color: 'var(--lime)', fontWeight: 700 }} onClick={() => setSeconds(50)}>
                            Resend now
                        </button>
                    )}
                </p>

                <button type="submit" className="btn-primary">Verify</button>
            </form>
        </div>
    )
}
