import type { FastifyInstance } from 'fastify';
import { pool } from '../db/client.js';

interface PermitsQuery {
  lat: string;
  lng: string;
  radiusMeters?: string;
  permitType?: string;
  workType?: string;
  categoryName?: string;
  activeOnly?: string;
  fromDate?: string;
  toDate?: string;
  limit?: string;
}

export default async function permitsRoute(app: FastifyInstance): Promise<void> {
  // GET /api/permits — radius search returning GeoJSON FeatureCollection
  app.get<{ Querystring: PermitsQuery }>('/permits', async (request, reply) => {
    const q = request.query;
    const lat = parseFloat(q.lat);
    const lng = parseFloat(q.lng);

    if (!isFinite(lat) || !isFinite(lng)) {
      return reply.status(400).send({ error: 'lat and lng are required' });
    }

    const radiusMeters = parseInt(q.radiusMeters ?? '1609', 10);
    const activeOnly = q.activeOnly !== 'false';
    const limit = Math.min(parseInt(q.limit ?? '500', 10), 1000);

    const params: unknown[] = [lng, lat, radiusMeters, limit];
    const conditions: string[] = [
      'p.geom IS NOT NULL',
      `ST_DWithin(p.geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)`,
    ];

    let paramIdx = 5;

    if (activeOnly) {
      conditions.push('p.is_active = TRUE');
    }

    if (q.permitType) {
      conditions.push(`p.permit_type = $${paramIdx}`);
      params.push(q.permitType);
      paramIdx++;
    }

    if (q.workType) {
      conditions.push(`p.work_type = $${paramIdx}`);
      params.push(q.workType);
      paramIdx++;
    }

    if (q.categoryName) {
      conditions.push(`p.category_name = $${paramIdx}`);
      params.push(q.categoryName);
      paramIdx++;
    }

    if (q.fromDate) {
      conditions.push(`p.issue_date >= $${paramIdx}`);
      params.push(q.fromDate);
      paramIdx++;
    }

    if (q.toDate) {
      conditions.push(`p.issue_date <= $${paramIdx}`);
      params.push(q.toDate);
      paramIdx++;
    }

    const where = conditions.join(' AND ');

    const sql = `
      SELECT
        p.id, p.source_dataset, p.permit_number, p.permit_type, p.permit_status,
        p.category_name, p.work_type, p.contractor, p.applicant_name,
        p.work_description, p.zoning, p.sqft, p.permit_fee, p.project_costs,
        p.address, p.city, p.state, p.zipcode, p.district, p.neighborhood,
        p.start_date, p.end_date, p.issue_date,
        p.first_seen_at, p.last_seen_at, p.is_active,
        ST_Y(p.geom::geometry) AS latitude,
        ST_X(p.geom::geometry) AS longitude
      FROM permits p
      WHERE ${where}
      ORDER BY p.issue_date DESC NULLS LAST
      LIMIT $4
    `;

    const { rows } = await pool.query(sql, params);

    const geojson = {
      type: 'FeatureCollection',
      features: rows.map((row) => ({
        type: 'Feature',
        geometry:
          row.latitude != null && row.longitude != null
            ? { type: 'Point', coordinates: [row.longitude, row.latitude] }
            : null,
        properties: row,
      })),
    };

    return reply.send(geojson);
  });

  // GET /api/permits/:id — single permit detail
  app.get<{ Params: { id: string } }>('/permits/:id', async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT p.*,
              ST_Y(p.geom::geometry) AS latitude,
              ST_X(p.geom::geometry) AS longitude
       FROM permits p WHERE p.id = $1`,
      [request.params.id],
    );
    if (!rows[0]) return reply.status(404).send({ error: 'Not found' });
    return reply.send(rows[0]);
  });

  // GET /api/closures — stub until KYTC spike
  app.get('/closures', async (_request, reply) => {
    return reply.send({ type: 'FeatureCollection', features: [] });
  });
}
