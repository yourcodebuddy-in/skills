export class HttpError extends Error {
  constructor(status, code, details = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (code = 'not_found', details) => new HttpError(404, code, details);
export const conflict = (code, details) => new HttpError(409, code, details);
export const invalid = (field, reason) => new HttpError(422, 'invalid_field', { field, reason });
