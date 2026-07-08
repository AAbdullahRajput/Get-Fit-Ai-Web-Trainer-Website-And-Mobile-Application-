import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { HomeIcon, HistoryIcon, BookingsIcon, ProfileIcon, SlotsIcon, CalendarIcon, ClockIcon, LockIcon, TrashIcon } from '../components/NavIcons'

const NAV_ITEMS = [
    { key: 'home', label: 'Home', icon: <HomeIcon /> },
    { key: 'bookings', label: 'Bookings', icon: <BookingsIcon /> },
    { key: 'slots', label: 'Slots', icon: <SlotsIcon /> },
    { key: 'history', label: 'History', icon: <HistoryIcon /> },
    { key: 'profile', label: 'Profile', icon: <ProfileIcon /> },
]

const WEEKDAYS = [
    { dateString: '1970-01-05', label: 'Mon', fullLabel: 'Monday', dayIndex: 1 },
    { dateString: '1970-01-06', label: 'Tue', fullLabel: 'Tuesday', dayIndex: 2 },
    { dateString: '1970-01-07', label: 'Wed', fullLabel: 'Wednesday', dayIndex: 3 },
    { dateString: '1970-01-08', label: 'Thu', fullLabel: 'Thursday', dayIndex: 4 },
    { dateString: '1970-01-09', label: 'Fri', fullLabel: 'Friday', dayIndex: 5 },
    { dateString: '1970-01-10', label: 'Sat', fullLabel: 'Saturday', dayIndex: 6 },
    { dateString: '1970-01-11', label: 'Sun', fullLabel: 'Sunday', dayIndex: 0 }
];

const getTodayReferenceDateString = () => {
    const today = new Date();
    const day = today.getDay();
    const weekday = WEEKDAYS.find(w => w.dayIndex === day);
    return weekday ? weekday.dateString : '1970-01-05';
};

export default function Slots() {
    const navigate = useNavigate();
    const location = useLocation();
    const [trainer, setTrainer] = useState(() => {
        const trainerString = localStorage.getItem('trainer');
        return trainerString ? JSON.parse(trainerString) : null;
    });

    const [slots, setSlots] = useState([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [slotsError, setSlotsError] = useState('');

    // Day and Pagination state
    const [selectedDayFilter, setSelectedDayFilter] = useState(() => {
        const params = new URLSearchParams(location.search);
        const dayParam = params.get('day');
        return WEEKDAYS.some(w => w.dateString === dayParam) ? dayParam : getTodayReferenceDateString();
    });
    const [showAllSlots, setShowAllSlots] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const dayParam = params.get('day');
        if (dayParam && WEEKDAYS.some(w => w.dateString === dayParam) && dayParam !== selectedDayFilter) {
            setSelectedDayFilter(dayParam);
        }
    }, [location.search]);

    useEffect(() => {
        fetchSlots();
    }, []);

    const fetchSlots = async () => {
        setSlotsLoading(true);
        setSlotsError('');
        try {
            const sessionString = localStorage.getItem('session');
            const session = sessionString ? JSON.parse(sessionString) : null;
            if (!session?.access_token) {
                setSlotsLoading(false);
                return;
            }

            // 1. Fetch current trainer slots from database
            const response = await fetch('/api/slots', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to fetch slots');
            const existing = data.slots || [];

            // 2. Filter existing slots to keep only template slots (reference week)
            const existingTemplates = existing.filter(s =>
                s.slot_date >= '1970-01-05' && s.slot_date <= '1970-01-11'
            );

            const existingKeys = new Set(
                existingTemplates.map(s => `${s.slot_date}_${s.start_time.substring(0, 5)}`)
            );

            const missingSlots = [];
            const price = trainer?.session_price || 48.00;

            // 3. Find which of the 168 template slots (7 days * 24) are missing
            for (const weekday of WEEKDAYS) {
                const dStr = weekday.dateString;
                for (let h = 0; h < 24; h++) {
                    const start_time = `${String(h).padStart(2, '0')}:00:00`;
                    const endHour = h + 1;
                    const end_time = endHour === 24 ? '00:00:00' : `${String(endHour).padStart(2, '0')}:00:00`;

                    const key = `${dStr}_${start_time.substring(0, 5)}`;
                    if (!existingKeys.has(key)) {
                        // Slots from 9 to 5 are open by default (9:00:00 to 17:00:00, i.e. hours 9 to 16 inclusive)
                        const is_active = (h >= 9 && h < 17);
                        missingSlots.push({
                            slot_date: dStr,
                            start_time,
                            end_time,
                            is_active,
                            price,
                            status: 'available'
                        });
                    }
                }
            }

            // 4. Bulk insert missing slots into backend
            if (missingSlots.length > 0) {
                const bulkResponse = await fetch('/api/slots', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify(missingSlots)
                });
                const bulkData = await bulkResponse.json();
                if (!bulkResponse.ok) {
                    throw new Error(bulkData.error || 'Failed to generate weekly slots');
                }
                const inserted = bulkData.slots || [];
                const allTemplateSlots = [...existingTemplates, ...inserted].sort((a, b) => {
                    const dateCompare = a.slot_date.localeCompare(b.slot_date);
                    if (dateCompare !== 0) return dateCompare;
                    return a.start_time.localeCompare(b.start_time);
                });
                setSlots(allTemplateSlots);
            } else {
                setSlots(existingTemplates.sort((a, b) => {
                    const dateCompare = a.slot_date.localeCompare(b.slot_date);
                    if (dateCompare !== 0) return dateCompare;
                    return a.start_time.localeCompare(b.start_time);
                }));
            }
        } catch (err) {
            setSlotsError(err.message);
        } finally {
            setSlotsLoading(false);
        }
    };

    const handleDeleteSlot = async (id) => {
        if (!window.confirm('Are you sure you want to delete this slot?')) return;
        setSlotsError('');
        try {
            const sessionString = localStorage.getItem('session');
            const session = sessionString ? JSON.parse(sessionString) : null;
            if (!session?.access_token) return;

            const response = await fetch(`/api/slots/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to delete slot');

            setSlots((prev) => prev.filter((s) => s.id !== id));
        } catch (err) {
            setSlotsError(err.message);
        }
    };

    const handleToggleSlotActive = async (id, currentIsActive) => {
        setSlotsError('');

        // 1. Optimistically update UI state instantly
        setSlots((prev) => prev.map((s) => s.id === id ? { ...s, is_active: !currentIsActive } : s));

        try {
            const sessionString = localStorage.getItem('session');
            const session = sessionString ? JSON.parse(sessionString) : null;
            if (!session?.access_token) {
                // Revert if no session
                setSlots((prev) => prev.map((s) => s.id === id ? { ...s, is_active: currentIsActive } : s));
                return;
            }

            const response = await fetch(`/api/slots/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ is_active: !currentIsActive })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to update slot');

            // 2. Synchronize with database state on success
            setSlots((prev) => prev.map((s) => s.id === id ? data.slot : s));
        } catch (err) {
            setSlotsError(err.message);
            // 3. Revert to original state on failure
            setSlots((prev) => prev.map((s) => s.id === id ? { ...s, is_active: currentIsActive } : s));
        }
    };

    const handleDayFilterChange = (dayStr) => {
        setSelectedDayFilter(dayStr);
        setShowAllSlots(false);
        navigate(`/slots?day=${dayStr}`, { replace: true });
    };

    const handleToggleDayActive = async (dayString, currentIsActive) => {
        setSlotsError('');

        let activeTimesBackup = null;
        let nextSlotsState;

        if (currentIsActive) {
            // Turning OFF: Backup currently active slot start times
            const activeSlots = slots.filter(s => s.slot_date === dayString && s.is_active && s.status !== 'booked');
            activeTimesBackup = activeSlots.map(s => s.start_time);
            localStorage.setItem(`inactive_slots_backup_${dayString}`, JSON.stringify(activeTimesBackup));

            // Optimistic state: set all to false
            nextSlotsState = slots.map(s => s.slot_date === dayString ? { ...s, is_active: false } : s);
        } else {
            // Turning ON: Read backup from localStorage if it exists
            const backupStr = localStorage.getItem(`inactive_slots_backup_${dayString}`);
            if (backupStr) {
                try {
                    activeTimesBackup = JSON.parse(backupStr);
                } catch (e) {
                    activeTimesBackup = null;
                }
            }

            if (Array.isArray(activeTimesBackup)) {
                // Optimistic state: set only backup slots to true
                nextSlotsState = slots.map(s => {
                    if (s.slot_date === dayString) {
                        return { ...s, is_active: activeTimesBackup.includes(s.start_time) };
                    }
                    return s;
                });
            } else {
                // Optimistic state: fallback to setting all to true
                nextSlotsState = slots.map(s => s.slot_date === dayString ? { ...s, is_active: true } : s);
            }
        }

        // Apply optimistic update instantly
        setSlots(nextSlotsState);

        try {
            const sessionString = localStorage.getItem('session');
            const session = sessionString ? JSON.parse(sessionString) : null;
            if (!session?.access_token) {
                // Revert
                setSlots(slots);
                return;
            }

            const requestBody = { slot_date: dayString, is_active: !currentIsActive };
            if (!currentIsActive && Array.isArray(activeTimesBackup)) {
                requestBody.active_times = activeTimesBackup;
            }

            const response = await fetch('/api/slots/toggle-day', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(requestBody)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to update slots for the day');

            // Sync with returned database state
            const updated = data.slots || [];
            setSlots((prev) => {
                const map = new Map(prev.map(s => [s.id, s]));
                for (const u of updated) {
                    map.set(u.id, u);
                }
                return Array.from(map.values()).sort((a, b) => {
                    const dateCompare = a.slot_date.localeCompare(b.slot_date);
                    if (dateCompare !== 0) return dateCompare;
                    return a.start_time.localeCompare(b.start_time);
                });
            });
        } catch (err) {
            setSlotsError(err.message);
            // Revert
            setSlots(slots);
        }
    };

    const trainerName = trainer?.name || trainer?.username || 'Trainer';
    const trainerInitials = trainerName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'TR';

    // Deduplicate slots: prioritize booked slots over available/active ones, and hide any duplicates for the same hour.
    const getDeduplicatedSlots = (rawSlots) => {
        const sorted = [...rawSlots].sort((a, b) => {
            if (a.status === 'booked' && b.status !== 'booked') return -1;
            if (b.status === 'booked' && a.status !== 'booked') return 1;
            if (a.is_active && !b.is_active) return -1;
            if (b.is_active && !a.is_active) return 1;
            return 0;
        });
        const seen = new Set();
        const deduped = [];
        for (const s of sorted) {
            const key = `${s.slot_date}_${s.start_time.substring(0, 5)}`;
            if (!seen.has(key)) {
                seen.add(key);
                deduped.push(s);
            }
        }
        return deduped.sort((a, b) => {
            const dateCompare = a.slot_date.localeCompare(b.slot_date);
            if (dateCompare !== 0) return dateCompare;
            return a.start_time.localeCompare(b.start_time);
        });
    };

    const deduplicatedSlots = getDeduplicatedSlots(slots);
    // Planner only shows availability templates (open/closed) — NOT booked slots
    const templateSlots = deduplicatedSlots.filter(s =>
        s.slot_date >= '1970-01-05' && s.slot_date <= '1970-01-11' && s.status !== 'booked'
    );

    const dayFiltered = templateSlots.filter(s => s.slot_date === selectedDayFilter);

    // Default to only 9 AM to 5 PM slots (hours 9 to 16 inclusive)
    const displayedSlots = showAllSlots
        ? dayFiltered
        : dayFiltered.filter(s => {
            const hour = parseInt(s.start_time.split(':')[0], 10);
            return hour >= 9 && hour < 17;
        });

    const hasHiddenSlots = dayFiltered.some(s => {
        const hour = parseInt(s.start_time.split(':')[0], 10);
        return hour < 9 || hour >= 17;
    });
    const showMoreButtonVisible = !showAllSlots && hasHiddenSlots;

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
                        className={`nav-item ${item.key === 'slots' ? 'active' : ''}`}
                        onClick={() => {
                            if (item.key === 'slots') return;
                            navigate(`/dashboard?tab=${item.key}`);
                        }}
                        title={item.label}
                    >
                        <span style={{ fontSize: 22 }}>{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="dash-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header */}
                <div className="dash-header" style={{
                    background: '0 0',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 22px',
                    display: 'flex',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                            className="back-btn-dash"
                            onClick={() => navigate('/dashboard')}
                            style={{
                                background: 'rgba(255,255,255,0.1)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '34px',
                                height: '34px',
                                color: 'var(--text-light)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '16px'
                            }}
                        >
                            &#8592;
                        </button>
                        <div className="dash-greeting">
                            <div className="hello">Manage Availability</div>
                            <div className="name" style={{ fontFamily: 'var(--font-display)', color: 'var(--lime)', fontSize: '20px' }}>Slots Planner</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                            onClick={() => navigate('/slots-tester')}
                            title="Test dynamic slot generation"
                            style={{
                                background: 'rgba(215,255,30,0.1)',
                                border: '1px solid rgba(215,255,30,0.25)',
                                borderRadius: '10px',
                                color: 'var(--lime)',
                                padding: '7px 14px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            🧪 Test Booking API
                        </button>
                        <div className="avatar" style={{ overflow: 'hidden', padding: 0, flexShrink: 0 }}>
                            {trainer?.image_url ? (
                                <img src={trainer.image_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : trainerInitials}
                        </div>
                    </div>
                </div>

                {/* Content Container */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    gap: '30px',
                    padding: '24px',
                    overflow: 'hidden',
                    boxSizing: 'border-box'
                }}>
                    {/* Left Side: Planner Control Panel */}
                    <div style={{
                        flex: '0 0 350px',
                        background: 'var(--card-grad)',
                        borderRadius: '24px',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        boxSizing: 'border-box',
                        overflowY: 'auto',
                        gap: '24px'
                    }}>
                        <div>
                            <h2 style={{ fontSize: '22px', color: 'var(--lime)', marginBottom: '8px', marginTop: 0 }}>Weekly Planner</h2>
                            <p style={{ color: 'var(--text-dim)', fontSize: '12.5px', lineHeight: '1.5', margin: 0 }}>

                            </p>
                        </div>

                        {/* Summary Card */}
                        <div style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '16px',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}>
                            <h3 style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0, fontWeight: 'bold' }}>
                                Availability Summary
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div style={{ background: 'rgba(215,255,30,0.04)', border: '1px solid rgba(215,255,30,0.1)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--lime)' }}>
                                        {templateSlots.filter(s => s.is_active).length}
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>Open Hours</div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-dim)' }}>
                                        {templateSlots.filter(s => !s.is_active).length}
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>Closed Hours</div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '10px', textAlign: 'center', gridColumn: 'span 2' }}>
                                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-light)' }}>
                                        {templateSlots.length} / 168
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>Total Configured</div>
                                </div>
                            </div>
                        </div>


                        {/* Filters Card */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <h3 style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0, fontWeight: 'bold' }}>
                                Filter by Day
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {WEEKDAYS.map((d) => {
                                    const daySlots = templateSlots.filter(s => s.slot_date === d.dateString);
                                    const openCount = daySlots.filter(s => s.is_active).length;
                                    const isSelected = selectedDayFilter === d.dateString;
                                    const isDayActive = daySlots.length > 0 && daySlots.some(s => s.is_active);

                                    return (
                                        <div 
                                            key={d.dateString}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                width: '100%'
                                            }}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => handleDayFilterChange(d.dateString)}
                                                style={{
                                                    flex: 1,
                                                    background: isSelected ? 'var(--lime)' : 'rgba(255,255,255,0.04)',
                                                    color: isSelected ? 'var(--black)' : 'var(--text-light)',
                                                    border: '1px solid',
                                                    borderColor: isSelected ? 'var(--lime)' : 'rgba(255,255,255,0.08)',
                                                    borderRadius: '12px',
                                                    padding: '10px 16px',
                                                    fontSize: '13px',
                                                    fontWeight: 'bold',
                                                    textAlign: 'left',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <span>{d.fullLabel}</span>
                                                <span style={{ fontSize: '11px', opacity: 0.7 }}>
                                                    {openCount}/24 open
                                                </span>
                                            </button>

                                            {/* iOS Style Switch to the right of the day selection button */}
                                            <div 
                                                style={{
                                                    position: 'relative',
                                                    width: '38px',
                                                    height: '20px',
                                                    background: isDayActive ? 'var(--lime)' : 'rgba(255,255,255,0.1)',
                                                    borderRadius: '10px',
                                                    cursor: 'pointer',
                                                    transition: 'background-color 0.2s',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    padding: '2px',
                                                    flexShrink: 0
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleDayActive(d.dateString, isDayActive);
                                                }}
                                                title={isDayActive ? "Turn off all slots for this day" : "Turn on slots for this day"}
                                            >
                                                <div style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    background: isDayActive ? 'var(--black)' : '#888',
                                                    borderRadius: '50%',
                                                    transform: isDayActive ? 'translateX(18px)' : 'translateX(0px)',
                                                    transition: 'transform 0.2s, background-color 0.2s'
                                                }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Slots List */}
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}>
                        <h2 style={{ fontSize: '20px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0 }}>
                            <span>
                                {'Slots for ' + (WEEKDAYS.find(w => w.dateString === selectedDayFilter)?.fullLabel || selectedDayFilter)}
                            </span>
                            <span style={{ fontSize: '12px', background: 'rgba(215,255,30,0.1)', padding: '3px 10px', borderRadius: '12px', color: 'var(--lime)', fontWeight: 'bold' }}>
                                {dayFiltered.filter(s => s.is_active).length} / 24 open
                            </span>
                        </h2>
                        <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: '0 0 16px', fontStyle: 'italic' }}>
                            Showing 9 AM – 5 PM by default · click <strong>Show Off-Hours</strong> to see all 24 hours
                        </p>

                        {slotsError && (
                            <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '10px', marginBottom: '16px', fontSize: '12px', fontWeight: 'bold' }}>
                                ⚠️ {slotsError}
                            </div>
                        )}

                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            paddingRight: '6px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}>
                            {slotsLoading ? (
                                <div style={{ textAlign: 'center', color: 'var(--text-dim)', marginTop: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '28px', height: '28px', border: '3px solid rgba(215,255,30,0.2)', borderTopColor: 'var(--lime)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                    <span>Loading your schedule...</span>
                                </div>
                            ) : displayedSlots.length === 0 ? (
                                <div style={{
                                    textAlign: 'center',
                                    border: '1px dashed rgba(255,255,255,0.1)',
                                    borderRadius: '20px',
                                    padding: '60px 20px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '12px',
                                    background: 'rgba(255,255,255,0.01)',
                                    marginTop: '20px'
                                }}>
                                    <CalendarIcon size={32} color="var(--text-light)" />
                                    <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-light)' }}>
                                        {slotsLoading ? 'Setting up your schedule...' : 'No slots configured for this day'}
                                    </span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                                        {slotsLoading ? 'Please wait while we initialise your 9–5 availability' : 'Reload the page to initialise default availability'}
                                    </span>
                                </div>
                            ) : (
                                <>
                                    {displayedSlots.map((slot) => {
                                        const isBooked = slot.status === 'booked';

                                        const formatTime = (timeStr) => {
                                            const parts = timeStr.split(':');
                                            const hour = parseInt(parts[0], 10);
                                            const ampm = hour >= 12 ? 'PM' : 'AM';
                                            const displayHour = hour % 12 === 0 ? 12 : hour % 12;
                                            return `${displayHour}:${parts[1]} ${ampm}`;
                                        };

                                        return (
                                            <div
                                                key={slot.id}
                                                style={{
                                                    background: 'var(--card-grad)',
                                                    border: isBooked ? '1px solid rgba(255, 193, 7, 0.25)' : '1px solid rgba(255,255,255,0.05)',
                                                    boxShadow: isBooked ? '0 0 12px rgba(255, 193, 7, 0.05)' : 'none',
                                                    borderRadius: '16px',
                                                    padding: '16px 20px',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    gap: '20px',
                                                    opacity: slot.is_active || isBooked ? 1 : 0.5,
                                                    transition: 'opacity 0.2s, border-color 0.2s'
                                                }}
                                            >
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-light)' }}>
                                                            {WEEKDAYS.find(w => w.dateString === slot.slot_date)?.fullLabel || slot.slot_date}
                                                        </span>
                                                        <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '10px', color: 'var(--text-dim)', fontWeight: 'bold' }}>
                                                            ${parseFloat(slot.price).toFixed(2)}
                                                        </span>
                                                        {isBooked ? (
                                                            <span style={{ fontSize: '10px', background: 'rgba(255,193,7,0.15)', color: '#ffc107', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#ffc107' }}></span>
                                                                BOOKED
                                                            </span>
                                                        ) : slot.is_active ? (
                                                            <span style={{ fontSize: '10px', background: 'rgba(215,255,30,0.15)', color: 'var(--lime)', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--lime)' }}></span>
                                                                OPEN
                                                            </span>
                                                        ) : (
                                                            <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-dim)', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-dim)' }}></span>
                                                                CLOSED
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-dim)' }}>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><ClockIcon size={14} /> {formatTime(slot.start_time)} - {formatTime(slot.end_time)}</span>
                                                    </div>
                                                    {isBooked && (
                                                        <div style={{ fontSize: '11px', color: 'var(--text-light)', background: 'rgba(255,193,7,0.06)', border: '1px solid rgba(255,193,7,0.12)', padding: '8px 12px', borderRadius: '10px', marginTop: '6px', maxWidth: '400px' }}>
                                                            <div style={{ fontWeight: 'bold', color: '#ffc107', marginBottom: '2px' }}>Client Details</div>
                                                            <div>Name: {slot.booked_by_name || 'N/A'}</div>
                                                            <div>Email: {slot.booked_by_email || 'N/A'}</div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                    {isBooked ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', paddingRight: '8px' }}>
                                                            <span style={{ fontSize: '9px', color: '#ffc107', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                                                                Locked
                                                            </span>
                                                            <span style={{ display: 'inline-flex', cursor: 'not-allowed' }} title="Booked slot is locked"><LockIcon size={18} color="var(--text-dim)" /></span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {/* Open / Close Toggle (iOS style switch) */}
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                                <span style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                                                                    {slot.is_active ? 'Open' : 'Closed'}
                                                                </span>
                                                                <div
                                                                    style={{
                                                                        position: 'relative',
                                                                        width: '44px',
                                                                        height: '24px',
                                                                        background: slot.is_active ? 'var(--lime)' : 'rgba(255,255,255,0.1)',
                                                                        borderRadius: '12px',
                                                                        cursor: 'pointer',
                                                                        transition: 'background-color 0.2s',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        padding: '2px'
                                                                    }}
                                                                    onClick={() => handleToggleSlotActive(slot.id, slot.is_active)}
                                                                    title={slot.is_active ? 'Close Slot' : 'Open Slot'}
                                                                >
                                                                    <div style={{
                                                                        width: '20px',
                                                                        height: '20px',
                                                                        background: slot.is_active ? 'var(--black)' : '#888',
                                                                        borderRadius: '50%',
                                                                        transform: slot.is_active ? 'translateX(20px)' : 'translateX(0px)',
                                                                        transition: 'transform 0.2s, background-color 0.2s'
                                                                    }} />
                                                                </div>
                                                            </div>

                                                            {/* Delete Button */}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteSlot(slot.id)}
                                                                style={{
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    color: '#ef4444',
                                                                    fontSize: '16px',
                                                                    cursor: 'pointer',
                                                                    opacity: 0.8,
                                                                    padding: '4px',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    borderRadius: '6px'
                                                                }}
                                                                title="Delete Slot"
                                                            >
                                                                <TrashIcon size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {showMoreButtonVisible && (
                                        <button
                                            type="button"
                                            onClick={() => setShowAllSlots(true)}
                                            style={{
                                                background: 'rgba(255,255,255,0.06)',
                                                color: 'var(--text-light)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '12px',
                                                padding: '12px 24px',
                                                fontWeight: 'bold',
                                                fontSize: '13px',
                                                cursor: 'pointer',
                                                marginTop: '16px',
                                                alignSelf: 'center',
                                                display: 'block',
                                                width: '100%',
                                                maxWidth: '240px',
                                                textAlign: 'center',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseOver={(e) => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                                                e.currentTarget.style.borderColor = 'var(--lime)';
                                            }}
                                            onMouseOut={(e) => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                            }}
                                        >
                                            Show remaining hours
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
