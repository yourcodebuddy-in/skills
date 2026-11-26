import { claimNextJob, completeJob, failJob } from '../jobs.js';
import { refundEvent } from './refund-event.js';

const handlers = {
  refund_event: refundEvent,
};

// Runs due jobs one at a time until none are left or the batch size is reached.
export async function runDueJobs(ctx, { limit = ctx.config.worker.batchSize } = {}) {
  const { db, clock, log } = ctx;
  const results = { done: 0, retried: 0, failed: 0 };
  for (let i = 0; i < limit; i += 1) {
    const job = claimNextJob(db, clock.now());
    if (!job) break;
    const handler = handlers[job.kind];
    try {
      if (!handler) throw new Error(`no handler for job kind "${job.kind}"`);
      await handler(ctx, job.payload);
      completeJob(db, job.id, clock.now());
      results.done += 1;
    } catch (error) {
      const outcome = failJob(db, job, error, clock.now());
      log.warn('job.failed', { id: job.id, kind: job.kind, attempt: job.attempts, outcome, error: error.message });
      results[outcome === 'retry' ? 'retried' : 'failed'] += 1;
    }
  }
  return results;
}
