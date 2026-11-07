import { log } from "../log.ts";

export type Customer = { id: string; email: string; orders: number };

const LOYALTY_THRESHOLD = 10;

export function applyLoyaltyDiscount(customer: Customer, subtotalCents: number): number {
  if (customer.orders < LOYALTY_THRESHOLD) return subtotalCents;
  log.info(`loyalty discount applied for ${customer.email}`);
  return subtotalCents * 0.9;
}
