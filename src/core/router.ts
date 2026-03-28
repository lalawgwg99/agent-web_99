import type { Adapter, AdapterOptions, FetchResult } from "../adapters/types.js";
import { AdapterRegistry, getBuiltinRegistry } from "../adapters/registry.js";

/**
 * 智慧路由器
 * URL 進來 → 自動選最佳 Adapter → 失敗自動降級
 */
export class Router {
  private registry: AdapterRegistry | null;
  private initialized = false;

  constructor(registry?: AdapterRegistry) {
    // If a custom registry is provided use it directly (and mark as initialized);
    // otherwise we'll lazily load the shared builtin singleton on first use.
    if (registry) {
      this.registry = registry;
      this.initialized = true;
    } else {
      this.registry = null;
    }
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.registry = await getBuiltinRegistry();
    this.initialized = true;
  }

  getRegistry(): AdapterRegistry {
    if (!this.registry) throw new Error("Router not yet initialized");
    return this.registry;
  }

  /**
   * 解析 URL → 主要 adapter + 備用 adapters
   */
  resolve(url: string): { primary: Adapter; fallbacks: Adapter[] } {
    const registry = this.getRegistry();
    const matches = registry.match(url);

    if (matches.length === 0) {
      const jina = registry.getByName("jina");
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
    // Inline flag check avoids async overhead on every call after init
    if (!this.initialized) await this.init();

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
    // Inline flag check avoids async overhead on every call after init
    if (!this.initialized) await this.init();

    const adapter = this.getRegistry().getByName(adapterName);
    if (!adapter) {
      throw new Error(`Adapter "${adapterName}" not found`);
    }
    return adapter.fetch(url, options);
  }
}
