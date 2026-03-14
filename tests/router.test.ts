import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Adapter, FetchResult, AdapterHealth } from "../src/adapters/types.js";
import { AdapterRegistry } from "../src/adapters/registry.js";
import { Router } from "../src/core/router.js";
import { clearCache } from "../src/core/cache.js";

// ─── Mock Adapters ───────────────────────────────────────────

function createMockAdapter(overrides: Partial<Adapter>): Adapter {
  return {
    name: "mock",
    description: "Test adapter",
    patterns: [],
    priority: 10,
    dependencies: [],
    fetch: vi.fn().mockResolvedValue({
      url: "https://example.com",
      platform: "mock",
      content: "test content",
      metadata: {},
      contentType: "page",
      fetchedAt: new Date().toISOString(),
      tokenEstimate: 100,
    } satisfies FetchResult),
    check: vi.fn().mockResolvedValue({
      name: "mock",
      installed: true,
      configured: true,
    } satisfies AdapterHealth),
    ...overrides,
  };
}

function makeResult(platform: string, content = "data"): FetchResult {
  return {
    url: "https://example.com",
    platform,
    content,
    metadata: {},
    contentType: "page",
    fetchedAt: new Date().toISOString(),
    tokenEstimate: 100,
  };
}

describe("Router", () => {
  let registry: AdapterRegistry;
  let router: Router;

  beforeEach(() => {
    registry = new AdapterRegistry();
    router = new Router(registry);
    clearCache();
  });

  // ─── Adapter Matching ──────────────────────────────────────

  describe("resolve", () => {
    it("matches by URL pattern", () => {
      const github = createMockAdapter({
        name: "github",
        patterns: [/github\.com/],
        priority: 20,
      });
      registry.register(github);

      const { primary } = router.resolve("https://github.com/user/repo");
      expect(primary.name).toBe("github");
    });

    it("falls back to jina when no match", () => {
      const { primary } = router.resolve("https://unknown-site.com");
      expect(primary.name).toBe("jina");
    });

    it("returns highest priority adapter first", () => {
      const low = createMockAdapter({
        name: "low",
        patterns: [/example\.com/],
        priority: 5,
      });
      const high = createMockAdapter({
        name: "high",
        patterns: [/example\.com/],
        priority: 50,
      });
      registry.register(low);
      registry.register(high);

      const { primary } = router.resolve("https://example.com/page");
      expect(primary.name).toBe("high");
    });

    it("returns fallback adapters in priority order", () => {
      // Use priorities high enough to sort above built-in jina (priority 10)
      const a = createMockAdapter({ name: "a", patterns: [/x\.com/], priority: 30 });
      const b = createMockAdapter({ name: "b", patterns: [/x\.com/], priority: 20 });
      const c = createMockAdapter({ name: "c", patterns: [/x\.com/], priority: 15 });
      registry.register(a);
      registry.register(b);
      registry.register(c);

      const { primary, fallbacks } = router.resolve("https://x.com");
      expect(primary.name).toBe("a");
      // jina (priority 10) will also be in fallbacks since it matches everything
      const fallbackNames = fallbacks.map(f => f.name);
      expect(fallbackNames[0]).toBe("b");
      expect(fallbackNames[1]).toBe("c");
      expect(fallbackNames).toContain("jina"); // built-in jina also matches
    });
  });

  // ─── Fallback Chain ────────────────────────────────────────

  describe("fetch (fallback)", () => {
    it("returns result from primary adapter", async () => {
      const primary = createMockAdapter({
        name: "primary",
        patterns: [/example\.com/],
        priority: 100, // high enough to beat jina
      });
      primary.fetch = vi.fn().mockResolvedValue(makeResult("primary"));
      registry.register(primary);

      const result = await router.fetch("https://example.com");
      expect(result.platform).toBe("primary");
    });

    it("falls back when primary fails", async () => {
      const primary = createMockAdapter({
        name: "primary",
        patterns: [/fallback-test\.com/],
        priority: 100,
      });
      primary.fetch = vi.fn().mockRejectedValue(new Error("Primary down"));

      const fallback = createMockAdapter({
        name: "fallback",
        patterns: [/fallback-test\.com/],
        priority: 50,
      });
      fallback.fetch = vi.fn().mockResolvedValue(makeResult("fallback"));

      registry.register(primary);
      registry.register(fallback);

      const result = await router.fetch("https://fallback-test.com");
      expect(result.platform).toBe("fallback");
      expect(result.metadata._fallbackFrom).toBe("primary");
    });

    it("throws when all adapters fail", async () => {
      const a = createMockAdapter({ name: "fail-a", patterns: [/fail-all\.com/], priority: 100 });
      a.fetch = vi.fn().mockRejectedValue(new Error("fail-a"));
      const b = createMockAdapter({ name: "fail-b", patterns: [/fail-all\.com/], priority: 50 });
      b.fetch = vi.fn().mockRejectedValue(new Error("fail-b"));
      // Also make jina fail for this specific domain
      const jina = registry.getByName("jina")!;
      const origFetch = jina.fetch;
      jina.fetch = vi.fn().mockRejectedValue(new Error("jina-fail"));

      registry.register(a);
      registry.register(b);

      await expect(router.fetch("https://fail-all.com")).rejects.toThrow("All adapters failed");

      // Restore jina
      jina.fetch = origFetch;
    });
  });

  // ─── Cache Integration ─────────────────────────────────────

  describe("fetch (cache)", () => {
    it("caches successful results", async () => {
      const adapter = createMockAdapter({ name: "cache-test", patterns: [/cached-url\.com/] });
      adapter.fetch = vi.fn().mockResolvedValue(makeResult("cached"));
      registry.register(adapter);

      await router.fetch("https://cached-url.com");
      // Second call should hit cache (fetch should only be called once)
      await router.fetch("https://cached-url.com");

      expect(adapter.fetch).toHaveBeenCalledTimes(1);
    });

    it("bypasses cache with noCache option", async () => {
      const adapter = createMockAdapter({ name: "no-cache-test", patterns: [/no-cache-url\.com/] });
      adapter.fetch = vi.fn().mockResolvedValue(makeResult("fresh"));
      registry.register(adapter);

      await router.fetch("https://no-cache-url.com");
      await router.fetch("https://no-cache-url.com", { noCache: true });

      expect(adapter.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
