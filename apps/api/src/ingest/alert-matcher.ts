import { pool } from '../db/client.js';

export async function runAlertMatcher(): Promise<number> {
  // For each active alert rule, find permits first seen in the last 24 h
  // within the rule's radius. Insert into alert_matches (ignore duplicates).
  const result = await pool.query<{ alert_rule_id: number; permit_id: number }>(
    `INSERT INTO alert_matches (alert_rule_id, permit_id)
     SELECT ar.id AS alert_rule_id, p.id AS permit_id
     FROM alert_rules ar
     JOIN permits p
       ON p.geom IS NOT NULL
      AND ST_DWithin(p.geom, ar.center_geom, ar.radius_meters)
     WHERE ar.is_active = TRUE
       AND p.first_seen_at >= NOW() - INTERVAL '1 day'
       AND (ar.include_permit_types IS NULL
            OR p.permit_type = ANY(ar.include_permit_types)
            OR p.category_name = ANY(ar.include_permit_types))
       AND (ar.include_work_types IS NULL
            OR p.work_type = ANY(ar.include_work_types))
     ON CONFLICT (alert_rule_id, permit_id) DO NOTHING
     RETURNING alert_rule_id, permit_id`,
  );

  return result.rowCount ?? 0;
}
