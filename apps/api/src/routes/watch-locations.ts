import type { FastifyInstance } from 'fastify';
import { pool } from '../db/client.js';

interface CreateWatchLocationBody {
  name: string;
  address?: string;
  lat: number;
  lng: number;
}

export default async function watchLocationsRoute(app: FastifyInstance): Promise<void> {
  app.get('/watch-locations', async (_request, reply) => {
    const { rows } = await pool.query(`
      SELECT id, name, address,
             ST_Y(geom::geometry) AS latitude,
             ST_X(geom::geometry) AS longitude,
             created_at
      FROM watch_locations
      ORDER BY created_at DESC
    `);
    return reply.send(rows);
  });

  app.post<{ Body: CreateWatchLocationBody }>('/watch-locations', async (request, reply) => {
    const { name, address, lat, lng } = request.body;

    if (!name || !isFinite(lat) || !isFinite(lng)) {
      return reply.status(400).send({ error: 'name, lat, and lng are required' });
    }

    const { rows: [row] } = await pool.query(
      `INSERT INTO watch_locations (name, address, geom)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography)
       RETURNING id, name, address,
                 ST_Y(geom::geometry) AS latitude,
                 ST_X(geom::geometry) AS longitude,
                 created_at`,
      [name, address ?? null, lat, lng],
    );

    return reply.status(201).send(row);
  });

  app.delete<{ Params: { id: string } }>('/watch-locations/:id', async (request, reply) => {
    const { rowCount } = await pool.query(
      'DELETE FROM watch_locations WHERE id = $1',
      [request.params.id],
    );
    if (!rowCount) return reply.status(404).send({ error: 'Not found' });
    return reply.status(204).send();
  });
}
