import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from '../components/Logo';
import { LockIcon, CheckCircleIcon } from '../components/NavIcons';

const validateEmail = (email) => {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
};

const validatePassword = (password) => {
    if (!password || password.length < 8 || password.length > 16) {
        return "Password must be between 8 and 16 characters long.";
    }
    if (!/[A-Z]/.test(password)) {
        return "Password must contain at least one uppercase letter.";
    }
    if (!/\d/.test(password)) {
        return "Password must contain at least one number.";
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
        return "Password must contain at least one special character.";
    }
    return null;
};

export default function ForgotPassword() {
    const navigate = useNavigate();
    const location = useLocation();
    const [step, setStep] = useState(1); // 1: Email, 2: Code, 3: Update Password, 4: Success
    const [email, setEmail] = useState(location.state?.email || '');
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isPasswordFocused, setIsPasswordFocused] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [dialogError, setDialogError] = useState('');
    const [session, setSession] = useState(null);
    const codeRefs = useRef([]);

    const [errors, setErrors] = useState({ email: '', password: '', confirmPassword: '' });

    const handleFieldBlur = (field) => {
        let errorMsg = '';
        if (field === 'email') {
            if (email && !validateEmail(email)) {
                errorMsg = 'Please enter a valid email address.';
            }
        } else if (field === 'password') {
            const pwdErr = validatePassword(password);
            if (password && pwdErr) {
                errorMsg = pwdErr;
            }
        } else if (field === 'confirmPassword') {
            if (confirmPassword && password !== confirmPassword) {
                errorMsg = 'Passwords do not match.';
            }
        }
        setErrors(prev => ({ ...prev, [field]: errorMsg }));
    };

    const handleSendCode = async (e) => {
        e.preventDefault();
        setError('');
        if (!validateEmail(email)) {
            setErrors(prev => ({ ...prev, email: 'Please enter a valid email address.' }));
            return;
        }
        if (errors.email) {
            return;
        }
        setLoading(true);
        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const contentType = response.headers.get('content-type');
            let data;
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                throw new Error('Server returned HTML/Invalid response. Make sure the server is running.');
            }
            if (!response.ok) {
                throw new Error(data.error || 'Failed to send recovery code.');
            }
            setStep(2);
        } catch (err) {
            setError(err.message);
            setDialogError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCodeChange = (index, value) => {
        if (!/^\d*$/.test(value)) return;
        const newCode = [...code];
        newCode[index] = value.slice(-1);
        setCode(newCode);
        if (value && index < 5) {
            codeRefs.current[index + 1]?.focus();
        }
    };

    const handleCodeKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            codeRefs.current[index - 1]?.focus();
        }
    };

    const handleCodePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        const newCode = [...code];
        pasted.split('').forEach((ch, i) => {
            newCode[i] = ch;
        });
        setCode(newCode);
        const focusIndex = Math.min(pasted.length, 5);
        codeRefs.current[focusIndex]?.focus();
    };

    const handleVerifyCode = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const fullCode = code.join('');
            const response = await fetch('/api/auth/verify-recovery-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code: fullCode })
            });
            const contentType = response.headers.get('content-type');
            let data;
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                throw new Error('Server returned HTML/Invalid response. Make sure the server is running.');
            }
            if (!response.ok) {
                throw new Error(data.error || 'Invalid or expired code.');
            }
            setSession(data.session);
            setStep(3);
        } catch (err) {
            setError(err.message);
            setDialogError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        setError('');
        
        let hasError = false;
        const newErrors = { email: '', password: '', confirmPassword: '' };
        
        const pwdError = validatePassword(password);
        if (pwdError) {
            newErrors.password = pwdError;
            hasError = true;
        }
        if (password !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match.';
            hasError = true;
        }

        if (hasError) {
            setErrors(prev => ({ ...prev, ...newErrors }));
            return;
        }

        if (errors.password || errors.confirmPassword) {
            return;
        }

        if (!session?.access_token) {
            setDialogError('Session expired or invalid. Please try again.');
            return;
        }
        setLoading(true);
        try {
            const response = await fetch('/api/auth/update-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ password })
            });
            const contentType = response.headers.get('content-type');
            let data;
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                throw new Error('Server returned HTML/Invalid response. Make sure the server is running.');
            }
            if (!response.ok) {
                throw new Error(data.error || 'Failed to update password.');
            }
            setStep(4);
        } catch (err) {
            setError(err.message);
            setDialogError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBackClick = () => {
        if (step === 1) navigate(-1);
        else if (step === 2) setStep(1);
        else if (step === 3) setStep(2);
    };

    const hasMinLen = password.length >= 8 && password.length <= 16;
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    const getRequirementStyle = (isMet) => ({
        color: isMet ? '#10b981' : 'var(--text-dim)',
        fontSize: '11.5px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'color 0.2s',
        fontWeight: isMet ? '600' : 'normal'
    });

    return (
        <div className="web-auth-wrapper" style={{ position: 'relative' }}>
            {/* Back Button */}
            {step < 4 && (
                <button className="back-btn" onClick={handleBackClick} style={{ zIndex: 10 }}>
                    &#8592;
                </button>
            )}

            <div className="web-auth-container">
                {/* OVERLAY PANEL (LEFT SPLIT) */}
                <div className="overlay-container" style={{ left: 0, width: '50%' }}>
                    <div className="overlay" style={{ left: 0, width: '100%', transform: 'none' }}>
                        <div className="overlay-panel overlay-right" style={{ width: '100%' }}>
                            <span style={{
                                background: 'rgba(0, 0, 0, 0.08)',
                                padding: '6px 16px',
                                borderRadius: '20px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                letterSpacing: '1.5px',
                                textTransform: 'uppercase',
                                color: 'var(--black)',
                                marginBottom: '20px',
                                display: 'inline-block'
                            }}>
                                SECURITY PORTAL
                            </span>

                            <Logo size={50} />

                            <div style={{
                                position: 'relative',
                                margin: '30px auto 20px',
                                width: '110px',
                                height: '110px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(0, 0, 0, 0.05)',
                                borderRadius: '50%',
                                border: '1px dashed rgba(0, 0, 0, 0.15)'
                            }}>
                                <LockIcon />
                            </div>

                            <h1 style={{ fontSize: '38px', marginTop: 10 }}>Account Recovery</h1>
                            <p style={{ marginTop: 15, fontSize: '14px', maxWidth: '320px' }}>
                                Don't worry! Enter your email to securely recover your Trainer profile and reconnect with your clients.
                            </p>
                        </div>
                    </div>
                </div>

                {/* FORM PANEL (RIGHT SPLIT) */}
                <div className="form-container sign-in-container" style={{ width: '50%', left: 'auto', right: 0, opacity: 1, zIndex: 5 }}>
                    {step === 1 && (
                        <form onSubmit={handleSendCode}>
                            <Logo size={50} style={{ marginBottom: 20 }} />
                            <h1 className="auth-title">Reset Password</h1>
                            <p className="auth-subtitle" style={{ marginBottom: 20 }}>
                                Enter your email address to recover your account
                            </p>

                            <div className="field" style={{ marginBottom: errors.email ? 4 : 20 }}>
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    required
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        setErrors(prev => ({ ...prev, email: '' }));
                                    }}
                                    onBlur={() => handleFieldBlur('email')}
                                    disabled={loading}
                                />
                            </div>
                            {errors.email && (
                                <div style={{ color: '#ef4444', fontSize: '11px', textAlign: 'left', marginBottom: 20, paddingLeft: '4px' }}>
                                    {errors.email}
                                </div>
                            )}

                            <button type="submit" className="btn-primary" disabled={loading}>
                                {loading ? 'Sending...' : 'Send Recovery Code'}
                            </button>

                            <p style={{ marginTop: '24px', fontSize: '14px', color: 'var(--text-dim)' }}>
                                Remember your password?{' '}
                                <span 
                                    onClick={() => navigate('/login')} 
                                    style={{ color: 'var(--lime)', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                    Back to login
                                </span>
                            </p>
                        </form>
                    )}

                    {step === 2 && (
                        <form onSubmit={handleVerifyCode}>
                            <Logo size={50} style={{ marginBottom: 20 }} />
                            <h1 className="auth-title">Verify Code</h1>
                            <p className="auth-subtitle" style={{ marginBottom: 20 }}>
                                Please enter the recovery code sent to <strong>{email}</strong>
                            </p>

                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: 20, width: '100%', maxWidth: '360px' }}>
                                {code.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={el => codeRefs.current[i] = el}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={e => handleCodeChange(i, e.target.value)}
                                        onKeyDown={e => handleCodeKeyDown(i, e)}
                                        onPaste={handleCodePaste}
                                        disabled={loading}
                                        style={{
                                            width: '44px',
                                            height: '52px',
                                            background: 'var(--input-bg)',
                                            border: '1px solid var(--input-border)',
                                            borderRadius: '12px',
                                            color: '#fff',
                                            fontSize: '20px',
                                            fontWeight: 'bold',
                                            textAlign: 'center',
                                            outline: 'none',
                                            transition: 'border-color 0.2s'
                                        }}
                                        onFocus={e => e.target.style.borderColor = 'var(--lime)'}
                                        onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
                                    />
                                ))}
                            </div>

                            <button type="submit" className="btn-primary" disabled={loading || code.join('').length < 6}>
                                {loading ? 'Verifying...' : 'Verify Code'}
                            </button>
                        </form>
                    )}

                    {step === 3 && (
                        <form onSubmit={handleUpdatePassword}>
                            <Logo size={50} style={{ marginBottom: 20 }} />
                            <h1 className="auth-title">New Password</h1>
                            <p className="auth-subtitle" style={{ marginBottom: 20 }}>
                                Create a secure new password for your account
                            </p>

                            <div className="field" style={{ marginBottom: errors.password ? 4 : 12 }}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="New Password"
                                    required
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        setErrors(prev => ({ ...prev, password: '' }));
                                    }}
                                    onFocus={() => setIsPasswordFocused(true)}
                                    onBlur={() => {
                                        setIsPasswordFocused(false);
                                        handleFieldBlur('password');
                                    }}
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    className="toggle-visibility"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? 'HIDE' : 'SHOW'}
                                </button>
                            </div>
                            {isPasswordFocused && (
                                <div style={{
                                    fontSize: '11px',
                                    color: 'var(--text-dim)',
                                    textAlign: 'left',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    marginBottom: '12px',
                                    lineHeight: '1.4'
                                }}>
                                    <strong style={{ color: 'var(--lime)' }}>Password requirements:</strong>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                                        <div style={getRequirementStyle(hasMinLen)}>
                                            <span style={{ fontSize: '12px' }}>{hasMinLen ? '✓' : '•'}</span>
                                            8 to 16 characters long
                                        </div>
                                        <div style={getRequirementStyle(hasUppercase)}>
                                            <span style={{ fontSize: '12px' }}>{hasUppercase ? '✓' : '•'}</span>
                                            At least one uppercase letter (A-Z)
                                        </div>
                                        <div style={getRequirementStyle(hasNumber)}>
                                            <span style={{ fontSize: '12px' }}>{hasNumber ? '✓' : '•'}</span>
                                            At least one number (0-9)
                                        </div>
                                        <div style={getRequirementStyle(hasSpecial)}>
                                            <span style={{ fontSize: '12px' }}>{hasSpecial ? '✓' : '•'}</span>
                                            At least one special character (e.g. !, @, #, etc.)
                                        </div>
                                    </div>
                                </div>
                            )}
                            {errors.password && (
                                <div style={{ color: '#ef4444', fontSize: '11px', textAlign: 'left', marginBottom: 12, paddingLeft: '4px' }}>
                                    {errors.password}
                                </div>
                            )}

                            <div className="field" style={{ marginBottom: errors.confirmPassword ? 4 : 20 }}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Confirm New Password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => {
                                        setConfirmPassword(e.target.value);
                                        setErrors(prev => ({ ...prev, confirmPassword: '' }));
                                    }}
                                    onBlur={() => handleFieldBlur('confirmPassword')}
                                    disabled={loading}
                                />
                            </div>
                            {errors.confirmPassword && (
                                <div style={{ color: '#ef4444', fontSize: '11px', textAlign: 'left', marginBottom: 20, paddingLeft: '4px' }}>
                                    {errors.confirmPassword}
                                </div>
                            )}

                            <button type="submit" className="btn-primary" disabled={loading}>
                                {loading ? 'Updating...' : 'Update Password'}
                            </button>
                        </form>
                    )}

                    {step === 4 && (
                        <div className="auth-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', padding: '0 50px', textAlign: 'center' }}>
                            <Logo size={50} style={{ marginBottom: 20 }} />
                            <CheckCircleIcon size={48} color="var(--lime)" style={{ marginBottom: '10px' }} />
                            <h1 className="auth-title" style={{ fontSize: '32px' }}>Password Reset!</h1>
                            <p className="auth-subtitle" style={{ marginBottom: 30, maxWidth: '280px' }}>
                                Your password has been successfully updated. You can now log in with your new password.
                            </p>

                            <button
                                type="button"
                                className="btn-primary"
                                onClick={() => navigate('/login')}
                                style={{ width: '100%', maxWidth: '360px' }}
                            >
                                Back to Login
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Custom Warning Modal overlay */}
            {dialogError && (
                <div className="custom-modal-overlay" style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '20px'
                }}>
                    <div className="custom-modal-card" style={{
                        background: 'var(--card-grad)',
                        border: '1px solid var(--input-border)',
                        borderRadius: '24px',
                        padding: '28px 24px',
                        maxWidth: '340px',
                        width: '100%',
                        textAlign: 'center',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
                    }}>
                        <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--text-light)', margin: '0 0 10px' }}>Error</h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: '0 0 24px', lineHeight: '1.5' }}>{dialogError}</p>
                        <button
                            className="btn-primary"
                            onClick={() => setDialogError('')}
                            style={{ padding: '12px', fontSize: '13px', textTransform: 'uppercase' }}
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
