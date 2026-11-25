// Gives an existing account staff access: node apps/api/scripts/make-admin.js someone@example.com
import { createStore, openDatabase } from "../../../packages/db/src/index.js";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: node apps/api/scripts/make-admin.js <email>");
  process.exit(2);
}

const store = createStore(openDatabase(process.env.DATABASE_FILE ?? "data/shop.db"));
const user = store.users.findByEmail(email);
if (!user) {
  console.error(`No account with the email ${email}. Register it on the site first.`);
  process.exit(1);
}
store.users.setRole(user.id, "admin");
console.log(`${email} is now an admin.`);
