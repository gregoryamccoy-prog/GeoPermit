import type { PermitFilters } from '../hooks/usePermits';
import type { GeocodeResult } from '@lcm/types';

const RADII = [
  { label: '¼ mile', value: 402 },
  { label: '½ mile', value: 805 },
  { label: '1 mile', value: 1609 },
  { label: '2 miles', value: 3219 },
  { label: '5 miles', value: 8047 },
];

interface Props {
  filters: PermitFilters;
  onChange: (f: PermitFilters) => void;
  onAddressSelect: (lat: number, lng: number) => void;
}

export default function FilterSidebar({ filters, onChange, onAddressSelect }: Props) {
  async function handleAddressSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const query = (form.elements.namedItem('address') as HTMLInputElement).value.trim();
    if (!query) return;

    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      if (!res.ok) return;
      const results = (await res.json()) as GeocodeResult[];
      if (results.length > 0) {
        onAddressSelect(parseFloat(results[0].lat), parseFloat(results[0].lon));
      }
    } catch (err) {
      console.error('[geocode] error:', err);
    }
  }

  function set<K extends keyof PermitFilters>(key: K, value: PermitFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Address search */}
      <form onSubmit={handleAddressSearch} style={{ display: 'flex', gap: 6 }}>
        <input
          name="address"
          placeholder="Search address…"
          style={inputStyle}
        />
        <button type="submit" style={btnStyle}>Go</button>
      </form>

      {/* Radius */}
      <label style={labelStyle}>
        Radius
        <select
          value={filters.radiusMeters}
          onChange={(e) => set('radiusMeters', parseInt(e.target.value, 10))}
          style={inputStyle}
        >
          {RADII.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </label>

      {/* Permit type */}
      <label style={labelStyle}>
        Permit Type
        <input
          placeholder="e.g. Residential New"
          value={filters.permitType}
          onChange={(e) => set('permitType', e.target.value)}
          style={inputStyle}
        />
      </label>

      {/* Work type */}
      <label style={labelStyle}>
        Work Type
        <input
          placeholder="e.g. Lane Closure"
          value={filters.workType}
          onChange={(e) => set('workType', e.target.value)}
          style={inputStyle}
        />
      </label>

      {/* Date range */}
      <label style={labelStyle}>
        From Date
        <input
          type="date"
          value={filters.fromDate}
          onChange={(e) => set('fromDate', e.target.value)}
          style={inputStyle}
        />
      </label>
      <label style={labelStyle}>
        To Date
        <input
          type="date"
          value={filters.toDate}
          onChange={(e) => set('toDate', e.target.value)}
          style={inputStyle}
        />
      </label>

      {/* Active only */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={filters.activeOnly}
          onChange={(e) => set('activeOnly', e.target.checked)}
        />
        Active permits only
      </label>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '6px 8px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 13,
  width: '100%',
  background: '#fff',
};

const btnStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  color: '#6b7280',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};
