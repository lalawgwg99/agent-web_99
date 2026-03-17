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
 * 使用 Promise.all 而非 allSettled 以優化加載性能，並在開發模式下提供詳細錯誤
 */
export async function loadBuiltinAdapters(
  registry: AdapterRegistry,
): Promise<void> {
  // 允許單個 adapter 失敗而不影響整體功能
  const safeImport = async (path: string) => {
    try {
      const module = await import(path);
      if (module.default) {
        registry.register(module.default);
      }
    } catch (err) {
      // 開發模式下記錄詳細錯誤，生產模式僅簡單記錄
      if (process.env.NODE_ENV === "development") {
        console.error(`Failed to load adapter ${path}:`, err);
      }
    }
  };

  // 並行載入所有 adapters
  await Promise.all([
    safeImport("./youtube.js"),
    safeImport("./twitter.js"),
    safeImport("./github.js"),
    safeImport("./reddit.js"),
    safeImport("./bilibili.js"),
    safeImport("./rss.js"),
    safeImport("./xiaohongshu.js"),
  ]);
}
