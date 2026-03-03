import type { Adapter, AdapterOptions, FetchResult } from "../adapters/types.js";
import { AdapterRegistry, loadBuiltinAdapters } from "../adapters/registry.js";

/**
 * 智慧路由器
 * URL 進來 → 自動選最佳 Adapter → 失敗自動降級
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
   * 智慧抓取：自動選 adapter + 失敗自動降級
   */
  async fetch(url: string, options?: AdapterOptions): Promise<FetchResult> {
    await this.init();

    const { primary, fallbacks } = this.resolve(url);
    const errors: Error[] = [];

    // 嘗試主要 adapter
    try {
      return await primary.fetch(url, options);
    } catch (err) {
      errors.push(err as Error);
    }

    // 降級到備用 adapters
    for (const fallback of fallbacks) {
      try {
        const result = await fallback.fetch(url, options);
        result.metadata._fallbackFrom = primary.name;
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
