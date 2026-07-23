import React from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';

export default function PrivacyPolicy() {
    const navigate = useNavigate();

    return (
        <div className="screen legal-screen">
            <button className="legal-back-btn" onClick={() => navigate('/home')} aria-label="Go Back">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
            </button>

            {/* Content Container */}
            <div className="legal-container">
                <div className="legal-hero">
                    <div className="legal-badge">UPDATED JULY 2026</div>
                    <h1 className="legal-title">Privacy Policy</h1>
                    <p className="legal-subtitle">
                        Your privacy is important to us. Learn how GetFit collects, uses, and safeguards your trainer and client data.
                    </p>
                </div>

                <div className="legal-card">
                    <section className="legal-section">
                        <h2>1. Information We Collect</h2>
                        <p>
                            GetFit collects information to provide better services to all our users. The types of personal information we collect include:
                        </p>
                        <ul>
                            <li><strong>Account Information:</strong> Name, email address, password, and profile preferences when you register as a trainer.</li>
                            <li><strong>Client Management Data:</strong> Client names, progress photos, workout history, weights logged, and body metrics that you input as a coach.</li>
                            <li><strong>Scheduling & Slots:</strong> Booking details, availability configurations, calendar entries, and session logs.</li>
                            <li><strong>Usage Data:</strong> Information about how you interact with our application, features used, and timing of active sessions.</li>
                        </ul>
                    </section>

                    <section className="legal-section">
                        <h2>2. How We Use Information</h2>
                        <p>
                            We use the information we collect to operate, maintain, and improve our services, including:
                        </p>
                        <ul>
                            <li>Providing, operating, and maintaining our fitness training dashboard.</li>
                            <li>Facilitating appointment scheduling and client tracking tools.</li>
                            <li>Processing authenticated logins and managing user access securely.</li>
                            <li>Sending you notifications, security updates, and administrative communications.</li>
                        </ul>
                    </section>

                    <section className="legal-section">
                        <h2>3. Integration & Third-Party Services</h2>
                        <p>
                            We use trusted third-party service providers to handle critical application infrastructure:
                        </p>
                        <ul>
                            <li><strong>Supabase:</strong> We use Supabase to handle user authentication, database hosting, single sign-on (SSO), and secure session management. Your data is encrypted in transit and at rest, and Supabase's privacy policy applies to authentication and database logs.</li>
                        </ul>
                    </section>

                    <section className="legal-section">
                        <h2>4. Data Retention & Security</h2>
                        <p>
                            We retain personal data for as long as your account is active or as needed to provide you with services. We implement industry-standard administrative, technical, and physical security measures designed to protect your information from unauthorized access, loss, or alteration.
                        </p>
                    </section>

                    <section className="legal-section">
                        <h2>5. Your Rights & Choices</h2>
                        <p>
                            As a trainer or client, you have controls over your personal details:
                        </p>
                        <ul>
                            <li>You can view, edit, or delete your profile information directly from your Dashboard.</li>
                            <li>You can request the permanent deletion of your trainer account and all associated client data by contacting support.</li>
                            <li>You can opt-out of marketing communications, though essential system notifications will still be sent.</li>
                        </ul>
                    </section>
                </div>
            </div>
        </div>
    );
}
