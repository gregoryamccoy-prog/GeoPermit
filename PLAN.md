# Local Change Monitor — Implementation Plan

## Overview

TypeScript monorepo — React+Vite frontend with Leaflet map, Fastify backend, PostgreSQL+PostGIS database — ingesting Louisville ArcGIS permit data on a 6-hour cron, serving a radius-query API, and delivering email alerts for new nearby activity.

---

## Phase 0 — Project Setup & Infrastructure

1. **Initialize monorepo** with `apps/web`, `apps/api`, and `packages/types` (shared TypeScript interfaces). Use `pnpm workspaces`.
2. **TypeScript config** — `tsconfig.base.json` at root, `strict: true`, extended per package.
3. **Docker Compose** — `docker-compose.yml` with `postgis/postgis:16-3.4`, port 5432, env vars. Add `.env.example`.
4. **Database migrations** — Plain SQL via `node-pg-migrate` or a custom runner. Apply schema from PRD §10 in order:
   - `postgis extension → source_systems → raw_ingest_events → watch_locations → permits → users → alert_rules → alert_matches`
5. **Seed source systems** — Insert `lv_construction` and `lv_row` rows into `source_systems` as part of migration or a seed script.
6. **Env config** — `DATABASE_URL`, `PORT`, `SMTP_*` vars loaded via `dotenv`.

---

## Phase 1 — Data Ingestion Service

*Depends on Phase 0.*

7. **Backend scaffold** — `apps/api` with Fastify + TypeScript. Entry `src/index.ts`, ingestion module at `src/ingest/`.
8. **ArcGIS paginating client** (`src/ingest/arcgis-client.ts`) — Generic fetch loop:
   - Params: `where=1=1`, `outFields=*`, `f=pjson`, `resultRecordCount=1000`, `resultOffset=N`
   - Loop until returned feature count < 1000
9. **Louisville construction permit ingestor** (`src/ingest/lv-construction.ts`):
   - Endpoint: `https://services1.arcgis.com/79kfd2K6fskCAkyg/arcgis/rest/services/active_construction_permits/FeatureServer/0`
   - Map `LATITUDE`/`LONGITUDE` → `ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography`
   - Convert `ISSUE_DATE` epoch ms → timestamptz
   - Upsert via `ON CONFLICT (source_system_id, source_dataset, source_record_id) DO UPDATE SET last_seen_at = NOW(), is_active = TRUE, raw_payload = EXCLUDED.raw_payload`
   - Field map: `PERMIT_NUMBER`, `PERMIT_TYPE`, `PERMIT_STATUS`, `CONTRACTOR`, `ZONING`, `SQFT`, `PERMIT_FEE`, `PROJECT_COSTS`, `ADDRESS`, `CITY`, `STATE`, `ZIPCODE`, `DISTRICT`, `NEIGHBORHOOD`, `ISSUE_DATE`
10. **Louisville ROW permit ingestor** (`src/ingest/lv-row.ts`):
    - Endpoint: `https://services1.arcgis.com/79kfd2K6fskCAkyg/arcgis/rest/services/Louisville_KY_ROW_Construction_Permits_new/FeatureServer/0`
    - Field map: `PERMIT_NO`, `APPLICANT_NAME`, `FROM_DATE` → `start_date`, `TO_DATE` → `end_date`, `WORK_DESCRIPTION`, `WORK_TYPE`, `STREET_ADDRESS`, `CITY`, `STATE`, `ZIP`
11. **Scheduler** (`src/ingest/scheduler.ts`) — `node-cron` every 6 hours. Log start/end, record count, errors. Catch and continue on error (do not crash).
12. **Mark stale permits inactive** — After each full ingest cycle:
    ```sql
    UPDATE permits SET is_active = FALSE
    WHERE source_system_id = $1 AND last_seen_at < NOW() - INTERVAL '24 hours';
    ```

---

## Phase 2 — REST API

*Depends on Phase 0 schema.*

13. **`GET /api/permits`** — Query params: `lat`, `lng`, `radiusMeters` (default 1609), `permitType`, `workType`, `activeOnly` (default `true`), `fromDate`, `toDate`, `limit` (default 200). Uses `ST_DWithin` PostGIS query. Returns GeoJSON FeatureCollection.
14. **`GET /api/permits/:id`** — Single permit row with full `raw_payload`.
15. **`GET /api/geocode?q=<address>`** — Proxy to Nominatim (`https://nominatim.openstreetmap.org/search?format=json&q=...`). No API key required. Add `User-Agent` header per Nominatim usage policy.
16. **`GET/POST/DELETE /api/watch-locations`** — CRUD for `watch_locations` table. POST body: `{ name, address, lat, lng }`.
17. **`POST /api/users`** — Create user by email. Returns user id.
18. **`GET/POST/DELETE /api/alert-rules`** — Scoped by `userId` query param. POST body: `{ userId, name, lat, lng, radiusMeters, includePermitTypes[], includeWorkTypes[] }`.
19. **`GET /api/closures`** — Stub returning `[]` until Phase 5 KYTC spike is complete.

---

## Phase 3 — Frontend MVP

*Depends on Phase 2. Can be scaffolded in parallel against mock data.*

20. **Frontend scaffold** — `apps/web` with React + Vite + TypeScript. Install `leaflet`, `react-leaflet`, `@types/leaflet`. Proxy `/api` to backend in `vite.config.ts`.
21. **`MapPage.tsx`** — Full-screen `MapContainer`, centered on Louisville `[38.2527, -85.7585]`, zoom 12. OpenStreetMap `TileLayer` (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`).
22. **`usePermits` hook** (`src/hooks/usePermits.ts`) — Fetch `/api/permits` on map `moveend`/`zoomend`. Debounce 500ms. Re-fetch on filter changes.
23. **Construction permit markers** — Blue `CircleMarker` per feature.
24. **ROW permit markers** — Orange `CircleMarker` per feature.
25. **`ConstructionPopup.tsx`** — Display: permit number, type, status, address, contractor, project cost (formatted USD), issue date.
26. **`RowPopup.tsx`** — Display: permit number, work type, street address, applicant, start/end dates, work description.
27. **`LayerToggle.tsx`** — Leaflet control (top-right). Checkboxes: "Construction Permits", "ROW Permits", "State Closures" (disabled until Phase 5).
28. **`FilterSidebar.tsx`** — Address search input (calls `/api/geocode`, calls `map.flyTo()` on result), radius dropdown (0.25 mi / 0.5 mi / 1 mi / 2 mi / 5 mi), permit type multi-select, work type multi-select, date range (from/to), active-only toggle.

---

## Phase 4 — Saved Locations & Email Alerts

*Depends on Phase 3 and Phase 2.*

29. **`SaveLocationModal.tsx`** — "Save Location" button on map. Modal: name field, current map center, radius selector, email input (creates user if new), permit type filter. Calls `POST /api/users` then `POST /api/alert-rules`.
30. **`SavedLocationsList.tsx`** — Panel listing saved locations with name, radius, and delete button.
31. **Alert matching job** (`src/ingest/alert-matcher.ts`) — Runs after each ingest cycle. Uses PostGIS radius query scoped to `first_seen_at >= NOW() - INTERVAL '1 day'`. Inserts into `alert_matches` with `delivery_status = 'pending'`. Deduplicates via `UNIQUE (alert_rule_id, permit_id)`.
32. **Email delivery service** (`src/email/mailer.ts`) — Nodemailer + SMTP env config. Queries `alert_matches WHERE delivery_status = 'pending'`, groups by user email, sends HTML digest. Updates `delivery_status = 'sent'`. Runs daily via `node-cron`.
33. **Email template** — HTML digest listing new permits per saved location: address, type, contractor/applicant, and a deep-link URL to the map centered on that permit.

---

## Phase 5 — KYTC State Closure Spike

*Can run in parallel with Phases 3–4. Does not block MVP.*

34. **Inspect KYTC catalogs**:
    - Swagger docs: `https://kytc-api-v100-lts-qrntk7e3ra-uc.a.run.app/docs`
    - Vector REST endpoints: `https://maps.kytc.ky.gov`
    - Thematic REST: `https://kygisserver.ky.gov`
    - Road conditions: `https://goky.ky.gov`
    - Target: feed with active closures, incident windows, route IDs, start/end timestamps
35. **KYTC ingestor** (`src/ingest/kytc-closures.ts`) — Same pattern as Phase 1 ingestors. Map to `permits` table with `category_name = 'state_closure'` using a KYTC source system row.
36. **Enable closures layer** — Remove disabled flag from `LayerToggle`. Wire `/api/closures` to return closure-category permits from the `permits` table.

---

## v1 Features (Post-MVP)

- Weekly email digest (separate cron schedule + template variant)
- `impact_score NUMERIC` column on `permits` — computed from permit type, project cost, and proximity density
- Category filtering exposed in `FilterSidebar`
- Louisville + state road-impact source wiring complete

## v2 Features

- Oldham County: manual CSV/GeoJSON import first; wire live API if found at `ocpdsgis.maps.arcgis.com`
- Trend scoring per neighborhood (rolling 90-day permit count and cost)
- Contractor intelligence: aggregate permits by contractor, rank by activity
- Commute-oriented closure summaries

---

## Key Files

| Path | Purpose |
|------|---------|
| `docker-compose.yml` | PostGIS container |
| `.env.example` | All required env var keys |
| `packages/types/src/index.ts` | Shared TypeScript interfaces (permit, alert rule, watch location) |
| `apps/api/src/db/migrations/001_initial_schema.sql` | Full schema from PRD §10 |
| `apps/api/src/db/seed.ts` | Source system seed rows |
| `apps/api/src/ingest/arcgis-client.ts` | Paginating ArcGIS FeatureServer fetch |
| `apps/api/src/ingest/lv-construction.ts` | Louisville active construction permit ingestor |
| `apps/api/src/ingest/lv-row.ts` | Louisville ROW permit ingestor |
| `apps/api/src/ingest/scheduler.ts` | node-cron scheduler |
| `apps/api/src/ingest/alert-matcher.ts` | Alert matching job (post-ingest) |
| `apps/api/src/routes/permits.ts` | Permits API route |
| `apps/api/src/routes/geocode.ts` | Nominatim geocoding proxy |
| `apps/api/src/routes/watch-locations.ts` | Watch locations CRUD |
| `apps/api/src/routes/alert-rules.ts` | Alert rules CRUD |
| `apps/api/src/email/mailer.ts` | Nodemailer email delivery |
| `apps/web/src/pages/MapPage.tsx` | Main map page |
| `apps/web/src/hooks/usePermits.ts` | Permit data fetch hook |
| `apps/web/src/components/LayerToggle.tsx` | Map layer visibility control |
| `apps/web/src/components/FilterSidebar.tsx` | Address search + filters panel |
| `apps/web/src/components/ConstructionPopup.tsx` | Construction permit popup |
| `apps/web/src/components/RowPopup.tsx` | ROW permit popup |
| `apps/web/src/components/SaveLocationModal.tsx` | Save location + alert rule modal |
| `apps/web/src/components/SavedLocationsList.tsx` | Saved locations panel |

---

## Verification Checklist

- [ ] `docker compose up -d` → `psql` confirms PostGIS extension + 8 tables + all indexes present
- [ ] `SELECT ST_AsText(geom) FROM permits LIMIT 5` returns geometry after first ingest run
- [ ] `GET /api/permits?lat=38.2527&lng=-85.7585&radiusMeters=1609` returns valid GeoJSON FeatureCollection
- [ ] Map page loads with OSM tiles; blue and orange markers visible
- [ ] Clicking marker opens popup with correct fields
- [ ] Address search flies map to correct location and re-fetches permits
- [ ] Saving a location creates `watch_locations` + `alert_rules` rows
- [ ] Alert matcher inserts `alert_matches` rows after ingest
- [ ] Email delivery sends digest with permit list; `delivery_status` updated to `'sent'`

---

## Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Frontend framework | React + Vite | Map is fully client-side; no SSR needed |
| Backend framework | Fastify | Better TypeScript support, faster than Express |
| Map library | Leaflet / react-leaflet | Lightweight, OSM-compatible, free tiles |
| Database | PostgreSQL + PostGIS | Required for `ST_DWithin` radius queries and spatial indexing |
| Geocoding | Nominatim | Free, no API key; must include `User-Agent` header |
| Auth in MVP | None | Users identified by email only; add auth in v1 |
| Oldham County | Phase 2 only | No verified live API; treat as manual import first |
| KYTC closures | Phase 5 spike | Does not block MVP; requires catalog inspection first |
| Impact scoring | Deferred to v1 | Out of MVP scope |
