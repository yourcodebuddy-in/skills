import { ConflictError, parseEmail, parsePassword, requireString } from "../../../../packages/core/src/index.js";
import { SESSION_COOKIE, checkCredentials, endSession, hashPassword, startSession } from "../auth.js";
import { HttpError } from "../http.js";
import { publicUser } from "../serialize.js";

export const accountRoutes = (router, { store, config }) => {
  router.post("/api/account/register", async ({ body, now }) => {
    const email = parseEmail(body.email);
    const password = parsePassword(body.password);
    const name = requireString(body.name, "name", { max: 100 });
    const passwordHash = await hashPassword(password);
    if (store.users.findByEmail(email)) {
      throw new ConflictError("An account with that email already exists", "email_taken");
    }
    const user = store.users.create({ email, name, passwordHash }, now.toISOString());
    return {
      status: 201,
      body: { user: publicUser(user) },
      headers: { "Set-Cookie": startSession(store, config, user.id, now) },
    };
  });

  router.post("/api/account/login", async ({ body, now }) => {
    const email = parseEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    const user = await checkCredentials(store, email, password);
    if (!user) {
      throw new HttpError(401, "invalid_credentials", "That email and password don't match an account");
    }
    return {
      body: { user: publicUser(user) },
      headers: { "Set-Cookie": startSession(store, config, user.id, now) },
    };
  });

  router.post("/api/account/logout", ({ cookies }) => ({
    status: 204,
    headers: { "Set-Cookie": endSession(store, config, cookies[SESSION_COOKIE]) },
  }));

  router.get("/api/account/me", ({ user }) => ({ body: { user: publicUser(user) } }), { auth: "user" });
};
