import nodemailer from 'nodemailer';
import { pool } from '../db/client.js';
import cron from 'node-cron';

interface PendingMatch {
  alert_match_id: number;
  user_email: string;
  rule_name: string;
  permit_number: string | null;
  permit_type: string | null;
  category_name: string | null;
  work_type: string | null;
  address: string | null;
  city: string | null;
  contractor: string | null;
  applicant_name: string | null;
  project_costs: number | null;
  issue_date: string | null;
  start_date: string | null;
  latitude: number | null;
  longitude: number | null;
}

function buildTransport() {
  const host = process.env['SMTP_HOST'];
  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env['SMTP_PORT'] ?? '587', 10),
    auth: {
      user: process.env['SMTP_USER'],
      pass: process.env['SMTP_PASS'],
    },
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(n: number | null): string {
  if (n == null) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function buildEmailHtml(rows: PendingMatch[]): string {
  const items = rows
    .map((r) => {
      const mapLink =
        r.latitude != null && r.longitude != null
          ? `<a href="http://localhost:5173/?lat=${r.latitude}&lng=${r.longitude}&zoom=16">View on map</a>`
          : '';
      const label =
        r.permit_type ??
        r.work_type ??
        r.category_name ??
        'Permit';
      const who = r.contractor ?? r.applicant_name ?? '';
      return `
        <tr>
          <td>${label}</td>
          <td>${r.address ?? 'N/A'}, ${r.city ?? ''}</td>
          <td>${who}</td>
          <td>${formatCurrency(r.project_costs)}</td>
          <td>${formatDate(r.issue_date ?? r.start_date)}</td>
          <td>${mapLink}</td>
        </tr>`;
    })
    .join('');

  return `
    <h2>New Permit Activity Near Your Saved Location</h2>
    <table border="1" cellpadding="6" style="border-collapse:collapse;">
      <thead>
        <tr>
          <th>Type</th><th>Address</th><th>Contractor/Applicant</th>
          <th>Project Cost</th><th>Date</th><th>Map</th>
        </tr>
      </thead>
      <tbody>${items}</tbody>
    </table>
  `;
}

export async function sendPendingAlerts(): Promise<number> {
  const transport = buildTransport();
  if (!transport) {
    console.warn('[mailer] SMTP_HOST not configured — skipping email delivery');
    return 0;
  }

  const { rows } = await pool.query<PendingMatch>(`
    SELECT
      am.id              AS alert_match_id,
      u.email            AS user_email,
      ar.name            AS rule_name,
      p.permit_number,
      p.permit_type,
      p.category_name,
      p.work_type,
      p.address,
      p.city,
      p.contractor,
      p.applicant_name,
      p.project_costs,
      p.issue_date,
      p.start_date,
      ST_Y(p.geom::geometry) AS latitude,
      ST_X(p.geom::geometry) AS longitude
    FROM alert_matches am
    JOIN alert_rules ar ON ar.id = am.alert_rule_id
    JOIN users u        ON u.id  = ar.user_id
    JOIN permits p      ON p.id  = am.permit_id
    WHERE am.delivery_status = 'pending'
    ORDER BY u.email, ar.name
  `);

  if (rows.length === 0) return 0;

  // Group by email
  const byEmail = new Map<string, PendingMatch[]>();
  for (const row of rows) {
    const list = byEmail.get(row.user_email) ?? [];
    list.push(row);
    byEmail.set(row.user_email, list);
  }

  const from = process.env['SMTP_FROM'] ?? 'alerts@local-change-monitor.dev';
  let sent = 0;

  for (const [email, matches] of byEmail) {
    try {
      await transport.sendMail({
        from,
        to: email,
        subject: `${matches.length} new permit${matches.length > 1 ? 's' : ''} near your saved locations`,
        html: buildEmailHtml(matches),
      });

      const ids = matches.map((m) => m.alert_match_id);
      await pool.query(
        `UPDATE alert_matches SET delivery_status = 'sent' WHERE id = ANY($1)`,
        [ids],
      );
      sent += matches.length;
    } catch (err) {
      console.error(`[mailer] failed to send to ${email}:`, err);
    }
  }

  return sent;
}

export function startMailerSchedule(): void {
  // Daily at 7 AM
  cron.schedule('0 7 * * *', () => {
    sendPendingAlerts().catch((err) =>
      console.error('[mailer] unexpected error:', err),
    );
  });
  console.log('[mailer] scheduled — daily at 07:00');
}
