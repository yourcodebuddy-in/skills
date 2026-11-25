import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { addHours } from "../../../packages/core/src/index.js";
import { HttpError, serializeCookie } from "./http.js";

const scrypt = promisify(scryptCallback);

export const SESSION_COOKIE = "sid";
const KEY_LENGTH = 64;
const SCHEME = "scrypt";

export const hashPassword = async (password) => {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `${SCHEME}$${salt.toString("base64")}$${key.toString("base64")}`;
};

export const verifyPassword = async (password, stored) => {
  const [scheme, salt, expected] = stored.split("$");
  if (scheme !== SCHEME || !salt || !expected) {
    return false;
  }
  const key = await scrypt(password, Buffer.from(salt, "base64"), KEY_LENGTH);
  const expectedKey = Buffer.from(expected, "base64");
  return key.length === expectedKey.length && timingSafeEqual(key, expectedKey);
};

// Spent on unknown emails so a failed sign-in takes as long whether or not the account exists.
const UNKNOWN_USER_HASH = await hashPassword(randomBytes(16).toString("hex"));

export const checkCredentials = async (store, email, password) => {
  const found = store.users.credentialsFor(email);
  const ok = await verifyPassword(password, found?.passwordHash ?? UNKNOWN_USER_HASH);
  return ok && found ? found.user : null;
};

export const startSession = (store, config, userId, now) => {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = addHours(now, config.sessionTtlHours);
  store.sessions.create({ id: token, userId, createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() });
  return serializeCookie(SESSION_COOKIE, token, {
    maxAgeSeconds: config.sessionTtlHours * 3600,
    secure: config.secureCookies,
  });
};

export const endSession = (store, config, token) => {
  if (token) {
    store.sessions.delete(token);
  }
  return serializeCookie(SESSION_COOKIE, "", { maxAgeSeconds: 0, secure: config.secureCookies });
};

export const currentUser = (store, cookies, now) => {
  const token = cookies[SESSION_COOKIE];
  if (!token) {
    return null;
  }
  return store.sessions.findActive(token, now.toISOString())?.user ?? null;
};

export const authorize = (user, level) => {
  if (!level) {
    return;
  }
  if (!user) {
    throw new HttpError(401, "unauthenticated", "Sign in to continue");
  }
  if (level === "admin" && user.role !== "admin") {
    throw new HttpError(403, "forbidden", "Only staff can do that");
  }
};
