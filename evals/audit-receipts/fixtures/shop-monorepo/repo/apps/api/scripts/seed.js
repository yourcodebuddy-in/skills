// Fills a development database with a small catalogue and a coupon: node apps/api/scripts/seed.js
import { createStore, openDatabase } from "../../../packages/db/src/index.js";

const PRODUCTS = [
  { sku: "MUG-STONE", name: "Stoneware mug", description: "Hand-glazed, 350 ml.", priceCents: 1800, stock: 40 },
  { sku: "MUG-TALL", name: "Tall mug", description: "For people who mean it. 500 ml.", priceCents: 2200, stock: 25 },
  { sku: "POUR-OVER", name: "Pour-over cone", description: "Ceramic, size 02 filters.", priceCents: 3400, stock: 12 },
  { sku: "FILTERS-100", name: "Paper filters (100)", description: "Unbleached, size 02.", priceCents: 650, stock: 200 },
  { sku: "BEANS-HOUSE", name: "House blend, 250 g", description: "Chocolate and hazelnut.", priceCents: 1450, stock: 60 },
  { sku: "BEANS-ETHIO", name: "Yirgacheffe, 250 g", description: "Jasmine and lemon.", priceCents: 1750, stock: 30 },
  { sku: "GRINDER-HAND", name: "Hand grinder", description: "Steel burrs, 30 settings.", priceCents: 8900, stock: 8 },
  { sku: "KETTLE-GOOSE", name: "Gooseneck kettle", description: "1 litre, stovetop.", priceCents: 5600, stock: 10 },
  { sku: "SCALE-01", name: "Brew scale", description: "0.1 g, with timer.", priceCents: 3900, stock: 15 },
  { sku: "TOTE-CANVAS", name: "Canvas tote", description: "Heavy cotton.", priceCents: 1200, stock: 50 },
];

const store = createStore(openDatabase(process.env.DATABASE_FILE ?? "data/shop.db"));
const now = new Date().toISOString();

let added = 0;
for (const product of PRODUCTS) {
  try {
    store.products.create(product, now);
    added += 1;
  } catch (error) {
    if (error?.errcode !== 2067) {
      throw error;
    }
  }
}

if (!store.coupons.find("WELCOME10")) {
  store.coupons.create(
    { code: "WELCOME10", percentOff: 10, amountOffCents: null, minSubtotalCents: 0, maxRedemptions: null, expiresOn: null },
    now,
  );
}

console.log(`Added ${added} products. Coupon WELCOME10 is ready.`);
