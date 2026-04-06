interface Props {
  showConstruction: boolean;
  showRow: boolean;
  onToggle: (layer: 'construction' | 'row', value: boolean) => void;
}

export default function LayerToggle({ showConstruction, showRow, onToggle }: Props) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
        Layers
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={checkboxLabel}>
          <input
            type="checkbox"
            checked={showConstruction}
            onChange={(e) => onToggle('construction', e.target.checked)}
          />
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#2563eb', display: 'inline-block', flexShrink: 0 }} />
          Construction Permits
        </label>
        <label style={checkboxLabel}>
          <input
            type="checkbox"
            checked={showRow}
            onChange={(e) => onToggle('row', e.target.checked)}
          />
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ea580c', display: 'inline-block', flexShrink: 0 }} />
          ROW Permits
        </label>
        <label style={{ ...checkboxLabel, opacity: 0.45, cursor: 'not-allowed' }}>
          <input type="checkbox" disabled />
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#6b7280', display: 'inline-block', flexShrink: 0 }} />
          State Closures (coming)
        </label>
      </div>
    </div>
  );
}

const checkboxLabel: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  cursor: 'pointer',
};
