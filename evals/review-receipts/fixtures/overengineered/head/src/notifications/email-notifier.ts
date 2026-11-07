import type { Notifier } from "./notifier.ts";

export class EmailNotifier implements Notifier {
  private send: (to: string, text: string) => void;

  constructor(send: (to: string, text: string) => void) {
    this.send = send;
  }

  notify(to: string, text: string): void {
    this.send(to, text);
  }
}
