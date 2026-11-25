import { HttpError } from './errors.js';

export const json = (status, body, headers = {}) => ({
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  body: JSON.stringify(body),
});

export const html = (status, body) => ({
  status,
  headers: { 'content-type': 'text/html; charset=utf-8' },
  body,
});

export const csv = (body, filename) => ({
  status: 200,
  headers: {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': `attachment; filename="${filename}"`,
  },
  body,
});

export const noContent = (headers = {}) => ({ status: 204, headers, body: '' });

export function send(res, result) {
  res.writeHead(result.status, {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...result.headers,
  });
  res.end(result.body);
}

export function sendError(res, error, log) {
  if (error instanceof HttpError) {
    send(res, json(error.status, { error: error.message }));
    return;
  }
  log.error(error);
  send(res, json(500, { error: 'Something went wrong on our side' }));
}
