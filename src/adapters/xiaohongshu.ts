import type {
  Adapter,
  FetchResult,
  AdapterHealth,
  AdapterOptions,
} from "./types.js";
import { estimateTokens } from "../utils/tokens.js";
import { loadConfig } from "../core/config.js";

/**
 * 小紅書 adapter — 需要 Cookie 認證
 * 透過直接請求 API 取得筆記內容
 */
const xiaohongshuAdapter: Adapter = {
  name: "xiaohongshu",
  description: "XiaoHongShu (Little Red Book) posts (requires cookies)",
  priority: 70,
  patterns: [/xiaohongshu\.com\//, /xhslink\.com\//],
  dependencies: [],

  async fetch(url: string, options?: AdapterOptions): Promise<FetchResult> {
    const config = loadConfig();
    const cookies = options?.cookies ?? config.platforms.xiaohongshu?.cookies;

    if (!cookies) {
      throw new Error(
        'XiaoHongShu requires cookies. Set with: agent-web config set platforms.xiaohongshu.cookies "..."',
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options?.timeout ?? 15_000,
    );

    try {
      const response = await fetch(url, {
        headers: {
          Cookie: cookies,
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`XiaoHongShu returned ${response.status}`);
      }

      const html = await response.text();

      // 提取基本內容（簡易解析）
      const titleMatch = html.match(/<title>(.*?)<\/title>/);
      const title = titleMatch?.[1] ?? "XiaoHongShu Post";

      // 嘗試從 SSR 資料中提取筆記內容
      const noteDataMatch = html.match(
        /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*<\/script>/,
      );
      let content = title;

      if (noteDataMatch) {
        try {
          const noteData = JSON.parse(
            noteDataMatch[1]!.replace(/undefined/g, "null"),
          );
          const note = noteData?.note?.noteDetailMap;
          if (note) {
            const firstNote = Object.values(note)[0] as { note?: { title?: string; desc?: string } } | undefined;
            content = [
              `# ${firstNote?.note?.title ?? title}`,
              "",
              firstNote?.note?.desc ?? "",
            ].join("\n");
          }
        } catch {
          // 解析失敗，使用標題
        }
      }

      return {
        url,
        platform: "xiaohongshu",
        content,
        metadata: { title },
        contentType: "post",
        fetchedAt: new Date().toISOString(),
        tokenEstimate: estimateTokens(content),
      };
    } finally {
      clearTimeout(timeout);
    }
  },

  async check(): Promise<AdapterHealth> {
    const config = loadConfig();
    const hasCookies = !!config.platforms.xiaohongshu?.cookies;

    return {
      name: "xiaohongshu",
      installed: true,
      configured: hasCookies,
      ...(!hasCookies && {
        error: "No cookies configured",
        installHint:
          'agent-web config set platforms.xiaohongshu.cookies "your_cookies"',
      }),
    };
  },
};

export default xiaohongshuAdapter;
