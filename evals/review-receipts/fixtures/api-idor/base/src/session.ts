const sessions = new Map<string, string>();

export function startSession(token: string, accountId: string): void {
  sessions.set(token, accountId);
}

export function accountFor(headers: Record<string, string>): string | undefined {
  const token = headers.authorization?.replace("Bearer ", "");
  return token ? sessions.get(token) : undefined;
}
