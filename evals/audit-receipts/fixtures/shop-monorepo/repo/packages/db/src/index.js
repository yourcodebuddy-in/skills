import { cartRepo } from "./carts.js";
import { couponRepo } from "./coupons.js";
import { transaction } from "./database.js";
import { orderRepo } from "./orders.js";
import { outboxRepo } from "./outbox.js";
import { paymentRepo, refundRepo } from "./payments.js";
import { productRepo } from "./products.js";
import { sessionRepo } from "./sessions.js";
import { userRepo } from "./users.js";

export { migrate, openDatabase } from "./database.js";

export const createStore = (db) => ({
  db,
  transaction: (work) => transaction(db, work),
  users: userRepo(db),
  sessions: sessionRepo(db),
  products: productRepo(db),
  carts: cartRepo(db),
  orders: orderRepo(db),
  payments: paymentRepo(db),
  refunds: refundRepo(db),
  coupons: couponRepo(db),
  outbox: outboxRepo(db),
});
