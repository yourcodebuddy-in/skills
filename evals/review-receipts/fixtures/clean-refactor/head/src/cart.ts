import { formatCents } from "./money.ts";

export function cartLine(name: string, cents: number, quantity: number): string {
  return `${name} x${quantity}: ${formatCents(cents * quantity)}`;
}
