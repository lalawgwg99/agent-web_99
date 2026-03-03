import type {
  Adapter,
  FetchResult,
  AdapterHealth,
  AdapterOptions,
} from "./types.js";
import { estimateTokens } from "../utils/tokens.js";

/**
 * Jina Reader adapter — 通用網頁抓取
 * 零依賴，用 Jina Reader API 將任意網頁轉為 Markdown
 */
export const jinaAdapter: Adapter = {
  name: "jina",
  description: "General web pages via Jina Reader API (free, no deps)",
  priority: 10,
  patterns: [/.*/],
  dependencies: [],

  async fetch(url: string, options?: AdapterOptions): Promise<FetchResult> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options?.timeout ?? 15_000,
    );

    try {
      const response = await fetch(`https://r.jina.ai/${url}`, {
        headers: {
          Accept: "text/markdown",
          "X-Return-Format": "markdown",
          ...(options?.proxy ? { "X-Proxy": options.proxy } : {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Jina Reader returned ${response.status}`);
      }

      let content = await response.text();

      if (options?.maxLength && content.length > options.maxLength) {
        content = content.slice(0, options.maxLength) + "\n\n...(truncated)";
      }

      return {
        url,
        platform: "web",
        content,
        metadata: { source: "jina-reader" },
        contentType: "article",
        fetchedAt: new Date().toISOString(),
        tokenEstimate: estimateTokens(content),
      };
    } finally {
      clearTimeout(timeout);
    }
  },

  async check(): Promise<AdapterHealth> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);
      try {
        const res = await fetch("https://r.jina.ai/https://example.com", {
          signal: controller.signal,
        });
        return {
          name: "jina",
          installed: true,
          configured: res.ok,
          ...(!res.ok && { error: `HTTP ${res.status}` }),
        };
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return {
        name: "jina",
        installed: true,
        configured: false,
        error: "Network unreachable",
      };
    }
  },
};
