import type { Adapter, AdapterOptions, FetchResult } from "../adapters/types.js";
import { AdapterRegistry, loadBuiltinAdapters } from "../adapters/registry.js";
import { getCached, setCache } from "./cache.js";

/**
 * 智慧路由器
 * URL 進來 → 自動選最佳 Adapter → 失敗自動降級
 * 支援 TTL 快取、指數退避重試
 */
export class Router {
  private registry: AdapterRegistry;
  private initialized = false;

  constructor(registry?: AdapterRegistry) {
    this.registry = registry ?? new AdapterRegistry();
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await loadBuiltinAdapters(this.registry);
    this.initialized = true;
  }

  getRegistry(): AdapterRegistry {
    return this.registry;
  }

  /**
   * 解析 URL → 主要 adapter + 備用 adapters
   */
  resolve(url: string): { primary: Adapter; fallbacks: Adapter[] } {
    const matches = this.registry.match(url);

    if (matches.length === 0) {
      const jina = this.registry.getByName("jina");
      if (!jina) throw new Error("No adapters available");
      return { primary: jina, fallbacks: [] };
    }

    return {
      primary: matches[0]!,
      fallbacks: matches.slice(1),
    };
  }

  /**
   * Check if an error is retryable (network/timeout/5xx only, not 4xx)
   */
  private isRetryableError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    // Retry on network errors, timeouts, 5xx
    if (msg.includes("timeout") || msg.includes("timed out")) return true;
    if (msg.includes("econnrefused") || msg.includes("enotfound") || msg.includes("econnreset")) return true;
    if (msg.includes("network") || msg.includes("fetch failed")) return true;
    // 5xx errors
    if (/http 5\d\d/.test(msg) || /status 5\d\d/.test(msg)) return true;
    // Don't retry 4xx client errors
    if (/http 4\d\d/.test(msg) || /status 4\d\d/.test(msg)) return false;
    return false;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Try fetching with an adapter, with retry + exponential backoff.
   * MaxRetries: 2 extra attempts (3 total), backoff: 500ms → 1000ms → 2000ms
   */
  private async fetchWithRetry(
    adapter: Adapter,
    url: string,
    options?: AdapterOptions,
    maxRetries = 2,
  ): Promise<FetchResult> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await adapter.fetch(url, options);
      } catch (err) {
        lastError = err as Error;
        if (attempt < maxRetries && this.isRetryableError(err)) {
          const backoffMs = 500 * Math.pow(2, attempt); // 500, 1000, 2000
          console.error(
            `[retry] adapter=${adapter.name} attempt=${attempt + 1}/${maxRetries + 1} backoff=${backoffMs}ms error=${lastError.message}`,
          );
          await this.delay(backoffMs);
        } else {
          // Non-retryable or last attempt — break immediately
          throw err;
        }
      }
    }

    // Should not reach here, but satisfy TypeScript
    throw lastError ?? new Error("Unexpected retry loop exit");
  }

  /**
   * 智慧抓取：自動選 adapter + 失敗自動降級 + 快取
   */
  async fetch(
    url: string,
    options?: AdapterOptions & { noCache?: boolean },
  ): Promise<FetchResult> {
    await this.init();

    // Check cache (unless bypassed)
    if (!options?.noCache) {
      const cached = getCached<FetchResult>(url);
      if (cached) return cached;
    }

    const { primary, fallbacks } = this.resolve(url);
    const errors: Error[] = [];

    // 嘗試主要 adapter (with retry)
    try {
      const result = await this.fetchWithRetry(primary, url, options);
      if (!options?.noCache) {
        setCache(url, result);
      }
      return result;
    } catch (err) {
      errors.push(err as Error);
    }

    // 降級到備用 adapters (with retry)
    for (const fallback of fallbacks) {
      try {
        const result = await this.fetchWithRetry(fallback, url, options);
        result.metadata._fallbackFrom = primary.name;
        if (!options?.noCache) {
          setCache(url, result);
        }
        return result;
      } catch (err) {
        errors.push(err as Error);
      }
    }

    const messages = errors.map((e) => e.message).join("; ");
    throw new Error(`All adapters failed for ${url}: ${messages}`);
  }

  /**
   * 用指定 adapter 抓取
   */
  async fetchWith(
    adapterName: string,
    url: string,
    options?: AdapterOptions,
  ): Promise<FetchResult> {
    await this.init();

    const adapter = this.registry.getByName(adapterName);
    if (!adapter) {
      throw new Error(`Adapter "${adapterName}" not found`);
    }
    return adapter.fetch(url, options);
  }
}
