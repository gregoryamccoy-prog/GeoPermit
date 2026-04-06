import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import permitsRoute from './routes/permits.js';
import geocodeRoute from './routes/geocode.js';
import watchLocationsRoute from './routes/watch-locations.js';
import alertRulesRoute from './routes/alert-rules.js';
import usersRoute from './routes/users.js';
import { startScheduler } from './ingest/scheduler.js';
import { startMailerSchedule } from './email/mailer.js';

const app = Fastify({ logger: { level: 'info' } });

await app.register(cors, { origin: true });

await app.register(permitsRoute, { prefix: '/api' });
await app.register(geocodeRoute, { prefix: '/api' });
await app.register(watchLocationsRoute, { prefix: '/api' });
await app.register(alertRulesRoute, { prefix: '/api' });
await app.register(usersRoute, { prefix: '/api' });

app.get('/health', async () => ({ status: 'ok' }));

const port = parseInt(process.env['PORT'] ?? '3001', 10);
await app.listen({ port, host: '0.0.0.0' });
console.log(`API running on http://localhost:${port}`);

startScheduler();
startMailerSchedule();
