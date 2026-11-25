export const MAX_BODY_BYTES = 64 * 1024;

const JSON_TYPE = /^application\/json(\s*;|$)/i;

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const isJsonRequest = (headers) => JSON_TYPE.test(headers["content-type"] ?? "");

export const readBody = async (req, limit = MAX_BODY_BYTES) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      throw new HttpError(413, "body_too_large", `Request body is larger than ${limit} bytes`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

export const parseJsonObject = (text) => {
  if (text.trim() === "") {
    return {};
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json", "Request body isn't valid JSON");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "invalid_json", "Request body must be a JSON object");
  }
  return value;
};

export const parseCookies = (header = "") => {
  const cookies = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) {
      continue;
    }
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name && !Object.hasOwn(cookies, name)) {
      try {
        cookies[name] = decodeURIComponent(value);
      } catch {
        cookies[name] = value;
      }
    }
  }
  return cookies;
};

export const serializeCookie = (name, value, { maxAgeSeconds, secure = false } = {}) => {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Strict"];
  if (maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${Math.floor(maxAgeSeconds)}`);
  }
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
};

const BASE_HEADERS = Object.freeze({
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "X-Frame-Options": "DENY",
});

export const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { ...BASE_HEADERS, ...headers });
  res.end(body);
};

export const sendJson = (res, status, payload, headers = {}) => {
  const body = payload === undefined ? "" : JSON.stringify(payload);
  send(res, status, body, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
};
