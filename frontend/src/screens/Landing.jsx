import React from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { CalendarIcon, TrendingUpIcon, MessageIcon } from '../components/NavIcons';

export default function Landing() {
    const navigate = useNavigate();

    return (
        <div className="landing-page">
            {/* Navbar */}
            <nav className="landing-nav">
                <Logo size={40} />
                <div className="nav-actions">
                    <button className="btn-nav-login" onClick={() => navigate('/login')}>Log In</button>
                </div>
            </nav>

            {/* Hero Section (Dark) */}
            <header className="landing-hero">
                <div className="hero-content">
                    <div className="badge">NEW: Advanced Client Tracking</div>
                    <h1 className="hero-title">Train Smarter.<br />Scale Faster.</h1>
                    <p className="hero-subtitle">
                        The ultimate platform for personal trainers. Manage your clients, schedule sessions,
                        track progress, and grow your fitness business—all in one place.
                    </p>
                    <div className="hero-actions">
                        <button className="btn-primary hero-btn" onClick={() => navigate('/signup')}>
                            Get Started
                        </button>
                        <button className="btn-secondary hero-btn" onClick={() => navigate('/login')}>
                            Trainer Login
                        </button>
                    </div>

                    <div className="hero-quote">
                        <p className="quote-text">"Empowering personal trainers to deliver elite coaching, track progress effortlessly, and scale their business without limits."</p>
                        <p className="quote-author">— Built For Trainers, By Trainers</p>
                    </div>
                </div>

                {/* Decorative Visual Element */}
                <div className="hero-visual">
                    <div className="hero-image-wrapper">
                        <img src="/hero-phone.png" alt="GetFit Showcase" className="hero-showcase-image" />
                        <div className="hero-image-overlay"></div>
                    </div>
                    <div className="floating-card card-1">
                        <div className="stat">18</div>
                        <div className="label">Active Clients</div>
                    </div>
                    <div className="floating-card card-2">
                        <div className="stat">450+</div>
                        <div className="label">Workouts Logged</div>
                    </div>
                    <div className="floating-card card-3">
                        <div className="stat">4.9★</div>
                        <div className="label">Avg Rating</div>
                    </div>
                </div>
            </header>

            {/* Features Section (Lime) */}
            <section className="landing-features">
                <div className="features-container">
                    <h2 className="section-title">Everything you need to dominate.</h2>
                    <p className="section-subtitle">Stop juggling spreadsheets and apps. GetFit gives you powerful tools to manage your entire client roster effortlessly.</p>

                    <div className="features-grid">
                        <div className="feature-card">
                            <div className="feature-icon"><CalendarIcon /></div>
                            <h3>Smart Scheduling</h3>
                            <p>Book sessions, manage your calendar, and automatically notify clients of upcoming workouts without lifting a finger.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon"><TrendingUpIcon /></div>
                            <h3>Progress Tracking</h3>
                            <p>Log weights, body metrics, and personal records. Show your clients their exact progress over time with beautiful charts.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon"><MessageIcon /></div>
                            <h3>Direct Messaging</h3>
                            <p>Keep your clients accountable. Send automated check-ins and chat directly within the app.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Bottom CTA (Dark) */}
            <section className="landing-cta">
                <div className="cta-container">
                    <h2>Ready to level up your coaching?</h2>
                    <p>Join thousands of elite trainers who are scaling their business with GetFit.</p>
                    <button className="btn-primary hero-btn" onClick={() => navigate('/signup')} style={{ marginTop: 20 }}>
                        Create Your Account
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="footer-content">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Logo size={40} className="footer-logo" />
                        <p className="footer-text" style={{ margin: 0 }}>&copy; 2026 GetFit. All rights reserved. Designed for elite coaches.</p>
                    </div>
                    <div className="footer-links" style={{ display: 'flex', gap: '20px' }}>
                        <span className="footer-nav-link" onClick={() => navigate('/privacy-policy')}>
                            Privacy Policy
                        </span>
                        <span className="footer-nav-link" onClick={() => navigate('/terms-conditions')}>
                            Terms & Conditions
                        </span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
