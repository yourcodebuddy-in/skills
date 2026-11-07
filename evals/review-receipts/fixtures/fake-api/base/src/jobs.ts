export async function runJob(task: () => Promise<string>): Promise<{ ok: boolean; value?: string }> {
  try {
    return { ok: true, value: await task() };
  } catch {
    return { ok: false };
  }
}
