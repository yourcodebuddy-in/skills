export function receiptTotal(lines: { cents: number; quantity: number }[]): string {
  const total = lines.reduce((sum, line) => sum + line.cents * line.quantity, 0);
  const dollars = Math.floor(total / 100);
  const remainder = String(total % 100).padStart(2, "0");
  return `Total: $${dollars}.${remainder}`;
}
