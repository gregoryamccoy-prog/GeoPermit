import cron from 'node-cron';
import { ingestLvConstruction } from './lv-construction.js';
import { ingestLvRow } from './lv-row.js';
import { runAlertMatcher } from './alert-matcher.js';

async function runIngestCycle(): Promise<void> {
  const started = new Date().toISOString();
  console.log(`[ingest] cycle started at ${started}`);

  try {
    const cCount = await ingestLvConstruction();
    console.log(`[ingest] lv_construction: ${cCount} records upserted`);
  } catch (err) {
    console.error('[ingest] lv_construction failed:', err);
  }

  try {
    const rCount = await ingestLvRow();
    console.log(`[ingest] lv_row: ${rCount} records upserted`);
  } catch (err) {
    console.error('[ingest] lv_row failed:', err);
  }

  try {
    const matched = await runAlertMatcher();
    console.log(`[ingest] alert_matcher: ${matched} new matches`);
  } catch (err) {
    console.error('[ingest] alert_matcher failed:', err);
  }

  console.log(`[ingest] cycle complete (${new Date().toISOString()})`);
}

// Run once daily at 02:00
export function startScheduler(): void {
  cron.schedule('0 2 * * *', () => {
    runIngestCycle().catch((err) =>
      console.error('[scheduler] unexpected error:', err),
    );
  });
  console.log('[scheduler] started — running daily at 02:00');
}

export { runIngestCycle };
