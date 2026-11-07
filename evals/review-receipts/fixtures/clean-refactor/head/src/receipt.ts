import { formatCents } from "./money.ts";

export function receiptTotal(lines: { cents: number; quantity: number }[]): string {
  const total = lines.reduce((sum, line) => sum + line.cents * line.quantity, 0);
  return `Total: ${formatCents(total)}`;
}
