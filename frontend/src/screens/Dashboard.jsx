import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { HomeIcon, HistoryIcon, BookingsIcon, ProfileIcon, SlotsIcon, FolderIcon, ClockIcon, PartyIcon, WarningIcon } from '../components/NavIcons'

const getMobileDisplay = (phone) => {
    if (!phone) return '';
    if (phone.startsWith('+92')) return phone.substring(3);
    if (phone.startsWith('92')) return phone.substring(2);
    if (phone.startsWith('03') && phone.length === 11) return phone.substring(1);
    return phone;
};

const validateEmail = (email) => {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
};

const validateMobile = (mobile) => {
    return /^3\d{9}$/.test(mobile);
};

const NAV_ITEMS = [
    { key: 'home', label: 'Home', icon: <HomeIcon /> },
    { key: 'bookings', label: 'Bookings', icon: <BookingsIcon /> },
    { key: 'slots', label: 'Slots', icon: <SlotsIcon /> },
    { key: 'history', label: 'History', icon: <HistoryIcon /> },
    { key: 'profile', label: 'Profile', icon: <ProfileIcon /> },
]

const getCroppedImgBase64 = (imageSrc, x, y, zoomVal) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = imageSrc;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const C = 200; // Canvas size (200x200)
            canvas.width = C;
            canvas.height = C;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#1e1e1e';
            ctx.fillRect(0, 0, C, C);

            const initScale = Math.max(C / img.naturalWidth, C / img.naturalHeight);
            const wDisp = img.naturalWidth * initScale;
            const hDisp = img.naturalHeight * initScale;
            const wEff = wDisp * zoomVal;
            const hEff = hDisp * zoomVal;
            const dx = (C / 2) - (wEff / 2) + x;
            const dy = (C / 2) - (hEff / 2) + y;

            ctx.drawImage(img, dx, dy, wEff, hEff);
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = (err) => reject(err);
    });
};

export default function Dashboard() {
    const navigate = useNavigate()
    const location = useLocation()
    const [activeTab, setActiveTab] = useState(() => {
        const params = new URLSearchParams(location.search);
        return params.get('tab') || 'home';
    });

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab') || 'home';
        if (tab !== activeTab) {
            setActiveTab(tab);
        }
    }, [location.search]);

    const [loggingOut, setLoggingOut] = useState(false);
    const [trainer, setTrainer] = useState(() => {
        const trainerString = localStorage.getItem('trainer');
        return trainerString ? JSON.parse(trainerString) : null;
    });
    const [updateLoading, setUpdateLoading] = useState(false);
    const [updateSuccess, setUpdateSuccess] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(trainer?.image_url || '');
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imgIsPortrait, setImgIsPortrait] = useState(false);
    const [croppedImageBase64, setCroppedImageBase64] = useState(null);
    const [isCropConfirmed, setIsCropConfirmed] = useState(false);
    const [cacheBuster, setCacheBuster] = useState(Date.now());
    const [showFullImageModal, setShowFullImageModal] = useState(false);

    const [clients, setClients] = useState([]);
    const [clientsLoading, setClientsLoading] = useState(false);
    const [clientsError, setClientsError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedClientId, setExpandedClientId] = useState(null);
    const [homeExpandedClientId, setHomeExpandedClientId] = useState(null);
    const [expandedApptId, setExpandedApptId] = useState(null);
    const [visibleCount, setVisibleCount] = useState(5);
    const [visibleHomeClientsCount, setVisibleHomeClientsCount] = useState(5);
    const [visibleBookingsCount, setVisibleBookingsCount] = useState(5);
    const [profileErrors, setProfileErrors] = useState({ email: '', mobile: '' });

    const fetchClients = async () => {
        setClientsLoading(true);
        setClientsError('');
        try {
            const sessionString = localStorage.getItem('session');
            const session = sessionString ? JSON.parse(sessionString) : null;
            if (!session?.access_token) {
                setClientsLoading(false);
                return;
            }

            const response = await fetch('/api/slots/clients', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const errMsg = "Expected JSON response but got non-JSON format. The backend server might need a restart.";
                console.warn(errMsg);
                setClientsError(errMsg);
                setClients([]);
                return;
            }

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to fetch clients');
            setClients(data.clients || []);
        } catch (err) {
            console.error('Error fetching clients:', err);
            setClientsError(err.message || 'Failed to fetch clients');
            // If it's a parsing error or connection issue, fallback to empty clients list gracefully
            setClients([]);
        } finally {
            setClientsLoading(false);
        }
    };

    useEffect(() => {
        fetchClients();
    }, []);

    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        const parts = timeStr.split(':');
        const hour = parseInt(parts[0], 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
        return `${displayHour}:${parts[1]} ${ampm}`;
    };

    useEffect(() => {
        if (trainer?.image_url) {
            setPreviewUrl(trainer.image_url);
        }
    }, [trainer]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            setZoom(1);
            setOffset({ x: 0, y: 0 });
            setPreviewUrl(URL.createObjectURL(file));
            setIsCropConfirmed(false);
            setCroppedImageBase64(null);
        }
    };

    const handleImageLoad = (e) => {
        const { naturalWidth, naturalHeight } = e.target;
        setImgIsPortrait(naturalWidth < naturalHeight);
    };

    const handleConfirmCrop = async () => {
        if (!selectedFile) return;
        try {
            const base64 = await getCroppedImgBase64(previewUrl, offset.x, offset.y, zoom);
            setCroppedImageBase64(base64);
            setIsCropConfirmed(true);
        } catch (err) {
            console.error("Error cropping image:", err);
            setErrorMsg("Failed to crop image.");
        }
    };

    const handleMouseDown = (e) => {
        if (!selectedFile) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        setOffset({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleTouchStart = (e) => {
        if (!selectedFile || e.touches.length !== 1) return;
        setIsDragging(true);
        setDragStart({
            x: e.touches[0].clientX - offset.x,
            y: e.touches[0].clientY - offset.y
        });
    };

    const handleTouchMove = (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        setOffset({
            x: e.touches[0].clientX - dragStart.x,
            y: e.touches[0].clientY - dragStart.y
        });
    };

    const handleProfileBlur = (field, val) => {
        let errorMsg = '';
        if (field === 'email') {
            if (val && !validateEmail(val)) {
                errorMsg = 'Please enter a valid email address.';
            }
        } else if (field === 'mobile') {
            if (val && !validateMobile(val)) {
                errorMsg = 'Please enter a valid Pakistani mobile number starting with 3 (10 digits, e.g., 3001234567).';
            }
        }
        setProfileErrors(prev => ({ ...prev, [field]: errorMsg }));
    };

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setUpdateLoading(true);
        setUpdateSuccess('');
        setErrorMsg('');

        const formElements = e.target.elements;
        const updatedFields = {};

        // Retrieve and parse values
        const emailVal = formElements.email.value;
        const mobileVal = formElements.mobile.value;
        const experienceVal = formElements.experience.value;
        const trainingTypeVal = formElements.training_type.value;
        const bioVal = formElements.bio.value;
        const sessionPriceVal = formElements.session_price.value;

        let hasError = false;
        const newErrors = { email: '', mobile: '' };

        if (!validateEmail(emailVal)) {
            newErrors.email = 'Please enter a valid email address.';
            hasError = true;
        }

        if (!validateMobile(mobileVal)) {
            newErrors.mobile = 'Please enter a valid Pakistani mobile number starting with 3 (10 digits, e.g., 3001234567).';
            hasError = true;
        }

        const parsedPrice = parseFloat(sessionPriceVal);
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
            setErrorMsg("Session price must be a positive number.");
            setUpdateLoading(false);
            return;
        }

        if (hasError) {
            setProfileErrors(newErrors);
            setUpdateLoading(false);
            return;
        }

        if (profileErrors.email || profileErrors.mobile) {
            setUpdateLoading(false);
            return;
        }

        const fullMobileVal = `+92${mobileVal}`;

        let imageBase64 = croppedImageBase64;
        let imageName = null;

        if (selectedFile) {
            imageName = selectedFile.name;
            if (!imageBase64) {
                try {
                    imageBase64 = await getCroppedImgBase64(previewUrl, offset.x, offset.y, zoom);
                } catch (err) {
                    setErrorMsg("Failed to process and crop the image.");
                    setUpdateLoading(false);
                    return;
                }
            }
        }

        // Compile only fields that changed
        const defaultBio = "Elite fitness coach helping professionals get in shape. Let's achieve your goals together!";
        if (emailVal !== (trainer?.email || 'trainer@getfit.com')) updatedFields.email = emailVal;
        if (fullMobileVal !== (trainer?.phone_number || '')) updatedFields.phone_number = fullMobileVal;
        if (experienceVal !== (trainer?.experience || '0 years')) updatedFields.experience = experienceVal;
        if (trainingTypeVal !== (trainer?.training_type || 'General')) updatedFields.training_type = trainingTypeVal;
        if (bioVal !== (trainer?.bio || defaultBio)) updatedFields.bio = bioVal;
        
        const currentPrice = trainer?.session_price !== undefined ? parseFloat(trainer.session_price) : 48.00;
        if (parsedPrice !== currentPrice) updatedFields.session_price = parsedPrice;

        if (selectedFile && imageBase64) {
            updatedFields.image_base64 = imageBase64;
            updatedFields.image_name = imageName;
        }

        if (Object.keys(updatedFields).length === 0) {
            setErrorMsg("No changes detected.");
            setUpdateLoading(false);
            return;
        }

        try {
            const sessionString = localStorage.getItem('session');
            const session = sessionString ? JSON.parse(sessionString) : null;
            if (!session?.access_token) return;

            const response = await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(updatedFields)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to update profile');
            }

            setTrainer(data.trainer);
            localStorage.setItem('trainer', JSON.stringify(data.trainer));
            setCacheBuster(Date.now());
            setSelectedFile(null);
            setCroppedImageBase64(null);
            setIsCropConfirmed(false);
            setUpdateSuccess('Profile updated successfully!');
            setTimeout(() => setUpdateSuccess(''), 3000);
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setUpdateLoading(false);
        }
    };

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const sessionString = localStorage.getItem('session');
                const session = sessionString ? JSON.parse(sessionString) : null;
                if (!session?.access_token) return;

                const response = await fetch('/api/auth/profile', {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                });
                if (!response.ok) throw new Error('Failed to fetch profile');
                const data = await response.json();
                if (data.trainer) {
                    setTrainer(data.trainer);
                    localStorage.setItem('trainer', JSON.stringify(data.trainer));
                }
            } catch (err) {
                console.error('Error fetching live profile:', err);
                setErrorMsg('Failed to sync profile: ' + (err.message || 'Server error'));
            }
        };
        fetchProfile();
    }, []);



    const trainerName = trainer?.name || trainer?.username || 'Trainer';
    const trainerEmail = trainer?.email || 'trainer@getfit.com';
    const trainerInitials = trainerName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'TR';

    const handleLogout = () => {
        setLoggingOut(true);
        localStorage.clear();
        navigate('/login', { replace: true });
    };

    const handleBack = () => {
        if (activeTab !== 'home') {
            setActiveTab('home');
        } else {
            navigate('/home');
        }
    };

    const renderHome = () => {
        const completedSessionsCount = clients.reduce((acc, c) => {
            const passed = c.booked_slots.filter(s => {
                const slotDateTime = new Date(`${s.slot_date}T${s.start_time}`);
                const now = new Date();
                return slotDateTime < now;
            }).length;
            return acc + passed;
        }, 0);

        const totalCompleted = clientsLoading ? '...' : (completedSessionsCount || trainer?.training_completed || 0);

        return (
            <>
                <div className="dash-section">
                    <div className="section-head">
                        <h3>Overview</h3>
                    </div>
                    <div className="stat-grid">
                        <div className="stat-card">
                            <div className="stat-value">{clientsLoading ? '...' : (clients.length || trainer?.active_clients || 0)}</div>
                            <div className="stat-label">Active Clients</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{totalCompleted}</div>
                            <div className="stat-label">Completed Sessions</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{trainer?.experience || '0 years'}</div>
                            <div className="stat-label">Experience</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{trainer?.rating ? `${trainer.rating} ★` : '0.0 ★'}</div>
                            <div className="stat-label">Avg. Rating</div>
                        </div>
                    </div>
                </div>

                <div className="dash-section">
                    <div className="section-head">
                        <h3>Upcoming Appointments</h3>
                        <span className="see-all" onClick={() => {
                            setActiveTab('bookings');
                            navigate('/dashboard?tab=bookings', { replace: true });
                        }}>See all</span>
                    </div>
                    <div className="session-list">
                        {clientsLoading ? (
                            <div style={{ color: 'var(--text-dim)', fontSize: '13px', padding: '10px 0' }}>Loading appointments...</div>
                        ) : (() => {
                            const allBookedSlots = clients.reduce((acc, c) => {
                                const slotsWithClientInfo = c.booked_slots.map(slot => ({
                                    ...slot,
                                    clientName: c.name,
                                    clientEmail: c.email
                                }));
                                return [...acc, ...slotsWithClientInfo];
                            }, []);

                            const upcomingAppointments = allBookedSlots.filter(s => {
                                const slotDateTime = new Date(`${s.slot_date}T${s.start_time}`);
                                const now = new Date();
                                return slotDateTime >= now;
                            }).sort((a, b) => {
                                const dateCompare = a.slot_date.localeCompare(b.slot_date);
                                if (dateCompare !== 0) return dateCompare;
                                return a.start_time.localeCompare(b.start_time);
                            });

                            if (upcomingAppointments.length === 0) {
                                return <div style={{ color: 'var(--text-dim)', fontSize: '13px', padding: '10px 0' }}>No upcoming appointments booked.</div>;
                            }

                            return upcomingAppointments.slice(0, 3).map((app) => {
                                const slotDateObj = new Date(app.slot_date + 'T00:00:00');
                                const formattedDate = slotDateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                                return (
                                    <div className="session-card" key={app.id}>
                                        <div className="session-time" style={{ color: 'var(--lime)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                            <div style={{ fontWeight: 'bold' }}>{formattedDate}</div>
                                            <div style={{ fontSize: '10px', marginTop: '2px', opacity: 0.8 }}>
                                                {formatTime(app.start_time)}
                                            </div>
                                        </div>
                                        <div className="session-info">
                                            <div className="title">Personal Training Session</div>
                                            <div className="sub">with {app.clientName}</div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setActiveTab('bookings');
                                                navigate('/dashboard?tab=bookings', { replace: true });
                                            }}
                                            style={{ padding: '6px 16px', fontSize: 12, width: 'auto', background: 'var(--lime)', color: 'var(--black)', border: 'none', borderRadius: '99px', fontWeight: '800', cursor: 'pointer' }}
                                        >
                                            VIEW
                                        </button>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>

                <div className="dash-section">
                    <div className="section-head">
                        <h3>My Clients ({clients.length})</h3>
                    </div>
                    <div className="client-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {clientsLoading ? (
                            <div style={{ color: 'var(--text-dim)', fontSize: '13px', padding: '10px 0' }}>Loading clients...</div>
                        ) : clients.length === 0 ? (
                            <div style={{ color: 'var(--text-dim)', fontSize: '13px', padding: '10px 0' }}>No clients have booked sessions yet.</div>
                        ) : (
                            <>
                                {clients.slice(0, visibleHomeClientsCount).map((c) => {
                                    const isExpanded = homeExpandedClientId === c.id || homeExpandedClientId === c.email;
                                    const initials = c.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'CL';
                                    return (
                                        <div
                                            key={c.id || c.email}
                                            style={{
                                                background: 'rgba(255,255,255,0.02)',
                                                border: isExpanded ? '1px solid var(--lime)' : '1px solid rgba(255,255,255,0.06)',
                                                borderRadius: '16px',
                                                padding: '16px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease-in-out',
                                                boxSizing: 'border-box'
                                            }}
                                            onClick={() => setHomeExpandedClientId(isExpanded ? null : (c.id || c.email))}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div className="client-avatar">
                                                    {c.avatar_url ? (
                                                        <img src={c.avatar_url} alt={c.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                                    ) : initials}
                                                </div>
                                                <div className="client-info" style={{ flex: 1 }}>
                                                    <div className="name" style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-light)' }}>{c.name}</div>
                                                    <div className="goal" style={{ fontSize: '12.5px', color: 'var(--text-dim)', marginTop: '2px' }}>{c.email} · {c.booked_slots.length} session{c.booked_slots.length > 1 ? 's' : ''}</div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span className="tag" style={{ margin: 0 }}>Active</span>
                                                    <span style={{ fontSize: '12px', color: 'var(--text-dim)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>
                                                        ▶
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Expanded details right here on the home tab */}
                                            {isExpanded && (
                                                <div
                                                    style={{
                                                        marginTop: '16px',
                                                        paddingTop: '16px',
                                                        borderTop: '1px solid rgba(255,255,255,0.08)',
                                                        cursor: 'default'
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                                        <div>
                                                            <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone Number</div>
                                                            <div style={{ fontSize: '13.5px', color: 'var(--text-light)', marginTop: '4px', fontWeight: '500' }}>{c.mobile_no || 'N/A'}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Booked Sessions</div>
                                                            <div style={{ fontSize: '13.5px', color: 'var(--lime)', marginTop: '4px', fontWeight: 'bold' }}>{c.booked_slots.length}</div>
                                                        </div>
                                                    </div>


                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {clients.length > visibleHomeClientsCount && (
                                    <button
                                        type="button"
                                        onClick={() => setVisibleHomeClientsCount(prev => prev + 5)}
                                        style={{
                                            alignSelf: 'center',
                                            marginTop: '12px',
                                            padding: '10px 24px',
                                            background: 'rgba(255, 255, 255, 0.08)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            color: 'var(--text-light)',
                                            borderRadius: '99px',
                                            fontWeight: '800',
                                            fontSize: '12.5px',
                                            cursor: 'pointer',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                            width: 'auto',
                                            transition: 'background 0.2s, border-color 0.2s'
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                                            e.currentTarget.style.borderColor = 'var(--lime)';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                                        }}
                                    >
                                        Show More
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </>
        );
    };

    const renderProfile = () => (
        <div className="dash-section profile-section" style={{
            height: '100%',
            display: 'flex',
            gap: '40px',
            alignItems: 'stretch',
            marginTop: 0,
            overflow: 'hidden',
            paddingBottom: '20px'
        }}>
            <div className="profile-info-side" style={{
                flex: 1,
                background: 'var(--card-grad)',
                borderRadius: '24px',
                padding: '40px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                height: '100%'
            }}>
                <h2 style={{ fontSize: '36px', color: 'var(--lime)', marginBottom: '16px' }}>Your Profile</h2>
                <p style={{ color: 'var(--text-dim)', fontSize: '16px', lineHeight: '1.6', marginBottom: '40px' }}>
                    Keep your professional details up to date. This information is displayed to your clients when they book new training sessions.
                </p>
                <div
                    className="avatar"
                    style={{
                        width: '120px',
                        height: '120px',
                        fontSize: '42px',
                        overflow: 'hidden',
                        padding: 0,
                        flexShrink: 0,
                        cursor: trainer?.image_url ? 'pointer' : 'default',
                        transition: 'transform 0.2s ease-in-out'
                    }}
                    onClick={() => {
                        if (trainer?.image_url) {
                            setShowFullImageModal(true);
                        }
                    }}
                    onMouseOver={(e) => {
                        if (trainer?.image_url) {
                            e.currentTarget.style.transform = 'scale(1.06)';
                        }
                    }}
                    onMouseOut={(e) => {
                        if (trainer?.image_url) {
                            e.currentTarget.style.transform = 'scale(1)';
                        }
                    }}
                >
                    {trainer?.image_url ? (
                        <img src={`${trainer.image_url}?t=${cacheBuster}`} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : trainerInitials}
                </div>
                <h3 style={{ marginTop: '16px', fontSize: '22px' }}>{trainerName}</h3>
                <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>{trainerEmail}</p>
            </div>

            {/* Right Side: Form Fields (Only this side is scrollable) */}
            <div className="profile-form-side" style={{
                flex: 1,
                padding: '10px 20px 40px',
                height: '100%',
                overflowY: 'auto'
            }}>
                <h2 style={{ marginBottom: '24px' }}>Update Details</h2>



                <form className="profile-form" onSubmit={handleProfileSubmit}>
                    <div className="field">
                        <label>Full Name</label>
                        <input type="text" value={trainerName} disabled style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                    </div>
                    <div className="field" style={{ marginBottom: profileErrors.email ? 4 : 20 }}>
                        <label>Email Address</label>
                        <input
                            type="email"
                            name="email"
                            defaultValue={trainerEmail}
                            required
                            disabled={updateLoading}
                            onChange={() => setProfileErrors(prev => ({ ...prev, email: '' }))}
                            onBlur={e => handleProfileBlur('email', e.target.value)}
                        />
                    </div>
                    {profileErrors.email && (
                        <div style={{ color: '#ef4444', fontSize: '11px', textAlign: 'left', marginBottom: 12, paddingLeft: '4px' }}>
                            {profileErrors.email}
                        </div>
                    )}

                    <div className="field" style={{ marginBottom: profileErrors.mobile ? 4 : 20 }}>
                        <label>Mobile Number</label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <span style={{
                                position: 'absolute',
                                left: '18px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-light)',
                                fontSize: '14px',
                                pointerEvents: 'none',
                                borderRight: '1px solid rgba(255, 255, 255, 0.18)',
                                paddingRight: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                height: '18px',
                                zIndex: 2
                            }}>+92</span>
                            <input
                                type="tel"
                                name="mobile"
                                placeholder="3001234567"
                                defaultValue={getMobileDisplay(trainer?.phone_number)}
                                required
                                disabled={updateLoading}
                                style={{ paddingLeft: '65px', width: '100%' }}
                                onChange={e => {
                                    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
                                    setProfileErrors(prev => ({ ...prev, mobile: '' }));
                                }}
                                onBlur={e => handleProfileBlur('mobile', e.target.value)}
                            />
                        </div>
                    </div>
                    {profileErrors.mobile && (
                        <div style={{ color: '#ef4444', fontSize: '11px', textAlign: 'left', marginBottom: 12, paddingLeft: '4px' }}>
                            {profileErrors.mobile}
                        </div>
                    )}
                    <div className="field">
                        <label>Years of Experience</label>
                        <input type="text" name="experience" defaultValue={trainer?.experience || '0 years'} required disabled={updateLoading} />
                    </div>
                    <div className="field">
                        <label>Exercise Specialties</label>
                        <input type="text" name="training_type" defaultValue={trainer?.training_type || 'General'} required disabled={updateLoading} />
                    </div>
                    <div className="field">
                        <label>Session Price ($)</label>
                        <input type="number" step="0.01" name="session_price" defaultValue={trainer?.session_price !== undefined && trainer?.session_price !== null ? trainer.session_price : 48.00} required disabled={updateLoading} />
                    </div>
                    <div className="field">
                        <label>Profile Picture</label>
                        <div style={{ marginTop: '8px' }}>
                            {!selectedFile ? (
                                <>
                                    <label style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px dashed rgba(255,255,255,0.15)',
                                        borderRadius: '12px',
                                        padding: '14px 20px',
                                        color: 'var(--text-light)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        width: '100%',
                                        justifyContent: 'center',
                                        boxSizing: 'border-box'
                                    }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                            e.currentTarget.style.borderColor = 'var(--lime)';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                                        }}
                                    >
                                        <FolderIcon size={18} />
                                        <span style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                                            CHOOSE IMAGE FILE
                                        </span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            disabled={updateLoading}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '6px', display: 'block', textAlign: 'center' }}>
                                        Supports JPG, PNG, GIF. Max size 2MB.
                                    </span>
                                </>
                            ) : !isCropConfirmed ? (
                                <div style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '16px',
                                    padding: '20px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center'
                                }}>
                                    <div style={{
                                        position: 'relative',
                                        width: '200px',
                                        height: '200px',
                                        borderRadius: '50%',
                                        border: '2px solid var(--lime)',
                                        overflow: 'hidden',
                                        background: '#1a1a1a',
                                        cursor: isDragging ? 'grabbing' : 'grab',
                                        userSelect: 'none'
                                    }}
                                        onMouseDown={handleMouseDown}
                                        onMouseMove={handleMouseMove}
                                        onMouseUp={handleMouseUp}
                                        onMouseLeave={handleMouseUp}
                                        onTouchStart={handleTouchStart}
                                        onTouchMove={handleTouchMove}
                                        onTouchEnd={handleMouseUp}
                                    >
                                        <img
                                            src={previewUrl}
                                            alt="Crop preview"
                                            onLoad={handleImageLoad}
                                            style={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                                                transformOrigin: 'center center',
                                                width: imgIsPortrait ? '200px' : 'auto',
                                                height: imgIsPortrait ? 'auto' : '200px',
                                                maxWidth: 'none',
                                                maxHeight: 'none',
                                                pointerEvents: 'none',
                                                userSelect: 'none',
                                                WebkitUserDrag: 'none'
                                            }}
                                        />
                                    </div>

                                    <div style={{ width: '100%', marginTop: '20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '6px' }}>
                                            <span>Zoom</span>
                                            <span>{Math.round(zoom * 100)}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="1"
                                            max="3"
                                            step="0.01"
                                            value={zoom}
                                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                                            style={{
                                                width: '100%',
                                                accentColor: 'var(--lime)',
                                                height: '6px',
                                                borderRadius: '3px',
                                                background: 'rgba(255,255,255,0.1)',
                                                cursor: 'pointer'
                                            }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '20px' }}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedFile(null);
                                                setPreviewUrl(trainer?.image_url || '');
                                                setIsCropConfirmed(false);
                                                setCroppedImageBase64(null);
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '10px 16px',
                                                fontSize: '12px',
                                                background: 'rgba(239,68,68,0.15)',
                                                color: '#ef4444',
                                                border: '1px solid rgba(239,68,68,0.3)',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleConfirmCrop}
                                            style={{
                                                flex: 1,
                                                padding: '10px 16px',
                                                fontSize: '12px',
                                                background: 'var(--lime)',
                                                color: 'var(--black)',
                                                border: '1px solid var(--lime)',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            OK
                                        </button>
                                    </div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '12px', textAlign: 'center' }}>
                                        ↔ Drag image inside the circle to adjust, then click OK.
                                    </span>
                                </div>
                            ) : (
                                <div style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '16px',
                                    padding: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px'
                                }}>
                                    <div style={{
                                        width: '60px',
                                        height: '60px',
                                        borderRadius: '50%',
                                        overflow: 'hidden',
                                        border: '1px solid var(--lime)',
                                        flexShrink: 0
                                    }}>
                                        <img src={croppedImageBase64} alt="Cropped preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span>✓ Image cropped and ready</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsCropConfirmed(false);
                                                }}
                                                style={{
                                                    padding: '6px 12px',
                                                    fontSize: '11px',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    border: '1px solid rgba(255,255,255,0.15)',
                                                    color: 'var(--text-light)',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Adjust Crop
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedFile(null);
                                                    setPreviewUrl(trainer?.image_url || '');
                                                    setIsCropConfirmed(false);
                                                    setCroppedImageBase64(null);
                                                }}
                                                style={{
                                                    padding: '6px 12px',
                                                    fontSize: '11px',
                                                    background: 'rgba(239,68,68,0.1)',
                                                    border: '1px solid rgba(239,68,68,0.2)',
                                                    color: '#ef4444',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>



                    <div className="field">
                        <label>Bio</label>
                        <textarea rows="4" name="bio" defaultValue={trainer?.bio || "Elite fitness coach helping professionals get in shape. Let's achieve your goals together!"} required disabled={updateLoading}></textarea>
                    </div>

                    <button type="submit" className="btn-primary" style={{ marginTop: 20, width: '100%' }} disabled={updateLoading}>
                        {updateLoading ? 'Saving Changes...' : 'Save Changes'}
                    </button>
                </form>
            </div>
        </div>
    )

    const renderHistory = () => {
        const now = new Date();
        // Keep only completed appointments and clients who have completed appointments
        const historyClients = clients
            .map(c => {
                const completedSlots = c.booked_slots.filter(s => {
                    const slotDateTime = new Date(`${s.slot_date}T${s.start_time}`);
                    return slotDateTime < now;
                });
                return {
                    ...c,
                    booked_slots: completedSlots
                };
            })
            .filter(c => c.booked_slots.length > 0);

        // Filter history by search query
        const filteredClients = historyClients.filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.email.toLowerCase().includes(searchQuery.toLowerCase())
        );

        const displayedClients = filteredClients.slice(0, visibleCount);
        const hasMore = filteredClients.length > visibleCount;

        return (
            <div className="dash-section" style={{ paddingBottom: '40px' }}>
                <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0 }}>Session History ({filteredClients.length})</h3>
                </div>

                {/* Search Bar */}
                <div style={{ marginBottom: '20px' }}>
                    <input
                        type="text"
                        placeholder="Search history by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '12px',
                            color: 'var(--text-light)',
                            fontSize: '14px',
                            outline: 'none',
                            transition: 'border-color 0.2s',
                            boxSizing: 'border-box'
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'var(--lime)'}
                        onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                    />
                </div>

                {clientsLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)' }}>
                        Loading history...
                    </div>
                ) : clientsError ? (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#ef4444', fontWeight: 'bold' }}>
                        <WarningIcon size={14} /> {clientsError}
                    </div>
                ) : filteredClients.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)' }}>
                        {searchQuery ? 'No completed sessions match your search' : 'No completed sessions found'}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {displayedClients.map(c => {
                            const isExpanded = expandedClientId === c.id || expandedClientId === c.email;
                            const initials = c.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'CL';

                            return (
                                <div
                                    key={c.id || c.email}
                                    style={{
                                        background: 'var(--card-grad)',
                                        borderRadius: '16px',
                                        padding: '16px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease-in-out',
                                        border: isExpanded ? '1px solid var(--lime)' : '1px solid rgba(255, 255, 255, 0.05)',
                                    }}
                                    onClick={() => setExpandedClientId(isExpanded ? null : (c.id || c.email))}
                                >
                                    {/* Header: Name and Email */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div className="client-avatar" style={{ flexShrink: 0 }}>
                                            {c.avatar_url ? (
                                                <img src={c.avatar_url} alt={c.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                            ) : initials}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-light)' }}>
                                                {c.name}
                                            </div>
                                            <div style={{ fontSize: '12.5px', color: 'var(--text-dim)', marginTop: '2px' }}>
                                                {c.email}
                                            </div>
                                        </div>
                                        <span style={{ fontSize: '12px', color: 'var(--text-dim)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>
                                            ▶
                                        </span>
                                    </div>

                                    {/* Expanded Details: Phone & Booking history */}
                                    {isExpanded && (
                                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', cursor: 'default' }} onClick={(e) => e.stopPropagation()}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                                <div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone Number</div>
                                                    <div style={{ fontSize: '13.5px', color: 'var(--text-light)', marginTop: '4px', fontWeight: '500' }}>{c.mobile_no || 'N/A'}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Completed Sessions</div>
                                                    <div style={{ fontSize: '13.5px', color: 'var(--lime)', marginTop: '4px', fontWeight: 'bold' }}>{c.booked_slots.length}</div>
                                                </div>
                                            </div>

                                            <div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Completed Sessions</div>
                                                {c.booked_slots.length === 0 ? (
                                                    <div style={{ fontSize: '12.5px', color: 'var(--text-dim)' }}>No completed sessions found</div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                                                        {c.booked_slots.map(s => {
                                                            const slotDateObj = new Date(s.slot_date + 'T00:00:00');
                                                            const formattedDate = slotDateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

                                                            const slotDateTime = new Date(`${s.slot_date}T${s.start_time}`);
                                                            const now = new Date();
                                                            const isPassed = slotDateTime < now;
                                                            const displayStatus = isPassed ? 'completed' : s.status;
                                                            const statusColor = isPassed ? '#10b981' : '#ffc107';
                                                            const statusBg = isPassed ? 'rgba(16,185,129,0.12)' : 'rgba(255,193,7,0.12)';

                                                            return (
                                                                <div
                                                                    key={s.id}
                                                                    style={{
                                                                        background: 'rgba(255, 255, 255, 0.02)',
                                                                        borderRadius: '10px',
                                                                        padding: '10px 12px',
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        alignItems: 'center',
                                                                        border: '1px solid rgba(255, 255, 255, 0.05)'
                                                                    }}
                                                                >
                                                                    <div>
                                                                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-light)' }}>
                                                                            {formattedDate}
                                                                        </div>
                                                                        <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                                            <ClockIcon size={14} /> {formatTime(s.start_time)} - {formatTime(s.end_time)}
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ textAlign: 'right' }}>
                                                                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--lime)' }}>
                                                                            ${parseFloat(s.price).toFixed(2)}
                                                                        </div>
                                                                        <span style={{
                                                                            fontSize: '9px',
                                                                            fontWeight: '800',
                                                                            background: statusBg,
                                                                            color: statusColor,
                                                                            padding: '2px 6px',
                                                                            borderRadius: '99px',
                                                                            display: 'inline-block',
                                                                            marginTop: '4px',
                                                                            textTransform: 'uppercase'
                                                                        }}>
                                                                            {displayStatus}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Show More Button */}
                        {hasMore && (
                            <button
                                onClick={() => setVisibleCount(prev => prev + 5)}
                                style={{
                                    alignSelf: 'center',
                                    marginTop: '12px',
                                    padding: '10px 24px',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: 'var(--text-light)',
                                    borderRadius: '99px',
                                    fontWeight: '800',
                                    fontSize: '12.5px',
                                    cursor: 'pointer',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    width: 'auto',
                                    transition: 'background 0.2s, border-color 0.2s'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                                    e.currentTarget.style.borderColor = 'var(--lime)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                                }}
                            >
                                Show More
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderBookings = () => {
        // Derive appointments from clients data
        const allBookedSlots = clients.reduce((acc, c) => {
            const slotsWithClientInfo = c.booked_slots.map(slot => ({
                ...slot,
                clientName: c.name,
                clientEmail: c.email,
                clientAvatar: c.avatar_url,
                clientPhone: c.mobile_no
            }));
            return [...acc, ...slotsWithClientInfo];
        }, []);

        // Keep only upcoming appointments (exclude completed ones)
        const upcomingBookedSlots = allBookedSlots.filter(s => {
            const slotDateTime = new Date(`${s.slot_date}T${s.start_time}`);
            const now = new Date();
            return slotDateTime >= now;
        });

        // Sort chronologically
        const sortedAppointments = upcomingBookedSlots.sort((a, b) => {
            const dateCompare = a.slot_date.localeCompare(b.slot_date);
            if (dateCompare !== 0) return dateCompare;
            return a.start_time.localeCompare(b.start_time);
        });

        // Filter: search by client name
        const filteredAppointments = sortedAppointments.filter(app =>
            app.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            app.clientEmail.toLowerCase().includes(searchQuery.toLowerCase())
        );

        const displayedAppointments = filteredAppointments.slice(0, visibleBookingsCount);
        const hasMore = filteredAppointments.length > visibleBookingsCount;

        return (
            <div className="dash-section" style={{ paddingBottom: '40px' }}>
                <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0 }}>My Bookings ({filteredAppointments.length} bookings)</h3>
                </div>

                {/* Search Bar */}
                <div style={{ marginBottom: '20px' }}>
                    <input
                        type="text"
                        placeholder="Search bookings by client name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '12px',
                            color: 'var(--text-light)',
                            fontSize: '14px',
                            outline: 'none',
                            transition: 'border-color 0.2s',
                            boxSizing: 'border-box'
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'var(--lime)'}
                        onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                    />
                </div>

                {clientsLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)' }}>
                        Loading bookings...
                    </div>
                ) : filteredAppointments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)' }}>
                        {searchQuery ? 'No upcoming bookings match your search' : 'No upcoming booked appointments found'}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {displayedAppointments.map(app => {
                            const initials = app.clientName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'CL';
                            const slotDateObj = new Date(app.slot_date + 'T00:00:00');
                            const formattedDate = slotDateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                            const isExpanded = expandedApptId === app.id;
                            return (
                                <div
                                    key={app.id}
                                    style={{
                                        background: 'var(--card-grad)',
                                        borderRadius: '16px',
                                        padding: '16px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease-in-out',
                                        border: isExpanded ? '1px solid var(--lime)' : '1px solid rgba(215, 255, 30, 0.15)'
                                    }}
                                    onClick={() => setExpandedApptId(isExpanded ? null : app.id)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                            {/* Client Avatar */}
                                            <div className="client-avatar" style={{ flexShrink: 0, width: '42px', height: '42px', fontSize: '14px' }}>
                                                {app.clientAvatar ? (
                                                    <img src={app.clientAvatar} alt={app.clientName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                                ) : initials}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '14.5px', fontWeight: 'bold', color: 'var(--text-light)' }}>
                                                    {formattedDate}
                                                </div>
                                                <div style={{ fontSize: '12.5px', color: 'var(--text-dim)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <ClockIcon size={14} /> {formatTime(app.start_time)} - {formatTime(app.end_time)}
                                                </div>
                                                <div style={{ fontSize: '12.5px', color: 'var(--text-dim)', marginTop: '2px' }}>
                                                    Client: <span style={{ color: 'var(--text-light)', fontWeight: '600' }}>{app.clientName}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                                                <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--lime)' }}>
                                                    ${parseFloat(app.price).toFixed(2)}
                                                </div>
                                                <span style={{
                                                    fontSize: '9px',
                                                    fontWeight: '800',
                                                    background: 'rgba(255,193,7,0.12)',
                                                    color: '#ffc107',
                                                    padding: '3px 8px',
                                                    borderRadius: '99px',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.5px'
                                                }}>
                                                    booked
                                                </span>
                                            </div>
                                            <span style={{ fontSize: '12px', color: 'var(--text-dim)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>
                                                ▶
                                            </span>
                                        </div>
                                    </div>

                                    {/* Expanded Details: User and Appointment */}
                                    {isExpanded && (
                                        <div
                                            style={{
                                                marginTop: '16px',
                                                paddingTop: '16px',
                                                borderTop: '1px solid rgba(255,255,255,0.08)',
                                                cursor: 'default'
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                <div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client Info</div>
                                                    <div style={{ fontSize: '13.5px', color: 'var(--text-light)', marginTop: '4px', fontWeight: '500' }}>{app.clientName}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>{app.clientEmail}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>Phone: {app.clientPhone || 'N/A'}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Booking Details</div>
                                                    <div style={{ fontSize: '13.5px', color: 'var(--text-light)', marginTop: '4px', fontWeight: '500' }}>{formattedDate}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>{formatTime(app.start_time)} - {formatTime(app.end_time)}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>Rate: <span style={{ color: 'var(--lime)', fontWeight: 'bold' }}>${parseFloat(app.price).toFixed(2)}</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Show More Button */}
                        {hasMore && (
                            <button
                                onClick={() => setVisibleBookingsCount(prev => prev + 5)}
                                style={{
                                    alignSelf: 'center',
                                    marginTop: '12px',
                                    padding: '10px 24px',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: 'var(--text-light)',
                                    borderRadius: '99px',
                                    fontWeight: '800',
                                    fontSize: '12.5px',
                                    cursor: 'pointer',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    width: 'auto',
                                    transition: 'background 0.2s, border-color 0.2s'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                                    e.currentTarget.style.borderColor = 'var(--lime)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                                }}
                            >
                                Show More
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="screen dash-screen">
            {/* Sidebar Navigation */}
            <nav className="side-nav">
                <div className="side-nav-logo" style={{ marginBottom: 40, color: 'var(--lime)', fontWeight: 'bold' }}>
                    GetFit
                </div>
                {NAV_ITEMS.map((item) => (
                    <button
                        key={item.key}
                        className={`nav-item ${activeTab === item.key ? 'active' : ''}`}
                        onClick={() => {
                            if (item.key === 'slots') {
                                navigate('/slots');
                            } else {
                                setActiveTab(item.key);
                                navigate(`/dashboard?tab=${item.key}`, { replace: true });
                            }
                        }}
                        title={item.label}
                    >
                        <span style={{ fontSize: 22 }}>{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="dash-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div className="dash-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button className="back-btn-dash" onClick={handleBack} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '34px', height: '34px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px' }}>&#8592;</button>
                        <div className="dash-greeting">
                            <div className="hello">Welcome back</div>
                            <div className="name">{trainerName}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button className="btn-secondary" onClick={handleLogout} disabled={loggingOut} style={{ padding: '6px 14px', fontSize: '11px', borderRadius: '99px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'var(--text-light)', cursor: 'pointer', fontWeight: '800', width: 'auto', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: loggingOut ? 0.6 : 1 }}>
                            {loggingOut ? 'Logging out...' : 'Logout'}
                        </button>
                        <div
                            className="avatar"
                            style={{
                                overflow: 'hidden',
                                padding: 0,
                                flexShrink: 0,
                                cursor: 'pointer',
                                transition: 'transform 0.2s'
                            }}
                            onClick={() => {
                                setActiveTab('profile');
                                navigate('/dashboard?tab=profile', { replace: true });
                            }}
                            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            {trainer?.image_url ? (
                                <img src={`${trainer.image_url}?t=${cacheBuster}`} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : trainerInitials}
                        </div>
                    </div>
                </div>

                <div className="dash-content-area" style={{ flex: 1, overflowY: activeTab === 'profile' ? 'hidden' : 'auto' }}>
                    {activeTab === 'home' && renderHome()}
                    {activeTab === 'profile' && renderProfile()}
                    {activeTab === 'history' && renderHistory()}
                    {activeTab === 'bookings' && renderBookings()}
                </div>
            </div>

            {showFullImageModal && trainer?.image_url && (
                <div
                    onClick={() => setShowFullImageModal(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.85)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10000,
                        cursor: 'pointer'
                    }}
                >
                    <div
                        style={{
                            position: 'relative',
                            width: '320px',
                            height: '320px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            border: '4px solid var(--lime)',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
                            background: '#1a1a1a',
                            cursor: 'default'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={`${trainer.image_url}?t=${cacheBuster}`}
                            alt="Full Profile"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <button
                            onClick={() => setShowFullImageModal(false)}
                            style={{
                                position: 'absolute',
                                top: '12px',
                                right: '12px',
                                background: 'rgba(0,0,0,0.5)',
                                border: 'none',
                                color: '#fff',
                                borderRadius: '50%',
                                width: '30px',
                                height: '30px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                transition: 'background 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.8)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {(updateSuccess || errorMsg) && (
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
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40px', marginBottom: '16px' }}>
                            {updateSuccess ? <PartyIcon size={40} color="var(--lime)" /> : <WarningIcon size={40} color="#ff3b30" />}
                        </div>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--text-light)', margin: '0 0 10px' }}>
                            {updateSuccess ? 'Success' : 'Error'}
                        </h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: '0 0 24px', lineHeight: '1.5' }}>
                            {updateSuccess || errorMsg}
                        </p>
                        <button
                            className="btn-primary"
                            onClick={() => {
                                setUpdateSuccess('');
                                setErrorMsg('');
                            }}
                            style={{ padding: '12px', fontSize: '13px', textTransform: 'uppercase' }}
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
