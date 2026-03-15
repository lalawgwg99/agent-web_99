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
    import("./wikipedia.js"),
  ]);

  for (const result of modules) {
    if (result.status === "fulfilled" && result.value.default) {
      registry.register(result.value.default);
    }
  }
}
