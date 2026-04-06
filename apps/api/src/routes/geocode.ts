import type { FastifyInstance } from 'fastify';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'LocalChangeMonitor/1.0 (local-dev)';

interface GeocodeQuery {
  q: string;
}

export default async function geocodeRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: GeocodeQuery }>('/geocode', async (request, reply) => {
    const { q } = request.query;
    if (!q || q.trim().length === 0) {
      return reply.status(400).send({ error: 'q parameter is required' });
    }

    const url = new URL(`${NOMINATIM_BASE}/search`);
    url.searchParams.set('format', 'json');
    url.searchParams.set('q', q);
    url.searchParams.set('limit', '5');

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
      return reply.status(502).send({ error: 'Geocoding service unavailable' });
    }

    const data = await response.json();
    return reply.send(data);
  });
}
