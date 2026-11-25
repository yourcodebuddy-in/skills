const REQUEST_TIMEOUT_MS = 10_000;

function logMailer({ from }, log) {
  return {
    async send({ to, subject, text }) {
      log.info(`mail from=${from} to=${to} subject=${JSON.stringify(subject)} bytes=${text.length}`);
      return { id: null };
    },
  };
}

function httpMailer({ url, apiKey, from }, fetchImpl) {
  return {
    async send({ to, subject, text }) {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ from, to, subject, text }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const payload = await response.json().catch(() => ({}));
      return { id: payload.id ?? null };
    },
  };
}

export function createMailer(mail, { fetchImpl = fetch, log = console } = {}) {
  if (mail.transport === 'http') {
    return httpMailer(mail, fetchImpl);
  }
  return logMailer(mail, log);
}
