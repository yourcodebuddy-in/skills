import type { Customer, Order } from "../orders/types.ts";

export type OverdueRow = { orderId: string; customer: string; amountCents: number };

export function overdueReport(orders: Order[], customers: Customer[], now: Date): OverdueRow[] {
  const rows: OverdueRow[] = [];
  for (const order of orders) {
    const unpaid = order.paidAt === null && order.cancelledAt === null;
    const pastDue = new Date(order.dueDate).getTime() < now.getTime();
    if (!unpaid || !pastDue) continue;

    const customer = customers.find((candidate) => candidate.id === order.customerId);
    rows.push({ orderId: order.id, customer: customer?.name ?? "Unknown", amountCents: order.amountCents });
  }
  return rows;
}
