export function cartLine(name: string, cents: number, quantity: number): string {
  const total = cents * quantity;
  const dollars = Math.floor(total / 100);
  const remainder = String(total % 100).padStart(2, "0");
  return `${name} x${quantity}: $${dollars}.${remainder}`;
}
