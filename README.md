# GeoPermit

A TypeScript web application that monitors Louisville construction permits and right-of-way (ROW) work on an interactive map. Users can search by address, filter by permit type and radius, save locations, and receive email alerts when new permit activity appears nearby.

---

## New Developer Setup

Everything needed to run the project from a fresh clone:

```bash
git clone https://github.com/gregoryamccoy-prog/GeoPermit.git
cd GeoPermit

cp .env.example .env          # fill in SMTP_* variables if you want email alerts

npm install                   # installs all workspace dependencies
docker compose up -d          # starts PostgreSQL + PostGIS (pulls image ~400 MB on first run)
npm run db:migrate            # creates all 8 tables and indexes
npm run db:seed               # inserts Louisville data source records
npm run ingest:once           # fetches ~24k live permits from Louisville ArcGIS (~60-90s)
npm run dev:api               # starts API on http://localhost:3001
npm run dev:web               # starts frontend on http://localhost:5173
```

Open **http://localhost:5173** — the map loads with live permit data.

> **Prerequisites:** Node.js ≥ 22, npm ≥ 10, Docker Engine. No cloud accounts or API keys required.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Prerequisites](#prerequisites)
3. [Project Structure](#project-structure)
4. [Environment Variables](#environment-variables)
5. [Quickstart](#quickstart)
6. [Starting and Stopping Processes](#starting-and-stopping-processes)
7. [Using the Site](#using-the-site)
8. [Data Ingestion](#data-ingestion)
9. [Email Alerts](#email-alerts)
10. [Database Reference](#database-reference)
11. [API Reference](#api-reference)
12. [Adding Migrations](#adding-migrations)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 6, TypeScript, Leaflet / react-leaflet |
| Backend | Node.js 22, Fastify 5, TypeScript, tsx (dev) |
| Database | PostgreSQL 16 + PostGIS 3.4 (Docker) |
| Data sources | Louisville Metro ArcGIS FeatureServer (public) |
| Email | Nodemailer (SMTP) |
| Scheduling | node-cron |
| Package management | npm workspaces (monorepo) |

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 22 | `node --version` |
| npm | ≥ 10 | bundled with Node 22 |
| Docker Engine | ≥ 24 | installed by setup; `docker --version` |

No cloud accounts, API keys, or paid services are required for the map and data pipeline. Email alerts require an SMTP server (see [Email Alerts](#email-alerts)).

---

## Project Structure

```
BuildingPermits/
├── apps/
│   ├── api/                  Backend — Fastify REST API + ingest jobs
│   │   └── src/
│   │       ├── db/
│   │       │   ├── client.ts              pg Pool singleton
│   │       │   ├── migrate.ts             Migration runner
│   │       │   ├── seed.ts                Source system seed data
│   │       │   └── migrations/
│   │       │       ├── 001_initial_schema.sql
│   │       │       └── 002_raw_ingest_unique.sql
│   │       ├── email/
│   │       │   └── mailer.ts              Nodemailer digest delivery
│   │       ├── ingest/
│   │       │   ├── arcgis-client.ts       Paginating ArcGIS fetch utility
│   │       │   ├── lv-construction.ts     Louisville construction permit ingestor
│   │       │   ├── lv-row.ts              Louisville ROW permit ingestor
│   │       │   ├── alert-matcher.ts       Post-ingest alert matching job
│   │       │   ├── scheduler.ts           node-cron daily scheduler
│   │       │   └── run-once.ts            Manual one-shot ingest entry point
│   │       ├── routes/
│   │       │   ├── permits.ts             GET /api/permits, GET /api/permits/:id
│   │       │   ├── geocode.ts             GET /api/geocode
│   │       │   ├── watch-locations.ts     GET/POST/DELETE /api/watch-locations
│   │       │   ├── alert-rules.ts         GET/POST/DELETE /api/alert-rules
│   │       │   └── users.ts               POST /api/users
│   │       └── index.ts                   Fastify app entry point
│   └── web/                  Frontend — React + Vite + Leaflet
│       └── src/
│           ├── components/
│           │   ├── ConstructionPopup.tsx  Permit detail popup
│           │   ├── RowPopup.tsx           ROW permit popup
│           │   ├── FilterSidebar.tsx      Address search + filters
│           │   ├── LayerToggle.tsx        Layer visibility checkboxes
│           │   ├── SaveLocationModal.tsx  Save location + alert subscription
│           │   └── SavedLocationsList.tsx Saved locations panel
│           ├── hooks/
│           │   └── usePermits.ts          Map-reactive data fetch hook
│           ├── pages/
│           │   └── MapPage.tsx            Main application page
│           ├── App.tsx
│           └── main.tsx
├── packages/
│   └── types/                Shared TypeScript interfaces (Permit, AlertRule, etc.)
├── docker-compose.yml        PostGIS container definition
├── .env                      Local environment variables (not committed)
├── .env.example              Template for .env
├── package.json              Root workspace manifest
├── tsconfig.base.json        Shared TypeScript base config
├── PLAN.md                   Detailed implementation plan
└── PRD.txt                   Original product requirements
```

---

## Environment Variables

Copy `.env.example` to `.env` and edit as needed. The file is already created with working defaults for local development.

```bash
cp .env.example .env
```

| Variable | Default | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/local_change_monitor` | Yes | PostgreSQL connection string |
| `PORT` | `3001` | No | API server port |
| `SMTP_HOST` | *(empty)* | No | SMTP server hostname for email alerts |
| `SMTP_PORT` | `587` | No | SMTP port |
| `SMTP_USER` | *(empty)* | No | SMTP username |
| `SMTP_PASS` | *(empty)* | No | SMTP password |
| `SMTP_FROM` | `alerts@local-change-monitor.dev` | No | From address for alert emails |

If `SMTP_HOST` is not set, the email delivery job is skipped silently and all other functionality continues to work.

---

## Quickstart

> **First time only.** If you have already completed these steps, see [Starting and Stopping Processes](#starting-and-stopping-processes).

### 1 — Install dependencies

```bash
cd /home/gregory/CODE/BuildingPermits
npm install
```

### 2 — Start the database

The PostGIS container must be running before the API or migrations can connect.

```bash
sudo docker start local-change-monitor-db
```

Verify it is healthy:

```bash
sudo docker exec local-change-monitor-db psql -U postgres -d local_change_monitor -c "SELECT PostGIS_Version();"
```

Expected output: `3.4 USE_GEOS=1 USE_PROJ=1 USE_STATS=1`

### 3 — Run database migrations

```bash
npm run db:migrate
```

This applies all SQL files in `apps/api/src/db/migrations/` in order. Safe to re-run — all statements use `IF NOT EXISTS`.

### 4 — Seed source systems

```bash
npm run db:seed
```

Inserts the Louisville ArcGIS source system records. Safe to re-run (uses `ON CONFLICT DO NOTHING`).

### 5 — Run the initial data ingest

Downloads all current permits from Louisville's public ArcGIS endpoints and stores them in the database. Takes approximately 60–90 seconds.

```bash
npm run ingest:once
```

Expected output:
```
[ingest] cycle started at ...
  [lv_construction] new: 23898, refreshed: 0
  [lv_row] new: 238, refreshed: 0
[ingest] cycle complete (...)
```

Subsequent runs will show `new: 0, refreshed: N` because raw payloads are only stored the first time a permit is seen.

### 6 — Start the API and frontend

Open two terminals (or use the npm scripts from the project root):

**Terminal 1 — API:**
```bash
npm run dev:api
```

**Terminal 2 — Frontend:**
```bash
npm run dev:web
```

### 7 — Open the app

```
http://localhost:5173
```

---

## Starting and Stopping Processes

### Database

| Action | Command |
|---|---|
| Start | `sudo docker start local-change-monitor-db` |
| Stop | `sudo docker stop local-change-monitor-db` |
| Status | `sudo docker ps` |
| View logs | `sudo docker logs local-change-monitor-db` |

The container is configured with `--restart unless-stopped`, so it will start automatically on system boot. Use `sudo docker stop` if you want to keep it down.

> **Note:** Your user account was added to the `docker` group during setup. After your next login, `sudo` will no longer be required for `docker` commands. If you have already logged out and back in since setup, omit `sudo` in the commands above.

### API Server

| Action | Command | Notes |
|---|---|---|
| Start (dev, with hot reload) | `npm run dev:api` | Runs from project root |
| Start (production) | `npm run start --workspace=apps/api` | Requires `npm run build --workspace=apps/api` first |
| Stop | `Ctrl+C` in the terminal running it | |
| Check it is running | `curl http://localhost:3001/health` | Returns `{"status":"ok"}` |

The API starts two background jobs automatically:
- **Ingest scheduler** — runs the full data pull from Louisville daily at 02:00
- **Email mailer** — sends pending alert digests daily at 07:00

### Frontend Dev Server

| Action | Command | Notes |
|---|---|---|
| Start | `npm run dev:web` | Runs from project root |
| Stop | `Ctrl+C` in the terminal running it | |

### Starting Everything at Once

From the project root, open two terminal windows and run each in one:

```bash
# Window 1
npm run dev:api

# Window 2
npm run dev:web
```

There is no single combined dev-start command — running both in one terminal would mix their log output.

### Full Shutdown

```bash
# Stop frontend
Ctrl+C  (in the terminal running npm run dev:web)

# Stop API
Ctrl+C  (in the terminal running npm run dev:api)

# Stop database (optional — safe to leave running)
sudo docker stop local-change-monitor-db
```

---

## Using the Site

Open `http://localhost:5173` in a browser. The API must be running (`npm run dev:api`) for data to load.

### Map

The map opens centered on Louisville. Blue dots are **construction permits**. Orange dots are **ROW permits** (right-of-way work affecting roadways). The map refreshes markers automatically whenever you pan or zoom.

### Address Search

Type any address in the search box at the top of the sidebar and press Enter or click the result. The map flies to that location and reloads nearby permits.

Example addresses to try:
- `4th St Live, Louisville KY`
- `Norton Hospital, Louisville KY`
- `Bardstown Road, Louisville KY`

### Radius Filter

Use the **Radius** dropdown to control how far from the map center permits are shown. Options: ¼ mile, ½ mile, 1 mile, 2 miles, 5 miles. Default is 1 mile.

### Filters

The sidebar provides additional filters:
- **Permit Type** — e.g. `Residential New`, `Commercial Alteration`, `Demolition`
- **Work Type** — ROW work types, e.g. `Lane Closure`, `Full Road Closure`
- **Date Range** — filter by permit issue or start date
- **Active Only** — toggle to include expired/inactive permits

### Layer Toggles

In the **Layers** panel, check or uncheck:
- **Construction Permits** (blue) — Louisville active building permits
- **ROW Permits** (orange) — right-of-way construction affecting roads
- **State Closures** — placeholder for future KYTC integration (disabled)

### Permit Popups

Click any marker to open a popup with full permit details:

**Construction permits show:** permit number, type, status, address, contractor, project cost, issue date, neighborhood, and district.

**ROW permits show:** permit number, work type, address, applicant name, start/end dates, and full work description.

### Saving a Location and Setting Up Alerts

1. Pan the map to the area you want to monitor.
2. Click **+ Save This Location** in the sidebar.
3. Enter a name for the location (e.g. "My House").
4. Select an alert radius.
5. Enter your email address.
6. Click **Save & Subscribe**.

After the next daily ingest runs (02:00), any new permits within your radius will be matched to your alert rule. The email delivery job runs at 07:00 and sends a digest listing all new activity with addresses, types, and map links.

### Viewing Saved Locations

Click **Show Saved Locations** in the sidebar to expand the list. Click any entry to fly the map to that location. Click **✕** to delete it.

---

## Data Ingestion

### Automatic (daily at 02:00)

When the API is running, the scheduler fires automatically at 02:00 every day. No action is needed.

### Manual Trigger

Run from the project root at any time:

```bash
npm run ingest:once
```

### How Ingestion Works

1. Fetches all records from two Louisville ArcGIS FeatureServer endpoints, paging in batches of 1,000.
2. For each record:
   - **If the permit is new:** inserts into `permits` and archives the raw JSON payload in `raw_ingest_events`.
   - **If the permit already exists:** updates `last_seen_at`, `is_active`, `permit_status`, and `raw_payload` in `permits`. Does **not** write to `raw_ingest_events` again.
3. Marks any permit not seen in the last 24 hours as `is_active = false`.
4. Runs the alert matcher to find new permits inside saved alert rule radii.

### Data Sources

| Source | Endpoint |
|---|---|
| Louisville Active Construction Permits | `services1.arcgis.com/.../active_construction_permits/FeatureServer/0` |
| Louisville ROW Construction Permits | `services1.arcgis.com/.../Louisville_KY_ROW_Construction_Permits_new/FeatureServer/0` |

Both are public endpoints maintained by Louisville Metro / LOJIC. No API key is required.

---

## Email Alerts

Email delivery is optional. If `SMTP_HOST` is not configured, the mailer logs a warning and skips — everything else continues working.

### Configuration

Edit `.env` and set the four SMTP variables:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=alerts@local-change-monitor.dev
```

For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833) rather than your account password.

### Schedule

The mailer cron runs daily at **07:00**. It:
1. Queries `alert_matches` for rows with `delivery_status = 'pending'`
2. Groups them by user email
3. Sends one digest email per user listing all new nearby permits
4. Updates matched rows to `delivery_status = 'sent'`

### Manual Trigger

There is no dedicated CLI command for the mailer yet. To test delivery, you can call the function directly from a Node REPL:

```bash
cd apps/api
node --loader tsx/esm -e "
import { sendPendingAlerts } from './src/email/mailer.js';
sendPendingAlerts().then(n => console.log('sent:', n));
"
```

---

## Database Reference

### Connection

```
Host:     localhost
Port:     5432
User:     postgres
Password: postgres
Database: local_change_monitor
```

Connect via psql:
```bash
sudo docker exec -it local-change-monitor-db psql -U postgres -d local_change_monitor
```

### Tables

| Table | Description |
|---|---|
| `source_systems` | Registry of data sources (Louisville construction, Louisville ROW, future KYTC) |
| `raw_ingest_events` | Original JSON payload from each source, stored once per permit at first ingest |
| `permits` | Normalised permit records with PostGIS geometry; updated on every ingest run |
| `watch_locations` | Map locations saved by users |
| `users` | User accounts (email only, no passwords) |
| `alert_rules` | Per-user radius + filter subscriptions |
| `alert_matches` | Junction table recording which permits matched which alert rules |

### Useful Queries

**How many permits are loaded?**
```sql
SELECT category_name, COUNT(*) FROM permits GROUP BY category_name;
```

**Active permits only:**
```sql
SELECT COUNT(*) FROM permits WHERE is_active = TRUE;
```

**Permits within 1 mile of a point:**
```sql
SELECT address, permit_type, issue_date
FROM permits
WHERE ST_DWithin(
  geom,
  ST_SetSRID(ST_MakePoint(-85.7585, 38.2527), 4326)::geography,
  1609
)
ORDER BY issue_date DESC NULLS LAST
LIMIT 20;
```

**Check raw event storage (should match permits count):**
```sql
SELECT 'raw_events' AS tbl, COUNT(*) FROM raw_ingest_events
UNION ALL
SELECT 'permits', COUNT(*) FROM permits;
```

**Pending alert matches:**
```sql
SELECT u.email, COUNT(*) AS pending_count
FROM alert_matches am
JOIN alert_rules ar ON ar.id = am.alert_rule_id
JOIN users u        ON u.id  = ar.user_id
WHERE am.delivery_status = 'pending'
GROUP BY u.email;
```

---

## API Reference

Base URL: `http://localhost:3001`

### `GET /health`
Returns `{"status":"ok"}`. Use to confirm the API is running.

---

### `GET /api/permits`
Returns a GeoJSON FeatureCollection of permits matching the given radius and filters.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `lat` | number | *required* | Latitude of search center |
| `lng` | number | *required* | Longitude of search center |
| `radiusMeters` | integer | `1609` | Search radius in meters (1609 = 1 mile) |
| `activeOnly` | boolean | `true` | If `false`, includes inactive/expired permits |
| `permitType` | string | — | Filter to exact permit type value |
| `workType` | string | — | Filter to exact work type value |
| `categoryName` | string | — | `construction`, `row`, or `state_closure` |
| `fromDate` | ISO date | — | Only permits issued on or after this date |
| `toDate` | ISO date | — | Only permits issued on or before this date |
| `limit` | integer | `500` | Max results (capped at 1000) |

**Example:**
```
GET /api/permits?lat=38.2527&lng=-85.7585&radiusMeters=1609&categoryName=construction
```

---

### `GET /api/permits/:id`
Returns a single permit record including the full raw ArcGIS payload.

---

### `GET /api/geocode?q=<address>`
Geocodes an address string using Nominatim (OpenStreetMap). Returns an array of results with `lat`, `lon`, and `display_name`.

**Example:**
```
GET /api/geocode?q=4th+St+Live+Louisville+KY
```

---

### `GET /api/watch-locations`
Returns all saved watch locations.

### `POST /api/watch-locations`
Creates a new watch location.

```json
{ "name": "My House", "address": "123 Main St", "lat": 38.25, "lng": -85.75 }
```

### `DELETE /api/watch-locations/:id`
Deletes a watch location by id.

---

### `POST /api/users`
Creates a user, or returns the existing user if the email already exists.

```json
{ "email": "you@example.com" }
```

Returns `{ "id": 1, "email": "...", "created_at": "..." }`.

---

### `GET /api/alert-rules?userId=<id>`
Returns all alert rules for a user.

### `POST /api/alert-rules`
Creates an alert rule.

```json
{
  "userId": 1,
  "name": "My House",
  "lat": 38.25,
  "lng": -85.75,
  "radiusMeters": 1609,
  "includePermitTypes": ["Residential New", "Commercial Alteration"],
  "includeWorkTypes": []
}
```

`includePermitTypes` and `includeWorkTypes` are optional. If omitted, all types are matched.

### `DELETE /api/alert-rules/:id`
Deletes an alert rule.

---

### `GET /api/closures`
Stub endpoint — returns an empty GeoJSON FeatureCollection. Will be wired to KYTC state closure data in a future release.

---

## Adding Migrations

Create a new `.sql` file in `apps/api/src/db/migrations/` with the next sequential prefix:

```
003_my_change.sql
```

Then run:

```bash
npm run db:migrate
```

The migration runner applies all `.sql` files in the directory in alphabetical/numeric order. All existing migration files use `IF NOT EXISTS` so they are safe to re-apply.

---

## Roadmap

See [PLAN.md](PLAN.md) for the full phased implementation plan.

**Upcoming (v1):**
- Weekly email digest option
- Basic impact scoring per permit
- Category filtering in the UI

**Upcoming (v2):**
- Oldham County permit data (manual import initially)
- Neighborhood trend scoring (rolling 90-day)
- Contractor activity intelligence
- KYTC state road closure integration
