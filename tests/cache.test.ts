import { describe, it, expect, beforeEach } from "vitest";
import { getCached, setCache, clearCache, purgeExpired, cacheSize } from "../src/core/cache.js";

describe("cache", () => {
  beforeEach(() => {
    clearCache();
  });

  it("returns null for missing keys", () => {
    expect(getCached("missing")).toBeNull();
  });

  it("stores and retrieves values", () => {
    setCache("key1", { data: "hello" });
    expect(getCached<{ data: string }>("key1")).toEqual({ data: "hello" });
  });

  it("returns null for expired entries", () => {
    setCache("exp1", "value", 1); // 1ms TTL
    // Manually expire by waiting
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }
    expect(getCached("exp1")).toBeNull();
  });

  it("uses default TTL when not specified", () => {
    setCache("key2", "value2");
    expect(getCached("key2")).toBe("value2");
    // Should not expire immediately
    expect(cacheSize()).toBeGreaterThan(0);
  });

  it("clearCache removes all entries", () => {
    setCache("a", 1);
    setCache("b", 2);
    setCache("c", 3);
    expect(cacheSize()).toBe(3);
    const removed = clearCache();
    expect(removed).toBe(3);
    expect(cacheSize()).toBe(0);
  });

  it("clearCache with pattern removes matching entries", () => {
    setCache("url:https://a.com", "pageA");
    setCache("url:https://b.com", "pageB");
    setCache("other:key", "other");
    const removed = clearCache("url:");
    expect(removed).toBe(2);
    expect(getCached("other:key")).toBe("other");
  });

  it("purgeExpired removes only expired entries", () => {
    setCache("live", "still-here", 60_000);
    setCache("dead", "gone", 1); // 1ms TTL
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }
    const purged = purgeExpired();
    expect(purged).toBe(1);
    expect(getCached("live")).toBe("still-here");
    expect(getCached("dead")).toBeNull();
  });
});
