import { HttpError } from './errors.js';

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, 'body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Turns app.handle({ method, url, headers, body }) into a node:http request listener.
export function toNodeHandler(app, { maxBodyBytes, log }) {
  return async (req, res) => {
    let response;
    try {
      const body = req.method === 'GET' || req.method === 'HEAD' ? '' : await readBody(req, maxBodyBytes);
      response = await app.handle({ method: req.method, url: req.url, headers: req.headers, body });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) log.error('request.failed', { error: error.message });
      response = {
        status,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: error.code ?? 'internal_error' }),
      };
    }
    res.writeHead(response.status, response.headers);
    res.end(response.body);
  };
}
