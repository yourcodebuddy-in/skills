import type { Order } from "./types.ts";

export function isOverdue(order: Order, now: Date): boolean {
  return order.paidAt === null && order.cancelledAt === null && new Date(order.dueDate).getTime() < now.getTime();
}
