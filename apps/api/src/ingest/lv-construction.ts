import { pool } from '../db/client.js';
import { fetchAllFeatures } from './arcgis-client.js';

const BASE_URL =
  'https://services1.arcgis.com/79kfd2K6fskCAkyg/arcgis/rest/services/active_construction_permits/FeatureServer/0';
const DATASET = 'active_construction_permits';

function toTimestamp(epoch: unknown): string | null {
  if (epoch == null || epoch === '') return null;
  const ms = Number(epoch);
  if (!isFinite(ms) || ms === 0) return null;
  return new Date(ms).toISOString();
}

function toFloat(v: unknown): number | null {
  const n = Number(v);
  return isFinite(n) && n !== 0 ? n : null;
}

export async function ingestLvConstruction(): Promise<number> {
  const { rows: [sys] } = await pool.query<{ id: number }>(
    `SELECT id FROM source_systems WHERE code = 'lv_construction'`,
  );
  if (!sys) throw new Error('source_system lv_construction not found — run db:seed first');
  const sourceSystemId = sys.id;

  const features = await fetchAllFeatures(BASE_URL);
  let newCount = 0;
  let updatedCount = 0;

  for (const feature of features) {
    const a = feature.attributes;
    const sourceRecordId = String(a['ObjectId'] ?? a['OBJECTID'] ?? '');
    const lat = toFloat(a['LATITUDE']);
    const lon = toFloat(a['LONGITUDE']);

    // Upsert permit first. (xmax = 0) is TRUE only on a genuine INSERT —
    // on an UPDATE xmax holds the transaction ID of the last modifier.
    const { rows: [result] } = await pool.query<{ id: number; is_new: boolean }>(
      `INSERT INTO permits (
         source_system_id, source_dataset, source_record_id,
         permit_number, permit_type, permit_status, category_name,
         contractor, zoning, sqft, permit_fee, project_costs,
         address, city, state, zipcode, district, neighborhood,
         issue_date, geom, raw_payload
       ) VALUES (
         $1, $2, $3,
         $4, $5, $6, 'construction',
         $7, $8, $9, $10, $11,
         $12, $13, $14, $15, $16, $17,
         $18,
         CASE WHEN $19::double precision IS NOT NULL AND $20::double precision IS NOT NULL
              THEN ST_SetSRID(ST_MakePoint($20::double precision, $19::double precision), 4326)::geography
              ELSE NULL END,
         $21
       )
       ON CONFLICT (source_system_id, source_dataset, source_record_id) DO UPDATE SET
         last_seen_at   = NOW(),
         is_active      = TRUE,
         permit_status  = EXCLUDED.permit_status,
         raw_payload    = EXCLUDED.raw_payload,
         geom           = EXCLUDED.geom
       RETURNING id, (xmax = 0) AS is_new`,
      [
        sourceSystemId,
        DATASET,
        sourceRecordId,
        a['PERMIT_NUMBER'] ?? null,
        a['PERMIT_TYPE'] ?? null,
        a['PERMIT_STATUS'] ?? null,
        a['CONTRACTOR'] ?? null,
        a['ZONING'] ?? null,
        a['SQFT'] ?? null,
        a['PERMIT_FEE'] ?? null,
        a['PROJECT_COSTS'] ?? null,
        a['ADDRESS'] ?? null,
        a['CITY'] ?? null,
        a['STATE'] ?? null,
        a['ZIPCODE'] ?? null,
        a['DISTRICT'] ?? null,
        a['NEIGHBORHOOD'] ?? null,
        toTimestamp(a['ISSUE_DATE']),
        lat,
        lon,
        JSON.stringify(a),
      ],
    );

    // Only archive the raw payload the very first time we see this permit.
    if (result.is_new) {
      await pool.query(
        `INSERT INTO raw_ingest_events (source_system_id, source_dataset, source_record_id, payload)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (source_system_id, source_dataset, source_record_id) DO NOTHING`,
        [sourceSystemId, DATASET, sourceRecordId, JSON.stringify(a)],
      );
      newCount++;
    } else {
      updatedCount++;
    }
  }

  // Mark permits not seen in the last 24 h as inactive
  await pool.query(
    `UPDATE permits SET is_active = FALSE
     WHERE source_system_id = $1
       AND source_dataset   = $2
       AND last_seen_at < NOW() - INTERVAL '24 hours'`,
    [sourceSystemId, DATASET],
  );

  console.log(`  [lv_construction] new: ${newCount}, refreshed: ${updatedCount}`);
  return newCount + updatedCount;
}
