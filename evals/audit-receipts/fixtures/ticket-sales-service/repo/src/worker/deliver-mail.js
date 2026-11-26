import { markSent, pendingMail, recordMailError } from '../mail/outbox.js';

// Sends a batch from the outbox. Returns how many were attempted and how many the transport accepted.
export async function deliverMail(ctx) {
  const { db, mailer, config, clock, log } = ctx;
  const batch = pendingMail(db, config.worker.batchSize);
  let sent = 0;
  for (const message of batch) {
    try {
      await mailer.send({
        kind: message.kind,
        to: message.recipient,
        subject: message.subject,
        text: message.text_body,
        html: message.html_body,
      });
      sent += 1;
    } catch (error) {
      log.warn('mail.send_failed', { id: message.id, kind: message.kind, error: error.message });
      recordMailError(db, message.id, error.message);
    }
    markSent(db, message.id, clock.now());
  }
  return { attempted: batch.length, sent };
}
