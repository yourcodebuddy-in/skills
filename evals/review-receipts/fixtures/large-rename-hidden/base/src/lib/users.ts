export type User = { id: string; name: string };

const users = new Map<string, User>([["u1", { id: "u1", name: "Ada" }]]);

export function getUser(id: string): User {
  return users.get(id) ?? { id, name: "Unknown" };
}
