export const SESSION_COOKIE = 'sid';

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) {
      continue;
    }
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name && !(name in cookies)) {
      cookies[name] = value;
    }
  }
  return cookies;
}

export function sessionCookie(token, { expires, secure }) {
  const parts = [`${SESSION_COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Expires=${expires.toUTCString()}`];
  if (secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export const clearedSessionCookie = (secure) =>
  sessionCookie('', { expires: new Date(0), secure });
