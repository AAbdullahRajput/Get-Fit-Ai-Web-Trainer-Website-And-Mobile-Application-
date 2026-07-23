import React from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';

export default function TermsConditions() {
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
                    <h1 className="legal-title">Terms & Conditions</h1>
                    <p className="legal-subtitle">
                        Please read these terms carefully before accessing or using the GetFit platforms and services.
                    </p>
                </div>

                <div className="legal-card">
                    <section className="legal-section">
                        <h2>1. Agreement to Terms</h2>
                        <p>
                            By creating a GetFit trainer account, or by accessing the GetFit website and mobile shell platforms, you agree to be bound by these Terms and Conditions. If you do not agree to all of these terms, do not access or use our services.
                        </p>
                    </section>

                    <section className="legal-section">
                        <h2>2. Account Creation & Eligibility</h2>
                        <p>
                            To register as a trainer or coach, you must provide accurate, current, and complete information. You are solely responsible for:
                        </p>
                        <ul>
                            <li>Maintaining the confidentiality of your credentials and account session keys.</li>
                            <li>All activities that occur under your trainer account.</li>
                            <li>Notifying us immediately of any unauthorized use or security breach of your credentials.</li>
                        </ul>
                    </section>

                    <section className="legal-section">
                        <h2>3. Trainer & Coach Responsibilities</h2>
                        <p>
                            As a fitness professional using our dashboard to track and coach clients, you represent and warrant that:
                        </p>
                        <ul>
                            <li>You possess all necessary certifications, permits, and credentials required to practice in your jurisdiction.</li>
                            <li>You will obtain all required health screen approvals and waivers directly from your clients before beginning any exercise regimen.</li>
                            <li>You are solely responsible for designing safe, appropriate training slots, schedules, and custom programs.</li>
                        </ul>
                    </section>

                    <section className="legal-section">
                        <h2>4. Health & Liability Disclaimer</h2>
                        <p>
                            <strong>GETFIT IS NOT A MEDICAL SERVICE.</strong> The software platform provides tools for tracking fitness metrics, logging weights, and scheduling training slots.
                        </p>
                        <p>
                            We do not provide medical advice, diagnosis, or treatment planning. All information stored or shared through the platform is for informational purposes only. The use of any information provided is solely at your and your clients' own risk.
                        </p>
                    </section>

                    <section className="legal-section">
                        <h2>5. Subscriptions & Payments</h2>
                        <p>
                            Certain premium trainer features may require payment of licensing or subscription fees. By subscribing to these tiers, you agree to:
                        </p>
                        <ul>
                            <li>Pay all recurring fees, taxes, and transaction charges associated with your plan.</li>
                            <li>Authorize GetFit to charge your specified payment method on a recurring basis.</li>
                            <li>Request cancellations prior to the renewal date. All fees paid are non-refundable unless stated otherwise.</li>
                        </ul>
                    </section>

                    <section className="legal-section">
                        <h2>6. Prohibited Activities</h2>
                        <p>
                            You agree not to engage in any of the following prohibited behaviors:
                        </p>
                        <ul>
                            <li>Uploading or transmitting offensive, abusive, or defamatory content regarding clients or other trainers.</li>
                            <li>Disrupting, hacking, or bypassing security controls on the GetFit hosting nodes.</li>
                            <li>Sharing credentials or allowing unauthorized third parties to manage your client portal.</li>
                        </ul>
                    </section>

                    <section className="legal-section">
                        <h2>7. Limitation of Liability</h2>
                        <p>
                            To the maximum extent permitted by law, GetFit, its officers, employees, and database hosts shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, arising out of the use of, or inability to use, our coaching platform.
                        </p>
                    </section>

                    <section className="legal-section">
                        <h2>8. Termination of Accounts</h2>
                        <p>
                            We reserve the right to suspend or terminate your trainer account and delete associated data at our sole discretion, without notice, if we believe you have breached these terms, engaged in unlawful behavior, or harmed the reputation of the GetFit community.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
