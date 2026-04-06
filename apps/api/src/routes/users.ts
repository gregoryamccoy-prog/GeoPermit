import type { FastifyInstance } from 'fastify';
import { pool } from '../db/client.js';

interface CreateUserBody {
  email: string;
}

export default async function usersRoute(app: FastifyInstance): Promise<void> {
  app.post<{ Body: CreateUserBody }>('/users', async (request, reply) => {
    const { email } = request.body;
    if (!email || !email.includes('@')) {
      return reply.status(400).send({ error: 'Valid email is required' });
    }

    const { rows: [row] } = await pool.query(
      `INSERT INTO users (email)
       VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id, email, created_at`,
      [email.toLowerCase().trim()],
    );

    return reply.status(201).send(row);
  });
}
