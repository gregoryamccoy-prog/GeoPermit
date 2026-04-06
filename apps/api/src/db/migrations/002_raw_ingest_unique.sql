-- Enforce one raw payload per source record so re-runs cannot insert duplicates.
-- ON CONFLICT DO NOTHING in the ingestors relies on this constraint.
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_ingest_unique
  ON raw_ingest_events (source_system_id, source_dataset, source_record_id);
