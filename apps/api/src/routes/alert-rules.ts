import type { FastifyInstance } from 'fastify';
import { pool } from '../db/client.js';

interface CreateAlertRuleBody {
  userId: number;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  includePermitTypes?: string[];
  includeWorkTypes?: string[];
}

interface AlertRulesQuery {
  userId: string;
}

export default async function alertRulesRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: AlertRulesQuery }>('/alert-rules', async (request, reply) => {
    const { userId } = request.query;
    if (!userId) return reply.status(400).send({ error: 'userId is required' });

    const { rows } = await pool.query(
      `SELECT id, user_id, name,
              ST_Y(center_geom::geometry) AS latitude,
              ST_X(center_geom::geometry) AS longitude,
              radius_meters, include_permit_types, include_work_types,
              is_active, created_at
       FROM alert_rules
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    return reply.send(rows);
  });

  app.post<{ Body: CreateAlertRuleBody }>('/alert-rules', async (request, reply) => {
    const { userId, name, lat, lng, radiusMeters, includePermitTypes, includeWorkTypes } =
      request.body;

    if (!userId || !name || !isFinite(lat) || !isFinite(lng) || !radiusMeters) {
      return reply
        .status(400)
        .send({ error: 'userId, name, lat, lng, and radiusMeters are required' });
    }

    const { rows: [row] } = await pool.query(
      `INSERT INTO alert_rules
         (user_id, name, center_geom, radius_meters, include_permit_types, include_work_types)
       VALUES
         ($1, $2, ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography, $5, $6, $7)
       RETURNING id, user_id, name,
                 ST_Y(center_geom::geometry) AS latitude,
                 ST_X(center_geom::geometry) AS longitude,
                 radius_meters, include_permit_types, include_work_types,
                 is_active, created_at`,
      [
        userId,
        name,
        lat,
        lng,
        radiusMeters,
        includePermitTypes ?? null,
        includeWorkTypes ?? null,
      ],
    );

    return reply.status(201).send(row);
  });

  app.delete<{ Params: { id: string } }>('/alert-rules/:id', async (request, reply) => {
    const { rowCount } = await pool.query(
      'DELETE FROM alert_rules WHERE id = $1',
      [request.params.id],
    );
    if (!rowCount) return reply.status(404).send({ error: 'Not found' });
    return reply.status(204).send();
  });
}
