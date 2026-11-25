const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry(work, { attempts = 3, delayMs = 250, factor = 2 } = {}) {
  let wait = delayMs;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await work(attempt);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(wait);
        wait *= factor;
      }
    }
  }
  throw lastError;
}
