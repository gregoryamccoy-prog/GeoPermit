import { pool } from '../db/client.js';
import { fetchAllFeatures } from './arcgis-client.js';

const BASE_URL =
  'https://services1.arcgis.com/79kfd2K6fskCAkyg/arcgis/rest/services/Louisville_KY_ROW_Construction_Permits_new/FeatureServer/0';
const DATASET = 'row_construction_permits';

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

export async function ingestLvRow(): Promise<number> {
  const { rows: [sys] } = await pool.query<{ id: number }>(
    `SELECT id FROM source_systems WHERE code = 'lv_row'`,
  );
  if (!sys) throw new Error('source_system lv_row not found — run db:seed first');
  const sourceSystemId = sys.id;

  const features = await fetchAllFeatures(BASE_URL);
  let newCount = 0;
  let updatedCount = 0;

  for (const feature of features) {
    const a = feature.attributes;
    const sourceRecordId = String(a['ObjectId'] ?? a['OBJECTID'] ?? '');
    const lat = toFloat(a['LATITUDE']);
    const lon = toFloat(a['LONGITUDE']);

    // Upsert permit first. (xmax = 0) is TRUE only on a genuine INSERT.
    const { rows: [result] } = await pool.query<{ id: number; is_new: boolean }>(
      `INSERT INTO permits (
         source_system_id, source_dataset, source_record_id,
         permit_number, category_name, work_type, applicant_name,
         work_description, address, city, state, zipcode,
         start_date, end_date, geom, raw_payload
       ) VALUES (
         $1, $2, $3,
         $4, 'row', $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13,
         CASE WHEN $14::double precision IS NOT NULL AND $15::double precision IS NOT NULL
              THEN ST_SetSRID(ST_MakePoint($15::double precision, $14::double precision), 4326)::geography
              ELSE NULL END,
         $16
       )
       ON CONFLICT (source_system_id, source_dataset, source_record_id) DO UPDATE SET
         last_seen_at     = NOW(),
         is_active        = TRUE,
         work_description = EXCLUDED.work_description,
         start_date       = EXCLUDED.start_date,
         end_date         = EXCLUDED.end_date,
         raw_payload      = EXCLUDED.raw_payload,
         geom             = EXCLUDED.geom
       RETURNING id, (xmax = 0) AS is_new`,
      [
        sourceSystemId,
        DATASET,
        sourceRecordId,
        a['PERMIT_NO'] ?? null,
        a['WORK_TYPE'] ?? null,
        a['APPLICANT_NAME'] ?? null,
        a['WORK_DESCRIPTION'] ?? null,
        a['STREET_ADDRESS'] ?? null,
        a['CITY'] ?? null,
        a['STATE'] ?? null,
        a['ZIP'] ?? null,
        toTimestamp(a['FROM_DATE']),
        toTimestamp(a['TO_DATE']),
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

  console.log(`  [lv_row] new: ${newCount}, refreshed: ${updatedCount}`);
  return newCount + updatedCount;
}
