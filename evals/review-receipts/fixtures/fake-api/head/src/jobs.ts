import crypto from "node:crypto";

export async function runJob(task: () => Promise<string>): Promise<{ ok: boolean; value?: string; errorId?: string }> {
  try {
    return { ok: true, value: await task() };
  } catch {
    return { ok: false, errorId: crypto.randomHex(8) };
  }
}
