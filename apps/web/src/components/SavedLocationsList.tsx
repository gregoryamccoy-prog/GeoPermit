import { useState, useEffect } from 'react';
import type { WatchLocation } from '@lcm/types';

interface Props {
  onFlyTo: (lat: number, lng: number) => void;
}

export default function SavedLocationsList({ onFlyTo }: Props) {
  const [locations, setLocations] = useState<WatchLocation[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch('/api/watch-locations');
      if (!res.ok) return;
      const data = (await res.json()) as WatchLocation[];
      setLocations(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: number) {
    await fetch(`/api/watch-locations/${id}`, { method: 'DELETE' });
    setLocations((prev) => prev.filter((l) => l.id !== id));
  }

  if (loading) {
    return <div style={{ padding: 16, fontSize: 13, color: '#6b7280' }}>Loading…</div>;
  }

  if (locations.length === 0) {
    return (
      <div style={{ padding: 16, fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
        No saved locations yet.
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px 16px' }}>
      {locations.map((loc) => (
        <div
          key={loc.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 0', borderBottom: '1px solid #f1f5f9',
          }}
        >
          <button
            onClick={() => onFlyTo(loc.latitude, loc.longitude)}
            style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e3a5f' }}>{loc.name}</div>
            {loc.address && (
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{loc.address}</div>
            )}
          </button>
          <button
            onClick={() => handleDelete(loc.id)}
            title="Delete"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, padding: '2px 4px' }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
