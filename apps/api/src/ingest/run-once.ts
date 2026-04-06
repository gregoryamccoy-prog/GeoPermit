// Manual one-shot ingest — used for testing and initial load
import { runIngestCycle } from './scheduler.js';
import { pool } from '../db/client.js';

runIngestCycle()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
