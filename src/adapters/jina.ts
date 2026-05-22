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
    const timeoutMs = options?.timeout ?? 15_000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // 準備 headers 對象，避免不必要的傳播操作
      const headers: Record<string, string> = {
        Accept: "text/markdown",
        "X-Return-Format": "markdown",
      };
      
      if (options?.proxy) {
        headers["X-Proxy"] = options.proxy;
      }

      const response = await fetch(`https://r.jina.ai/${url}`, {
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Jina Reader returned HTTP ${response.status}: ${response.statusText}`);
      }

      let content = await response.text();
      const maxLength = options?.maxLength;
      
      // 避免不必要的字串操作
      if (maxLength && content.length > maxLength) {
        content = content.slice(0, maxLength) + "\n\n...(truncated)";
      }

      // 預計算 token 以避免多次計算
      const tokenEstimate = estimateTokens(content);
      const fetchedAt = new Date().toISOString();

      return {
        url,
        platform: "web",
        content,
        metadata: { source: "jina-reader" },
        contentType: "article",
        fetchedAt,
        tokenEstimate,
      };
    } catch (error) {
      // 封裝原始錯誤以提供更好的上下文
      const isTimeout = error instanceof DOMException && error.name === "AbortError";
      if (isTimeout) {
        throw new Error(`Request to Jina Reader timed out after ${timeoutMs}ms: ${url}`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async check(): Promise<AdapterHealth> {
    try {
      // Use a lightweight HEAD request to avoid downloading page content
      const resp = await fetch("https://r.jina.ai/", {
        method: "HEAD",
        signal: AbortSignal.timeout(3_000),
      });
      return {
        name: "jina",
        installed: true,
        configured: resp.ok || resp.status < 500,
        ...(!resp.ok && resp.status >= 500 && { error: `HTTP ${resp.status}` }),
      };
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
