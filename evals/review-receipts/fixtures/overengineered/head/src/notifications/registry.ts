import type { Notifier } from "./notifier.ts";

const factories = new Map<string, (send: (to: string, text: string) => void) => Notifier>();

export function registerNotifier(kind: string, factory: (send: (to: string, text: string) => void) => Notifier): void {
  factories.set(kind, factory);
}

export function createNotifier(kind: string, send: (to: string, text: string) => void): Notifier {
  const factory = factories.get(kind);
  if (!factory) throw new Error(`unknown notifier: ${kind}`);
  return factory(send);
}
