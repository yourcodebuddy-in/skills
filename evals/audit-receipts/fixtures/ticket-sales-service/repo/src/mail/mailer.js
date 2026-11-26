import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Delivers one message. Three transports: `log` for development, `file` for staging (one JSON file
// per message), and `http` for the mail provider's send API.
export function createMailer(config, log) {
  const { transport, from } = config.mail;

  if (transport === 'log') {
    return {
      async send(message) {
        log.info('mail.logged', { kind: message.kind, subject: message.subject });
      },
    };
  }

  if (transport === 'file') {
    mkdirSync(config.mail.dir, { recursive: true });
    let counter = 0;
    return {
      async send(message) {
        counter += 1;
        const name = `${Date.now()}-${counter}-${message.kind}.json`;
        writeFileSync(join(config.mail.dir, name), JSON.stringify({ from, ...message }, null, 2));
      },
    };
  }

  if (transport === 'http') {
    return {
      async send(message) {
        const response = await fetch(config.mail.apiUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${config.mail.apiKey}` },
          body: JSON.stringify({
            from,
            to: message.to,
            subject: message.subject,
            text: message.text,
            html: message.html,
          }),
          signal: AbortSignal.timeout(config.mail.timeoutMs),
        });
        if (!response.ok) throw new Error(`mail provider answered ${response.status}`);
      },
    };
  }

  throw new Error(`Unknown MAIL_TRANSPORT "${transport}"`);
}
