-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Source systems
CREATE TABLE IF NOT EXISTS source_systems (
  id   SERIAL PRIMARY KEY,
  code TEXT   NOT NULL UNIQUE,
  name TEXT   NOT NULL,
  base_url TEXT,
  notes    TEXT
);

-- Raw ingested records (keep original payloads)
CREATE TABLE IF NOT EXISTS raw_ingest_events (
  id               BIGSERIAL PRIMARY KEY,
  source_system_id INT       NOT NULL REFERENCES source_systems(id),
  source_dataset   TEXT      NOT NULL,
  source_record_id TEXT,
  fetched_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload          JSONB     NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_raw_ingest_source_dataset
  ON raw_ingest_events (source_system_id, source_dataset);

CREATE INDEX IF NOT EXISTS idx_raw_ingest_payload_gin
  ON raw_ingest_events USING GIN (payload);

-- Locations users care about
CREATE TABLE IF NOT EXISTS watch_locations (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT      NOT NULL,
  address    TEXT,
  geom       GEOGRAPHY(POINT, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watch_locations_geom
  ON watch_locations USING GIST (geom);

-- Permits (normalised from all sources)
CREATE TABLE IF NOT EXISTS permits (
  id               BIGSERIAL PRIMARY KEY,
  source_system_id INT     NOT NULL REFERENCES source_systems(id),
  source_dataset   TEXT    NOT NULL,
  source_record_id TEXT    NOT NULL,
  permit_number    TEXT,
  permit_type      TEXT,
  permit_status    TEXT,
  category_name    TEXT,
  work_type        TEXT,
  contractor       TEXT,
  applicant_name   TEXT,
  work_description TEXT,
  zoning           TEXT,
  sqft             NUMERIC,
  permit_fee       NUMERIC,
  project_costs    NUMERIC,
  address          TEXT,
  city             TEXT,
  state            TEXT,
  zipcode          TEXT,
  district         TEXT,
  neighborhood     TEXT,
  start_date       TIMESTAMPTZ,
  end_date         TIMESTAMPTZ,
  issue_date       TIMESTAMPTZ,
  geom             GEOGRAPHY(POINT, 4326),
  raw_payload      JSONB NOT NULL,
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  UNIQUE (source_system_id, source_dataset, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_permits_geom
  ON permits USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_permits_issue_date
  ON permits (issue_date DESC);

CREATE INDEX IF NOT EXISTS idx_permits_type_status
  ON permits (permit_type, permit_status);

CREATE INDEX IF NOT EXISTS idx_permits_raw_payload_gin
  ON permits USING GIN (raw_payload);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id         BIGSERIAL PRIMARY KEY,
  email      TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alert rules
CREATE TABLE IF NOT EXISTS alert_rules (
  id                   BIGSERIAL PRIMARY KEY,
  user_id              BIGINT  NOT NULL REFERENCES users(id),
  name                 TEXT    NOT NULL,
  center_geom          GEOGRAPHY(POINT, 4326) NOT NULL,
  radius_meters        INT     NOT NULL,
  include_permit_types TEXT[],
  include_work_types   TEXT[],
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_geom
  ON alert_rules USING GIST (center_geom);

-- Alert matches / delivery tracking
CREATE TABLE IF NOT EXISTS alert_matches (
  id              BIGSERIAL PRIMARY KEY,
  alert_rule_id   BIGINT NOT NULL REFERENCES alert_rules(id),
  permit_id       BIGINT NOT NULL REFERENCES permits(id),
  matched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivery_status TEXT    NOT NULL DEFAULT 'pending',
  UNIQUE (alert_rule_id, permit_id)
);
