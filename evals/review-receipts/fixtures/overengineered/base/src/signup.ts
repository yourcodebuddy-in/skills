export function signup(email: string, send: (to: string, text: string) => void): void {
  send(email, "Welcome!");
}
