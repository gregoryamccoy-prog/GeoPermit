import { pool } from './client.js';

async function seed(): Promise<void> {
  await pool.query(`
    INSERT INTO source_systems (code, name, base_url, notes) VALUES
    (
      'lv_construction',
      'Louisville Active Construction Permits',
      'https://services1.arcgis.com/79kfd2K6fskCAkyg/arcgis/rest/services/active_construction_permits/FeatureServer/0',
      'Louisville Metro public ArcGIS FeatureServer'
    ),
    (
      'lv_row',
      'Louisville ROW Construction Permits',
      'https://services1.arcgis.com/79kfd2K6fskCAkyg/arcgis/rest/services/Louisville_KY_ROW_Construction_Permits_new/FeatureServer/0',
      'Louisville right-of-way permits affecting roadway traffic'
    )
    ON CONFLICT (code) DO NOTHING;
  `);
  console.log('✓ Seed complete');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
