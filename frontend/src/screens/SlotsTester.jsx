import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const display = hour % 12 === 0 ? 12 : hour % 12;
    return `${display}:${m} ${ampm}`;
};

const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function SlotsTester() {
    const navigate = useNavigate();

    // ── trainer ID from logged-in session
    const trainerFromSession = (() => {
        try {
            const t = localStorage.getItem('trainer');
            return t ? JSON.parse(t) : null;
        } catch { return null; }
    })();

    const [trainerId, setTrainerId] = useState(trainerFromSession?.id || '');
    const [date, setDate] = useState(getTodayStr());
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [generated, setGenerated] = useState(null);

    // Booking form
    const [bookingSlot, setBookingSlot] = useState(null);
    const [bookName, setBookName] = useState('');
    const [bookEmail, setBookEmail] = useState('');
    const [bookLoading, setBookLoading] = useState(false);
    const [bookResult, setBookResult] = useState(null);

    const fetchSlots = async () => {
        if (!trainerId || !date) {
            setError('Enter both Trainer ID and Date');
            return;
        }
        setLoading(true);
        setError('');
        setInfo('');
        setSlots([]);
        setGenerated(null);
        setBookingSlot(null);
        setBookResult(null);
        try {
            const res = await fetch(`/api/slots/available?trainer_id=${encodeURIComponent(trainerId)}&date=${encodeURIComponent(date)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch slots');
            setSlots(data.slots || []);
            setGenerated(data.generated);
            setInfo(data.message || '');
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBook = async () => {
        if (!bookingSlot) return;
        setBookLoading(true);
        setBookResult(null);
        try {
            const res = await fetch('/api/slots/book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trainer_id: trainerId,
                    date,
                    start_time: bookingSlot.start_time,
                    end_time: bookingSlot.end_time,
                    price: bookingSlot.price,
                    name: bookName || 'Test User',
                    email: bookEmail || 'test@example.com'
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Booking failed');
            setBookResult({ success: true, slot: data.slot, created: data.created });
            // Remove this slot from list (now booked)
            setSlots(prev => prev.filter(s => s.start_time !== bookingSlot.start_time));
            setBookingSlot(null);
        } catch (e) {
            setBookResult({ success: false, error: e.message });
        } finally {
            setBookLoading(false);
        }
    };

    const bg = 'var(--bg, #111)';
    const card = 'rgba(255,255,255,0.04)';
    const border = '1px solid rgba(255,255,255,0.08)';
    const lime = '#d7ff1e';
    const textLight = '#f0f0f0';
    const textDim = '#888';

    return (
        <div className="screen" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #111 100%)', fontFamily: "'Inter', sans-serif", color: textLight, padding: '32px 24px', boxSizing: 'border-box' }}>
            {/* Header */}
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                    <button
                        onClick={() => navigate('/slots')}
                        style={{ background: 'rgba(255,255,255,0.06)', border, borderRadius: '10px', color: textLight, padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        ← Back to Planner
                    </button>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: lime }}>
                            🧪 Dynamic Slots Tester
                        </h1>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: textDim }}>
                            Test the dynamic slot generation &amp; booking API for any date — past or future
                        </p>
                    </div>
                </div>

                {/* Query Form */}
                <div style={{ background: card, border, borderRadius: '20px', padding: '24px', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '14px', fontWeight: 'bold', color: textDim, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 20px' }}>
                        Step 1 — Query Available Slots
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                        <div>
                            <label style={{ fontSize: '12px', color: textDim, display: 'block', marginBottom: '6px' }}>Trainer ID (UUID)</label>
                            <input
                                id="tester-trainer-id"
                                value={trainerId}
                                onChange={e => setTrainerId(e.target.value)}
                                placeholder="e.g. 3f8a1b2c-..."
                                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border, borderRadius: '10px', color: textLight, fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '12px', color: textDim, display: 'block', marginBottom: '6px' }}>Date (try any future date!)</label>
                            <input
                                id="tester-date"
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border, borderRadius: '10px', color: textLight, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                            />
                        </div>
                        <button
                            id="tester-fetch-btn"
                            onClick={fetchSlots}
                            disabled={loading}
                            style={{ padding: '10px 24px', background: lime, color: '#000', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, whiteSpace: 'nowrap' }}
                        >
                            {loading ? 'Fetching...' : 'Get Slots →'}
                        </button>
                    </div>

                    {/* API call preview */}
                    <div style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px', color: '#7dd3fc' }}>
                        GET /api/slots/available?trainer_id=<span style={{ color: lime }}>{trainerId || '...'}</span>&amp;date=<span style={{ color: lime }}>{date || '...'}</span>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', color: '#ef4444', fontSize: '13px', fontWeight: 'bold', marginBottom: '16px' }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* Results */}
                {slots.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                        {/* Status banner */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', padding: '12px 16px', background: generated ? 'rgba(215,255,30,0.06)' : 'rgba(100,200,100,0.06)', border: `1px solid ${generated ? 'rgba(215,255,30,0.2)' : 'rgba(100,200,100,0.2)'}`, borderRadius: '12px' }}>
                            <span style={{ fontSize: '20px' }}>{generated ? '✨' : '📦'}</span>
                            <div>
                                <div style={{ fontWeight: 'bold', fontSize: '14px', color: generated ? lime : '#86efac' }}>
                                    {generated ? 'Dynamically Generated' : 'Fetched from Database'}
                                </div>
                                <div style={{ fontSize: '12px', color: textDim }}>
                                    {generated
                                        ? `${slots.length} slots generated on the fly from the ${new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' })} template — no DB rows created yet`
                                        : `${slots.length} slots already existed in DB for this date`}
                                </div>
                            </div>
                            <div style={{ marginLeft: 'auto', fontWeight: 'bold', fontSize: '22px', color: lime }}>{slots.length}</div>
                        </div>

                        <h2 style={{ fontSize: '14px', fontWeight: 'bold', color: textDim, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 12px' }}>
                            Step 2 — Click a Slot to Book
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                            {slots.map((slot) => {
                                const isSelected = bookingSlot?.start_time === slot.start_time;
                                return (
                                    <button
                                        key={slot.id || slot.start_time}
                                        onClick={() => { setBookingSlot(slot); setBookResult(null); }}
                                        style={{
                                            background: isSelected ? 'rgba(215,255,30,0.12)' : 'rgba(255,255,255,0.04)',
                                            border: isSelected ? `2px solid ${lime}` : border,
                                            borderRadius: '14px',
                                            padding: '14px',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{ fontWeight: 'bold', fontSize: '15px', color: isSelected ? lime : textLight }}>
                                            {formatTime(slot.start_time)}
                                        </div>
                                        <div style={{ fontSize: '11px', color: textDim, marginTop: '2px' }}>
                                            → {formatTime(slot.end_time)}
                                        </div>
                                        <div style={{ marginTop: '8px', fontSize: '12px', color: isSelected ? lime : '#86efac', fontWeight: 'bold' }}>
                                            ${parseFloat(slot.price || 0).toFixed(2)}
                                        </div>
                                        {slot.virtual && (
                                            <div style={{ marginTop: '4px', fontSize: '10px', color: '#7dd3fc' }}>virtual</div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {slots.length === 0 && !loading && info && (
                    <div style={{ padding: '32px', textAlign: 'center', color: textDim, border, borderRadius: '16px', fontSize: '14px' }}>
                        📭 {info || 'No available slots for this day'}
                    </div>
                )}

                {/* Booking Form */}
                {bookingSlot && (
                    <div style={{ background: 'rgba(215,255,30,0.04)', border: `1px solid rgba(215,255,30,0.2)`, borderRadius: '20px', padding: '24px', marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '14px', fontWeight: 'bold', color: lime, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 4px' }}>
                            Step 3 — Confirm Booking
                        </h2>
                        <p style={{ margin: '0 0 20px', fontSize: '13px', color: textDim }}>
                            Booking <strong style={{ color: textLight }}>{formatTime(bookingSlot.start_time)} – {formatTime(bookingSlot.end_time)}</strong> on <strong style={{ color: textLight }}>{date}</strong> for <strong style={{ color: lime }}>${parseFloat(bookingSlot.price || 0).toFixed(2)}</strong>
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ fontSize: '12px', color: textDim, display: 'block', marginBottom: '6px' }}>Client Name</label>
                                <input
                                    id="tester-book-name"
                                    value={bookName}
                                    onChange={e => setBookName(e.target.value)}
                                    placeholder="Test User"
                                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border, borderRadius: '10px', color: textLight, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: textDim, display: 'block', marginBottom: '6px' }}>Client Email</label>
                                <input
                                    id="tester-book-email"
                                    value={bookEmail}
                                    onChange={e => setBookEmail(e.target.value)}
                                    placeholder="test@example.com"
                                    style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border, borderRadius: '10px', color: textLight, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>
                        </div>

                        {/* API call preview */}
                        <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', fontFamily: 'monospace', fontSize: '11px', color: '#7dd3fc', marginBottom: '16px' }}>
                            POST /api/slots/book {'{'} trainer_id, date: "<span style={{ color: lime }}>{date}</span>", start_time: "<span style={{ color: lime }}>{bookingSlot.start_time}</span>", name, email {'}'}
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                id="tester-confirm-book"
                                onClick={handleBook}
                                disabled={bookLoading}
                                style={{ flex: 1, padding: '12px', background: lime, color: '#000', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px', cursor: bookLoading ? 'not-allowed' : 'pointer', opacity: bookLoading ? 0.7 : 1 }}
                            >
                                {bookLoading ? 'Booking...' : '✓ Confirm Booking'}
                            </button>
                            <button
                                onClick={() => setBookingSlot(null)}
                                style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.06)', border, borderRadius: '10px', color: textLight, fontSize: '13px', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Booking Result */}
                {bookResult && (
                    <div style={{
                        padding: '20px 24px',
                        background: bookResult.success ? 'rgba(134,239,172,0.08)' : 'rgba(239,68,68,0.1)',
                        border: `1px solid ${bookResult.success ? 'rgba(134,239,172,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        borderRadius: '16px',
                        marginBottom: '24px'
                    }}>
                        {bookResult.success ? (
                            <>
                                <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#86efac', marginBottom: '8px' }}>
                                    ✅ Booking Confirmed {bookResult.created ? '(new DB row created)' : '(existing slot updated)'}
                                </div>
                                <div style={{ fontFamily: 'monospace', fontSize: '12px', color: textDim, background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', overflowX: 'auto' }}>
                                    {JSON.stringify(bookResult.slot, null, 2)}
                                </div>
                            </>
                        ) : (
                            <div style={{ fontWeight: 'bold', color: '#ef4444' }}>❌ {bookResult.error}</div>
                        )}
                    </div>
                )}

                {/* How it works */}
                <div style={{ background: card, border, borderRadius: '16px', padding: '20px', marginTop: '8px' }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: '13px', color: textDim, textTransform: 'uppercase', letterSpacing: '1px' }}>How Dynamic Slots Work</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
                        {[
                            { icon: '📋', title: 'Trainer sets rules', desc: 'Configure open/closed hours per weekday in the Planner (no dates, just days)' },
                            { icon: '🗓️', title: 'Client picks any date', desc: 'Flutter/client calls /api/slots/available?trainer_id=X&date=Y for any date, near or far' },
                            { icon: '⚡', title: 'Slots generated on demand', desc: 'Backend maps date→weekday→template, returns virtual slots. DB row only created on actual booking.' }
                        ].map(({ icon, title, desc }) => (
                            <div key={title} style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border }}>
                                <div style={{ fontSize: '24px', marginBottom: '8px' }}>{icon}</div>
                                <div style={{ fontWeight: 'bold', fontSize: '13px', color: textLight, marginBottom: '4px' }}>{title}</div>
                                <div style={{ fontSize: '12px', color: textDim, lineHeight: '1.5' }}>{desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
