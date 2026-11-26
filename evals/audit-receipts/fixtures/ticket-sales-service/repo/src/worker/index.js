import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config.js';
import { createContext } from '../context.js';
import { expireHolds } from '../services/holds.js';
import { deliverMail } from './deliver-mail.js';
import { runDueJobs } from './run-jobs.js';

// One pass: release expired holds, run due jobs, send queued mail.
export async function tick(ctx) {
  const expired = expireHolds(ctx.db, ctx.clock.now());
  const jobs = await runDueJobs(ctx);
  const mail = await deliverMail(ctx);
  return { expired, jobs, mail };
}

export function startWorker(ctx) {
  let timer = null;
  let stopped = false;
  let running = Promise.resolve();
  const interval = ctx.config.worker.intervalSeconds * 1000;

  const pass = async () => {
    try {
      const result = await tick(ctx);
      if (result.expired || result.jobs.done || result.jobs.retried || result.jobs.failed || result.mail.attempted) {
        ctx.log.info('worker.tick', result);
      }
    } catch (error) {
      ctx.log.error('worker.tick_failed', { error: error.message });
    }
  };

  const loop = () => {
    running = pass().then(() => {
      if (!stopped) timer = setTimeout(loop, interval);
    });
  };

  loop();
  return {
    // Resolves once the pass in progress, if any, has finished.
    async stop() {
      stopped = true;
      clearTimeout(timer);
      await running;
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ctx = createContext(loadConfig());
  const worker = startWorker(ctx);
  ctx.log.info('worker.started', { intervalSeconds: ctx.config.worker.intervalSeconds });
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, async () => {
      await worker.stop();
      ctx.db.close();
      process.exit(0);
    });
  }
}
