export interface Notifier {
  notify(to: string, text: string): void;
}
