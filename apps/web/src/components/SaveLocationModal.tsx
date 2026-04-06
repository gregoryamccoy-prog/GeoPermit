import { useState } from 'react';

interface Props {
  defaultLat: number;
  defaultLng: number;
  onClose: () => void;
}

export default function SaveLocationModal({ defaultLat, defaultLng, onClose }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [radiusMeters, setRadiusMeters] = useState(1609);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.');
      return;
    }
    setSaving(true);
    try {
      // Upsert user
      const userRes = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!userRes.ok) throw new Error('Failed to create user');
      const user = await userRes.json() as { id: number };

      // Save watch location
      await fetch('/api/watch-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), lat: defaultLat, lng: defaultLng }),
      });

      // Create alert rule
      const ruleRes = await fetch('/api/alert-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: name.trim(),
          lat: defaultLat,
          lng: defaultLng,
          radiusMeters,
        }),
      });
      if (!ruleRes.ok) throw new Error('Failed to create alert rule');

      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={backdropStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f' }}>Save Location & Alert</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>✕</button>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <p style={{ color: '#166534', fontWeight: 600 }}>Location saved!</p>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
              You'll receive email alerts for new permit activity within your chosen radius.
            </p>
            <button onClick={onClose} style={{ ...primaryBtn, marginTop: 16 }}>Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: '#6b7280', background: '#f1f5f9', padding: '8px 10px', borderRadius: 6 }}>
              Center: {defaultLat.toFixed(5)}, {defaultLng.toFixed(5)}
            </div>

            <label style={labelStyle}>
              Location Name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My House" style={inputStyle} required />
            </label>

            <label style={labelStyle}>
              Alert Radius
              <select value={radiusMeters} onChange={(e) => setRadiusMeters(parseInt(e.target.value, 10))} style={inputStyle}>
                <option value={402}>¼ mile</option>
                <option value={805}>½ mile</option>
                <option value={1609}>1 mile</option>
                <option value={3219}>2 miles</option>
                <option value={8047}>5 miles</option>
              </select>
            </label>

            <label style={labelStyle}>
              Your Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} required />
            </label>

            {error && <div style={{ color: '#dc2626', fontSize: 13 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={onClose} style={secondaryBtn}>Cancel</button>
              <button type="submit" disabled={saving} style={primaryBtn}>
                {saving ? 'Saving…' : 'Save & Subscribe'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
};

const modalStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 10, padding: 24, width: 360,
  maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
};

const inputStyle: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6,
  fontSize: 13, width: '100%',
};

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: 12, color: '#6b7280', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.04em',
};

const primaryBtn: React.CSSProperties = {
  flex: 1, padding: '9px 14px', background: '#2563eb', color: '#fff',
  border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
};

const secondaryBtn: React.CSSProperties = {
  flex: 1, padding: '9px 14px', background: '#fff', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: 13,
};
