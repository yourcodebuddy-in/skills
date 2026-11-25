import {
  ConflictError,
  NotFoundError,
  assertCents,
  canTransition,
  checkRefund,
  dayRange,
  fulfilOrder,
  parseCouponInput,
  parseDay,
  parseId,
  parsePage,
  parseProductInput,
  parseStatusFilter,
  recordRefund,
  refundableCents,
} from "../../../../packages/core/src/index.js";
import { HttpError } from "../http.js";
import { adminOrder, adminProduct } from "../serialize.js";

const ADMIN = { auth: "admin" };
const PAGE_SIZE = 50;
const MAX_REPORT_DAYS = 366;
const SQLITE_CONSTRAINT_UNIQUE = 2067;
const SQLITE_CONSTRAINT_PRIMARYKEY = 1555;

const isDuplicate = (error) =>
  error?.errcode === SQLITE_CONSTRAINT_UNIQUE || error?.errcode === SQLITE_CONSTRAINT_PRIMARYKEY;

const rethrowDuplicate = (error, message, code) => {
  if (isDuplicate(error)) {
    throw new ConflictError(message, code);
  }
  throw error;
};

export const adminRoutes = (router, { store, payments, logger }) => {
  const detail = (order) =>
    adminOrder(order, {
      customer: store.users.find(order.userId),
      refunds: store.refunds.listFor(order.id),
      refundableCents: canTransition(order.status, "refunded") ? refundableCents(store, order) : 0,
    });

  // Orders

  router.get(
    "/api/admin/orders",
    ({ query }) => {
      const status = parseStatusFilter(query.get("status"));
      const page = parsePage(query.get("page"));
      const { items, total } = store.orders.list({ status, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
      return { body: { items, total, page, pageSize: PAGE_SIZE } };
    },
    ADMIN,
  );

  router.get(
    "/api/admin/orders/:number",
    ({ params }) => {
      const order = store.orders.findByNumber(params.number);
      if (!order) {
        throw new NotFoundError("order");
      }
      return { body: { order: detail(order) } };
    },
    ADMIN,
  );

  router.post(
    "/api/admin/orders/:number/fulfil",
    ({ params, now }) => ({ body: { order: detail(fulfilOrder(store, { number: params.number, now })) } }),
    ADMIN,
  );

  router.post(
    "/api/admin/orders/:number/refund",
    async ({ params, body, user, now }) => {
      const amountCents = assertCents(body.amountCents, "amountCents");
      const order = checkRefund(store, { number: params.number, amountCents });
      const payment = store.payments.findForOrder(order.id);

      let providerRefundId = null;
      try {
        const refund = await payments.refund({ chargeId: payment.chargeId, amountCents });
        providerRefundId = refund.id;
      } catch (error) {
        logger.warn("refund.provider_error", { order: order.number, code: error.code, message: error.message });
      }

      const updated = recordRefund(store, { order, amountCents, providerRefundId, now });
      logger.info("refund.recorded", { order: order.number, amountCents, by: user.id });
      return { body: { order: detail(updated) } };
    },
    ADMIN,
  );

  // Products

  router.get(
    "/api/admin/products",
    ({ query }) => {
      const page = parsePage(query.get("page"));
      const { items, total } = store.products.list({
        sort: "name",
        includeInactive: true,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      return { body: { items: items.map(adminProduct), total, page, pageSize: PAGE_SIZE } };
    },
    ADMIN,
  );

  router.post(
    "/api/admin/products",
    ({ body, now }) => {
      const input = parseProductInput(body);
      try {
        return { status: 201, body: { product: adminProduct(store.products.create(input, now.toISOString())) } };
      } catch (error) {
        return rethrowDuplicate(error, `A product with SKU ${input.sku} already exists`, "sku_taken");
      }
    },
    ADMIN,
  );

  router.patch(
    "/api/admin/products/:id",
    ({ params, body, now }) => {
      const id = parseId(params.id);
      if (!store.products.find(id)) {
        throw new NotFoundError("product");
      }
      const changes = parseProductInput(body, { partial: true });
      try {
        return { body: { product: adminProduct(store.products.update(id, changes, now.toISOString())) } };
      } catch (error) {
        return rethrowDuplicate(error, `A product with SKU ${changes.sku} already exists`, "sku_taken");
      }
    },
    ADMIN,
  );

  // Coupons

  router.get("/api/admin/coupons", () => ({ body: { items: store.coupons.list() } }), ADMIN);

  router.post(
    "/api/admin/coupons",
    ({ body, now }) => {
      const input = parseCouponInput(body);
      try {
        return { status: 201, body: { coupon: store.coupons.create(input, now.toISOString()) } };
      } catch (error) {
        return rethrowDuplicate(error, `The code ${input.code} is already in use`, "coupon_exists");
      }
    },
    ADMIN,
  );

  // Reports

  router.get(
    "/api/admin/reports/sales",
    ({ query }) => {
      const from = parseDay(query.get("from"), "from");
      const to = parseDay(query.get("to"), "to");
      const range = dayRange(from, to);
      const days = (Date.parse(range.end) - Date.parse(range.start)) / 86_400_000;
      if (days < 1 || days > MAX_REPORT_DAYS) {
        throw new HttpError(400, "invalid_range", `Pick a range of 1 to ${MAX_REPORT_DAYS} days`);
      }
      const rows = store.payments.dailyTotals(range);
      const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
      return {
        body: {
          from,
          to,
          days: rows,
          paidCents: sum("paidCents"),
          refundedCents: sum("refundedCents"),
          netCents: sum("netCents"),
        },
      };
    },
    ADMIN,
  );
};
