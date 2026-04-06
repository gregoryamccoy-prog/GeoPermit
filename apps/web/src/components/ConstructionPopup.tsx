import type { Permit } from '@lcm/types';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

interface Props {
  permit: Permit;
}

export default function ConstructionPopup({ permit: p }: Props) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.5, minWidth: 220 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: '#1e3a5f' }}>
        {p.permit_type ?? 'Construction Permit'}
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          <Row label="Permit #" value={p.permit_number} />
          <Row label="Status" value={p.permit_status} />
          <Row label="Address" value={[p.address, p.city, p.state].filter(Boolean).join(', ')} />
          <Row label="Contractor" value={p.contractor} />
          <Row label="Zoning" value={p.zoning} />
          <Row label="Sqft" value={p.sqft?.toLocaleString()} />
          <Row label="Project Cost" value={formatCurrency(p.project_costs)} />
          <Row label="Issued" value={formatDate(p.issue_date)} />
          {p.neighborhood && <Row label="Neighborhood" value={p.neighborhood} />}
          {p.district && <Row label="District" value={p.district} />}
        </tbody>
      </table>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === '') return null;
  return (
    <tr>
      <td style={{ paddingRight: 8, color: '#6b7280', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
        {label}
      </td>
      <td style={{ fontWeight: 500 }}>{String(value)}</td>
    </tr>
  );
}
