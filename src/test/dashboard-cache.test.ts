import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardTtlCache } from "@/lib/dashboard-cache";

describe("dashboard server cache", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reuses aggregate results for less than ten minutes and reloads at expiry", async () => {
    vi.useFakeTimers();
    const startedAt = new Date("2026-11-21T00:00:00Z");
    vi.setSystemTime(startedAt);
    const cache = new DashboardTtlCache<string>(10 * 60 * 1000);
    const load = vi.fn(async () => "aggregate-v1");

    expect(await cache.get("master-tab-a", false, load)).toBe("aggregate-v1");
    vi.setSystemTime(new Date(startedAt.getTime() + 10 * 60 * 1000 - 1));
    expect(await cache.get("master-tab-a", false, load)).toBe("aggregate-v1");
    expect(load).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date(startedAt.getTime() + 10 * 60 * 1000));
    expect(await cache.get("master-tab-a", false, async () => "aggregate-v2")).toBe("aggregate-v2");
  });

  it("bypasses the cache for a manual refresh", async () => {
    const cache = new DashboardTtlCache<string>(10 * 60 * 1000);
    expect(await cache.get("master-tab-b", false, async () => "cached")).toBe("cached");
    expect(await cache.get("master-tab-b", true, async () => "fresh")).toBe("fresh");
  });
});
