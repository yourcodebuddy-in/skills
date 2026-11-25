export const sessionRepo = (db) => {
  const insert = db.prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)");
  const active = db.prepare(`
    SELECT users.id, users.email, users.name, users.role, sessions.expires_at
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ? AND sessions.expires_at > ?
  `);

  return {
    create: ({ id, userId, createdAt, expiresAt }) => {
      insert.run(id, userId, createdAt, expiresAt);
    },

    findActive: (id, now) => {
      const row = active.get(id, now);
      return row ? { user: { id: row.id, email: row.email, name: row.name, role: row.role }, expiresAt: row.expires_at } : null;
    },

    delete: (id) => {
      db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
    },

    deleteExpired: (now) => db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now).changes,
  };
};
