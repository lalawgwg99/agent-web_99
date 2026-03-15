import type { Adapter, AdapterOptions, FetchResult } from "../adapters/types.js";
import { AdapterRegistry, loadBuiltinAdapters } from "../adapters/registry.js";

/**
 * 智慧路由器
 * URL 進來 → 自動選最佳 Adapter → 失敗自動降級
 */

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 500;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
   * 智慧抓取：自動選 adapter + 失敗自動降級
   * 每個 adapter 會重試最多 maxRetries 次（指數退避）
   */
  async fetch(
    url: string,
    options?: AdapterOptions & { maxRetries?: number },
  ): Promise<FetchResult> {
    await this.init();

    const { primary, fallbacks } = this.resolve(url);
    const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
    const errors: Error[] = [];

    // 嘗試主要 adapter（含重試）
    const primaryResult = await this.fetchWithRetry(
      primary,
      url,
      options,
      maxRetries,
    );
    if (primaryResult.ok) return primaryResult.value;
    errors.push(primaryResult.error);

    // 降級到備用 adapters
    for (const fallback of fallbacks) {
      const result = await this.fetchWithRetry(
        fallback,
        url,
        options,
        maxRetries,
      );
      if (result.ok) {
        result.value.metadata._fallbackFrom = primary.name;
        return result.value;
      }
      errors.push(result.error);
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

  /**
   * 帶指數退避的重試封裝
   */
  private async fetchWithRetry(
    adapter: Adapter,
    url: string,
    options: AdapterOptions | undefined,
    maxRetries: number,
  ): Promise<{ ok: true; value: FetchResult } | { ok: false; error: Error }> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const value = await adapter.fetch(url, options);
        return { ok: true, value };
      } catch (err) {
        lastError = err as Error;
        if (attempt < maxRetries) {
          const delay = DEFAULT_BASE_DELAY_MS * Math.pow(2, attempt);
          await sleep(delay);
        }
      }
    }

    return { ok: false, error: lastError! };
  }
}
