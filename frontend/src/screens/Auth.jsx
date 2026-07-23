import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from '../components/Logo';

const COUNTRIES = [
    { code: '+92', name: 'PK', length: 10, pattern: /^3\d{9}$/, placeholder: '3001234567', errorMsg: 'Please enter a valid 10-digit mobile number starting with 3.' },
    { code: '+1', name: 'US/CA', length: 10, pattern: /^[2-9]\d{9}$/, placeholder: '2015550123', errorMsg: 'Please enter a valid 10-digit US/CA phone number.' },
    { code: '+44', name: 'UK', length: 10, pattern: /^7\d{9}$/, placeholder: '7911123456', errorMsg: 'Please enter a valid 10-digit UK mobile number starting with 7.' },
    { code: '+966', name: 'SA', length: 9, pattern: /^5\d{8}$/, placeholder: '501234567', errorMsg: 'Please enter a valid 9-digit Saudi mobile number starting with 5.' },
    { code: '+971', name: 'AE', length: 9, pattern: /^5\d{8}$/, placeholder: '501234567', errorMsg: 'Please enter a valid 9-digit UAE mobile number starting with 5.' }
];

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

const validateMobile = (mobile, pattern) => {
    return pattern.test(mobile);
};

export default function Auth() {
    const navigate = useNavigate();
    const location = useLocation();

    const [isLogin, setIsLogin] = useState(location.pathname !== '/signup');

    const [loginForm, setLoginForm] = useState({ email: '', password: '' });
    const [showLoginPass, setShowLoginPass] = useState(false);

    const [signupForm, setSignupForm] = useState({ username: '', email: '', mobile: '', password: '' });
    const [showSignupPass, setShowSignupPass] = useState(false);

    const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);

    const [dialogError, setDialogError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    const [signupErrors, setSignupErrors] = useState({ username: '', email: '', mobile: '', password: '' });
    const [loginErrors, setLoginErrors] = useState({ email: '', password: '' });
    const [isPasswordFocused, setIsPasswordFocused] = useState(false);

    useEffect(() => {
        const storedError = sessionStorage.getItem('auth_error');
        if (storedError) {
            setDialogError(storedError);
            sessionStorage.removeItem('auth_error');
        } else if (location.state?.error) {
            setDialogError(location.state.error);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location, navigate]);

    const handleGoogleAuth = async () => {
        if (googleLoading || loading) return;
        setGoogleLoading(true);
        setDialogError('');

        const action = isLogin ? 'login' : 'signup';

        try {
            const response = await fetch(`/api/auth/google-url?action=${action}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to initialize Google login');
            }

            if (data.url) {
                // Redirect user to the Supabase Google OAuth page
                window.location.href = data.url;
            } else {
                throw new Error('Google authorization URL not found.');
            }
        } catch (err) {
            setDialogError(err.message || 'Google sign-in failed. Please try again.');
            setGoogleLoading(false);
        }
    };

    const handleSignupBlur = (field) => {
        const val = signupForm[field];
        let errorMsg = '';

        if (field === 'username') {
            if (/\d/.test(val)) {
                errorMsg = 'Username must not contain numbers.';
            }
        } else if (field === 'email') {
            if (val && !validateEmail(val)) {
                errorMsg = 'Please enter a valid email address.';
            }
        } else if (field === 'mobile') {
            if (val && !validateMobile(val, selectedCountry.pattern)) {
                errorMsg = selectedCountry.errorMsg;
            }
        } else if (field === 'password') {
            const pwdErr = validatePassword(val);
            if (val && pwdErr) {
                errorMsg = pwdErr;
            }
        }

        setSignupErrors(prev => ({ ...prev, [field]: errorMsg }));
    };

    const handleLoginBlur = (field) => {
        const val = loginForm[field];
        let errorMsg = '';

        if (field === 'email') {
            if (val && !validateEmail(val)) {
                errorMsg = 'Please enter a valid email address.';
            }
        } else if (field === 'password') {
            if (!val) {
                errorMsg = 'Password is required.';
            }
        }

        setLoginErrors(prev => ({ ...prev, [field]: errorMsg }));
    };

    const handleLogin = async (e) => {
        e.preventDefault();

        let hasError = false;
        if (!validateEmail(loginForm.email)) {
            setLoginErrors(prev => ({ ...prev, email: 'Please enter a valid email address.' }));
            hasError = true;
        }
        if (!loginForm.password) {
            setLoginErrors(prev => ({ ...prev, password: 'Password is required.' }));
            hasError = true;
        }

        if (hasError || loginErrors.email || loginErrors.password) {
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginForm)
            });
            const contentType = response.headers.get('content-type');
            let data;
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                throw new Error(`Server returned HTML/Invalid response (Check that the backend server is running and was restarted to load the new endpoints).`);
            }
            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }
            localStorage.setItem('trainer', JSON.stringify(data.trainer));
            localStorage.setItem('session', JSON.stringify(data.session));
            navigate('/dashboard');
        } catch (err) {
            setDialogError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();

        let hasError = false;
        const newErrors = { username: '', email: '', mobile: '', password: '' };

        if (/\d/.test(signupForm.username)) {
            newErrors.username = 'Username must not contain numbers.';
            hasError = true;
        }
        if (!validateEmail(signupForm.email)) {
            newErrors.email = 'Please enter a valid email address.';
            hasError = true;
        }
        if (!validateMobile(signupForm.mobile, selectedCountry.pattern)) {
            newErrors.mobile = selectedCountry.errorMsg;
            hasError = true;
        }
        const pwdError = validatePassword(signupForm.password);
        if (pwdError) {
            newErrors.password = pwdError;
            hasError = true;
        }

        if (hasError) {
            setSignupErrors(newErrors);
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...signupForm,
                    mobile: selectedCountry.code + signupForm.mobile
                })
            });
            const contentType = response.headers.get('content-type');
            let data;
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                throw new Error(`Server returned HTML/Invalid response (Check that the backend server is running and was restarted to load the new endpoints).`);
            }
            if (!response.ok) {
                throw new Error(data.error || 'Signup failed');
            }
            localStorage.setItem('trainer', JSON.stringify(data.trainer));
            if (data.session) {
                localStorage.setItem('session', JSON.stringify(data.session));
            }
            navigate('/dashboard');
        } catch (err) {
            setDialogError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPasswordClick = async () => {
        if (loading) return;
        if (!loginForm.email) {
            setDialogError('Please enter your email address first.');
            return;
        }

        try {
            const response = await fetch('/api/auth/check-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: loginForm.email })
            });
            const contentType = response.headers.get('content-type');
            let data;
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                throw new Error(`Server returned HTML/Invalid response (Check that the backend server is running and was restarted to load the new endpoints).`);
            }
            if (!response.ok) {
                throw new Error(data.error || 'Account check failed.');
            }
            navigate('/forgot-password', { state: { email: loginForm.email } });
        } catch (err) {
            setDialogError(err.message);
        }
    };
    const hasMinLen = signupForm.password.length >= 8 && signupForm.password.length <= 16;
    const hasUppercase = /[A-Z]/.test(signupForm.password);
    const hasNumber = /\d/.test(signupForm.password);
    const hasSpecial = /[^A-Za-z0-9]/.test(signupForm.password);

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
            <button className="back-btn" onClick={() => navigate('/')} style={{ zIndex: 10 }}>&#8592;</button>

            <div className={`web-auth-container ${!isLogin ? 'right-panel-active' : ''}`}>

                <div className="form-container sign-up-container">
                    <form onSubmit={handleSignup}>
                        <Logo size={50} style={{ marginBottom: 20 }} />
                        <h1 className="auth-title">Create Account</h1>
                        <p className="auth-subtitle" style={{ marginBottom: 20 }}>Become a Trainer today</p>

                        <div className="field" style={{ marginBottom: signupErrors.username ? 4 : 12 }}>
                            <input type="text" placeholder="Full Name" required
                                value={signupForm.username}
                                onChange={e => {
                                    const val = e.target.value.replace(/[0-9]/g, '');
                                    setSignupForm({ ...signupForm, username: val });
                                    setSignupErrors(prev => ({ ...prev, username: '' }));
                                }}
                                onBlur={() => handleSignupBlur('username')}
                            />
                        </div>
                        {signupErrors.username && (
                            <div style={{ color: '#ef4444', fontSize: '11px', textAlign: 'left', marginBottom: 12, paddingLeft: '4px' }}>
                                {signupErrors.username}
                            </div>
                        )}

                        <div className="field" style={{ marginBottom: signupErrors.email ? 4 : 12 }}>
                            <input type="email" placeholder="Email" required
                                value={signupForm.email}
                                onChange={e => {
                                    setSignupForm({ ...signupForm, email: e.target.value });
                                    setSignupErrors(prev => ({ ...prev, email: '' }));
                                }}
                                onBlur={() => handleSignupBlur('email')}
                            />
                        </div>
                        {signupErrors.email && (
                            <div style={{ color: '#ef4444', fontSize: '11px', textAlign: 'left', marginBottom: 12, paddingLeft: '4px' }}>
                                {signupErrors.email}
                            </div>
                        )}

                        <div className="field" style={{ marginBottom: signupErrors.mobile ? 4 : 12, position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <select
                                value={selectedCountry.code}
                                onChange={e => {
                                    const code = e.target.value;
                                    const country = COUNTRIES.find(c => c.code === code);
                                    setSelectedCountry(country);
                                    setSignupForm(prev => ({ ...prev, mobile: '' }));
                                    setSignupErrors(prev => ({ ...prev, mobile: '' }));
                                }}
                                disabled={loading}
                                style={{
                                    position: 'absolute',
                                    left: '12px',
                                    width: '80px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-light)',
                                    fontSize: '13px',
                                    fontWeight: 'bold',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    zIndex: 2,
                                    paddingRight: '6px',
                                    textAlign: 'left',
                                    appearance: 'none',
                                    WebkitAppearance: 'none',
                                    MozAppearance: 'none'
                                }}
                            >
                                {COUNTRIES.map(c => (
                                    <option key={c.code} value={c.code} style={{ background: '#121212', color: '#fff', fontSize: '13px' }}>
                                        {c.name} ({c.code})
                                    </option>
                                ))}
                            </select>
                            <span style={{
                                position: 'absolute',
                                left: '92px',
                                height: '18px',
                                borderRight: '1px solid rgba(255, 255, 255, 0.18)',
                                zIndex: 2
                            }} />
                            <input type="tel" placeholder={selectedCountry.placeholder} required
                                style={{ paddingLeft: '105px', width: '100%' }}
                                value={signupForm.mobile}
                                onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, selectedCountry.length);
                                    setSignupForm({ ...signupForm, mobile: val });
                                    setSignupErrors(prev => ({ ...prev, mobile: '' }));
                                }}
                                onBlur={() => handleSignupBlur('mobile')}
                            />
                        </div>
                        {signupErrors.mobile && (
                            <div style={{ color: '#ef4444', fontSize: '11px', textAlign: 'left', marginBottom: 12, paddingLeft: '4px' }}>
                                {signupErrors.mobile}
                            </div>
                        )}

                        <div className="field" style={{ marginBottom: 12 }}>
                            <input type={showSignupPass ? "text" : "password"} placeholder="Password" required
                                value={signupForm.password}
                                onChange={e => {
                                    setSignupForm({ ...signupForm, password: e.target.value });
                                    setSignupErrors(prev => ({ ...prev, password: '' }));
                                }}
                                onFocus={() => setIsPasswordFocused(true)}
                                onBlur={() => {
                                    setIsPasswordFocused(false);
                                    handleSignupBlur('password');
                                }}
                            />
                            <button type="button" className="toggle-visibility" disabled={loading || googleLoading} onClick={() => setShowSignupPass(!showSignupPass)}>
                                {showSignupPass ? 'HIDE' : 'SHOW'}
                            </button>
                        </div>

                        {isPasswordFocused && (
                            <div style={{
                                fontSize: '11px',
                                color: 'var(--text-dim)',
                                textAlign: 'left',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                padding: '12px',
                                borderRadius: '12px',
                                marginBottom: '12px',
                                lineHeight: '1.4',
                                boxSizing: 'border-box',
                                width: '100%'
                            }}>
                                <strong style={{ color: 'var(--lime)', display: 'block', marginBottom: '8px' }}>Password Requirements:</strong>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                        {signupErrors.password && (
                            <div style={{ color: '#ef4444', fontSize: '11px', textAlign: 'left', marginBottom: 12, paddingLeft: '4px' }}>
                                {signupErrors.password}
                            </div>
                        )}

                        <button type="submit" className="btn-primary" disabled={loading || googleLoading}>
                            {loading ? 'Signing up...' : 'Sign Up'}
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '14px 0 10px' }}>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                            <span style={{ fontSize: '11px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>or continue with</span>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleAuth}
                            disabled={googleLoading || loading}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                padding: '11px 16px',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.14)',
                                borderRadius: '12px',
                                color: 'var(--text-light)',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: googleLoading || loading ? 'not-allowed' : 'pointer',
                                opacity: googleLoading || loading ? 0.6 : 1,
                                transition: 'all 0.2s',
                                marginBottom: '4px'
                            }}
                            onMouseOver={e => { if (!googleLoading && !loading) e.currentTarget.style.background = 'rgba(255,255,255,0.11)'; }}
                            onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            {googleLoading ? 'Connecting...' : 'Continue with Google'}
                        </button>

                        <p className="mobile-toggle">
                            Already have an account? <span onClick={() => { setIsLogin(true); navigate('/login', { replace: true }); }}>Log in</span>
                        </p>
                    </form>
                </div>

                <div className="form-container sign-in-container">
                    <form onSubmit={handleLogin}>
                        <Logo size={50} style={{ marginBottom: 20 }} />
                        <h1 className="auth-title">Welcome Back</h1>
                        <p className="auth-subtitle" style={{ marginBottom: 20 }}>Log in to manage your clients</p>

                        <div className="field" style={{ marginBottom: loginErrors.email ? 4 : 12 }}>
                            <input type="email" placeholder="Email" required
                                value={loginForm.email}
                                onChange={e => {
                                    setLoginForm({ ...loginForm, email: e.target.value });
                                    setLoginErrors(prev => ({ ...prev, email: '' }));
                                }}
                                onBlur={() => handleLoginBlur('email')}
                            />
                        </div>
                        {loginErrors.email && (
                            <div style={{ color: '#ef4444', fontSize: '11px', textAlign: 'left', marginBottom: 12, paddingLeft: '4px' }}>
                                {loginErrors.email}
                            </div>
                        )}

                        <div className="field" style={{ marginBottom: loginErrors.password ? 4 : 12 }}>
                            <input type={showLoginPass ? "text" : "password"} placeholder="Password" required
                                value={loginForm.password}
                                onChange={e => {
                                    setLoginForm({ ...loginForm, password: e.target.value });
                                    setLoginErrors(prev => ({ ...prev, password: '' }));
                                }}
                                onBlur={() => handleLoginBlur('password')}
                            />
                            <button type="button" className="toggle-visibility" disabled={loading || googleLoading} onClick={() => setShowLoginPass(!showLoginPass)}>
                                {showLoginPass ? 'HIDE' : 'SHOW'}
                            </button>
                        </div>
                        {loginErrors.password && (
                            <div style={{ color: '#ef4444', fontSize: '11px', textAlign: 'left', marginBottom: 12, paddingLeft: '4px' }}>
                                {loginErrors.password}
                            </div>
                        )}
                        <button type="button" className="forgot-link" disabled={loading} onClick={handleForgotPasswordClick} style={{ marginBottom: 20 }}>
                            forgot password?
                        </button>

                        <button type="submit" className="btn-primary" disabled={loading || googleLoading}>
                            {loading ? 'Logging in...' : 'Log In'}
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '14px 0 10px' }}>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                            <span style={{ fontSize: '11px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>or continue with</span>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleAuth}
                            disabled={googleLoading || loading}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                padding: '11px 16px',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.14)',
                                borderRadius: '12px',
                                color: 'var(--text-light)',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: googleLoading || loading ? 'not-allowed' : 'pointer',
                                opacity: googleLoading || loading ? 0.6 : 1,
                                transition: 'all 0.2s',
                                marginBottom: '4px'
                            }}
                            onMouseOver={e => { if (!googleLoading && !loading) e.currentTarget.style.background = 'rgba(255,255,255,0.11)'; }}
                            onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            {googleLoading ? 'Connecting...' : 'Continue with Google'}
                        </button>

                        <p className="mobile-toggle">
                            Don't have an account? <span onClick={() => { setIsLogin(false); navigate('/signup', { replace: true }); }}>Sign up</span>
                        </p>
                    </form>
                </div>

                <div className="overlay-container">
                    <div className="overlay">
                        <div className="overlay-panel overlay-left">
                            <Logo size={60} />
                            <h1>Already a Trainer?</h1>
                            <p>To keep connected with your clients, please log in with your personal info</p>
                            <button className="ghost" onClick={() => { setIsLogin(true); navigate('/login', { replace: true }); }}>Log In</button>
                        </div>

                        <div className="overlay-panel overlay-right">
                            <Logo size={60} />
                            <h1>New Here?</h1>
                            <p>Enter your details and start your journey with GetFit today</p>
                            <button className="ghost" onClick={() => { setIsLogin(false); navigate('/signup', { replace: true }); }}>Sign Up</button>
                        </div>
                    </div>
                </div>
            </div>

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