import type { Permit } from '@lcm/types';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface Props {
  permit: Permit;
}

export default function RowPopup({ permit: p }: Props) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.5, minWidth: 240 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: '#92400e' }}>
        {p.work_type ?? 'ROW Permit'}
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          <Row label="Permit #" value={p.permit_number} />
          <Row label="Address" value={[p.address, p.city, p.state].filter(Boolean).join(', ')} />
          <Row label="Applicant" value={p.applicant_name} />
          <Row label="Start" value={formatDate(p.start_date)} />
          <Row label="End" value={formatDate(p.end_date)} />
        </tbody>
      </table>
      {p.work_description && (
        <div style={{ marginTop: 8, color: '#374151', borderTop: '1px solid #e5e7eb', paddingTop: 6 }}>
          {p.work_description}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <tr>
      <td style={{ paddingRight: 8, color: '#6b7280', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
        {label}
      </td>
      <td style={{ fontWeight: 500 }}>{value}</td>
    </tr>
  );
}
