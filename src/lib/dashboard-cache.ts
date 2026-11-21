type CacheEntry<T> = {
  key: string;
  cachedAt: number;
  value: T;
};

export class DashboardTtlCache<T> {
  private cached: CacheEntry<T> | null = null;
  private pending: { key: string; promise: Promise<T> } | null = null;

  constructor(private readonly ttlMs: number) {}

  async get(key: string, forceRefresh: boolean, load: () => Promise<T>): Promise<T> {
    if (
      !forceRefresh &&
      this.cached?.key === key &&
      Date.now() - this.cached.cachedAt < this.ttlMs
    ) {
      return this.cached.value;
    }

    if (this.pending) {
      if (!forceRefresh && this.pending.key === key) return this.pending.promise;
      // A failed previous load must not prevent a new key or explicit refresh from retrying.
      await this.pending.promise.catch(() => undefined);
    }

    const pending = load();
    this.pending = { key, promise: pending };
    try {
      const value = await pending;
      this.cached = { key, cachedAt: Date.now(), value };
      return value;
    } finally {
      if (this.pending?.promise === pending) this.pending = null;
    }
  }
}
