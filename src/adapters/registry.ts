import type { Adapter } from "./types.js";
import { jinaAdapter } from "./jina.js";

/**
 * Adapter 註冊中心
 * 內建 adapters + 社群 adapter 自動發現
 */
export class AdapterRegistry {
  private adapters: Adapter[] = [];

  constructor() {
    this.register(jinaAdapter);
  }

  register(adapter: Adapter): void {
    this.adapters.push(adapter);
    this.adapters.sort((a, b) => b.priority - a.priority);
  }

  getAll(): Adapter[] {
    return [...this.adapters];
  }

  getByName(name: string): Adapter | undefined {
    return this.adapters.find((a) => a.name === name);
  }

  /**
   * 根據 URL 找到匹配的 adapters（按 priority 排序）
   */
  match(url: string): Adapter[] {
    return this.adapters.filter((adapter) =>
      adapter.patterns.some((p) => p.test(url)),
    );
  }
}

/**
 * Module-level singleton: reuse the same fully-loaded registry across all
 * Router instances so loadBuiltinAdapters is only called once per process.
 */
let _builtinRegistry: AdapterRegistry | null = null;
let _loadingPromise: Promise<AdapterRegistry> | null = null;

/**
 * Return (and lazily create) the shared builtin AdapterRegistry singleton.
 * Safe to call concurrently — only one load will ever run.
 */
export async function getBuiltinRegistry(): Promise<AdapterRegistry> {
  if (_builtinRegistry) return _builtinRegistry;
  if (_loadingPromise) return _loadingPromise;

  _loadingPromise = (async () => {
    const registry = new AdapterRegistry();
    await loadBuiltinAdapters(registry);
    _builtinRegistry = registry;
    return registry;
  })();

  return _loadingPromise;
}

/**
 * 載入所有內建 adapters（lazy import 避免載入不需要的依賴）
 */
export async function loadBuiltinAdapters(
  registry: AdapterRegistry,
): Promise<void> {
  const modules = await Promise.allSettled([
    import("./youtube.js"),
    import("./twitter.js"),
    import("./github.js"),
    import("./reddit.js"),
    import("./bilibili.js"),
    import("./rss.js"),
    import("./xiaohongshu.js"),
  ]);

  for (const result of modules) {
    if (result.status === "fulfilled" && result.value.default) {
      registry.register(result.value.default);
    }
  }
}
