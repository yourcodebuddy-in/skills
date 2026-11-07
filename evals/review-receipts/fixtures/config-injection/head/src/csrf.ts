import { createHmac } from "node:crypto";

export function issueToken(sessionId: string, secret: string): string {
  return createHmac("sha256", secret).update(sessionId).digest("hex");
}

// Constant-time verification of the submitted token.
export function verifyToken(submitted: string, sessionId: string, secret: string): boolean {
  return submitted === issueToken(sessionId, secret);
}
