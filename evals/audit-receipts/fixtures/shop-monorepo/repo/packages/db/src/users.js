const toUser = (row) =>
  row && {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
  };

export const userRepo = (db) => {
  const byId = db.prepare("SELECT * FROM users WHERE id = ?");
  const byEmail = db.prepare("SELECT * FROM users WHERE email = ?");

  return {
    find: (id) => toUser(byId.get(id)),

    findByEmail: (email) => toUser(byEmail.get(email)),

    // Only for signing in: the one place the hash leaves the repository.
    credentialsFor: (email) => {
      const row = byEmail.get(email);
      return row ? { user: toUser(row), passwordHash: row.password_hash } : null;
    },

    create: ({ email, name, passwordHash, role = "customer" }, now) => {
      const result = db
        .prepare("INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(email, name, passwordHash, role, now);
      return toUser(byId.get(result.lastInsertRowid));
    },

    setRole: (id, role) => {
      db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
      return toUser(byId.get(id));
    },
  };
};
