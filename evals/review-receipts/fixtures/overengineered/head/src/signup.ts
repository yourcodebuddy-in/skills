import { EmailNotifier } from "./notifications/email-notifier.ts";
import { createNotifier, registerNotifier } from "./notifications/registry.ts";

registerNotifier("email", (send) => new EmailNotifier(send));

export function signup(email: string, send: (to: string, text: string) => void): void {
  createNotifier("email", send).notify(email, "Welcome!");
}
