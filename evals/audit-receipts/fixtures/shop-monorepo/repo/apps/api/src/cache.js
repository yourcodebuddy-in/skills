// A small in-memory cache with per-entry expiry, for read-heavy endpoints such as the catalogue.
// Entries past maxEntries are evicted oldest first.
export const createTtlCache = ({ ttlMs, maxEntries = 500, now = () => Date.now() }) => {
  const entries = new Map();

  const evictExpired = () => {
    const time = now();
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= time) {
        entries.delete(key);
      }
    }
  };

  return {
    get: (key) => {
      const entry = entries.get(key);
      if (!entry) {
        return undefined;
      }
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },

    set: (key, value) => {
      entries.delete(key);
      if (entries.size >= maxEntries) {
        evictExpired();
      }
      if (entries.size >= maxEntries) {
        entries.delete(entries.keys().next().value);
      }
      entries.set(key, { value, expiresAt: now() + ttlMs });
    },

    delete: (key) => entries.delete(key),

    clear: () => entries.clear(),

    get size() {
      return entries.size;
    },
  };
};
