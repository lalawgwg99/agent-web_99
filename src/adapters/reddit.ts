import type {
  Adapter,
  FetchResult,
  AdapterHealth,
  AdapterOptions,
} from "./types.js";
import { estimateTokens } from "../utils/tokens.js";

/**
 * Reddit adapter — 透過 JSON API（append .json）
 */
const redditAdapter: Adapter = {
  name: "reddit",
  description: "Reddit posts and threads via JSON API",
  priority: 80,
  patterns: [/(?:reddit\.com|old\.reddit\.com)\/r\/\w+/],
  dependencies: [],

  async fetch(url: string, options?: AdapterOptions): Promise<FetchResult> {
    // Reddit JSON API: 任何 URL 加 .json
    const jsonUrl = url.replace(/\/?$/, ".json");

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options?.timeout ?? 15_000,
    );

    try {
      const response = await fetch(jsonUrl, {
        headers: { "User-Agent": "agent-web/0.1.0" },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Reddit returned ${response.status}`);
      }

      const data = (await response.json()) as
        | Array<{ data?: { children?: Array<{ data?: Record<string, unknown> }> } }>
        | { data?: { children?: Array<{ data?: Record<string, unknown> }> } };
      let content: string;

      if (Array.isArray(data)) {
        // 單一帖子頁面
        const post = data[0]?.data?.children?.[0]?.data;
        const comments = data[1]?.data?.children ?? [];

        content = [
          `# ${post?.title ?? "Unknown"}`,
          `**r/${post?.subreddit ?? "unknown"}** | **Score:** ${post?.score ?? 0} | **Comments:** ${post?.num_comments ?? 0}`,
          `**Author:** u/${post?.author ?? "unknown"}`,
          "",
          post?.selftext ?? post?.url ?? "",
          "",
          `## Top Comments`,
          ...comments.slice(0, 10).map(
            (c: { data?: { author?: string; body?: string; score?: number } }) => {
              const d = c.data;
              return `**u/${d?.author ?? "unknown"}** (${d?.score ?? 0} pts)\n${d?.body ?? ""}\n`;
            },
          ),
        ].join("\n");
      } else {
        // Subreddit 列表
        const posts = data?.data?.children ?? [];
        content = posts
          .slice(0, 25)
          .map(
            (p: { data?: { title?: string; score?: number; num_comments?: number; permalink?: string } }) => {
              const d = p.data;
              return `- **${d?.title ?? ""}** (${d?.score ?? 0} pts, ${d?.num_comments ?? 0} comments) https://reddit.com${d?.permalink ?? ""}`;
            },
          )
          .join("\n");
      }

      if (options?.maxLength && content.length > options.maxLength) {
        content = content.slice(0, options.maxLength) + "\n\n...(truncated)";
      }

      return {
        url,
        platform: "reddit",
        content,
        metadata: { source: "json-api" },
        contentType: Array.isArray(data) ? "thread" : "feed",
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
        const res = await fetch(
          "https://www.reddit.com/r/programming.json?limit=1",
          {
            headers: { "User-Agent": "agent-web/0.1.0" },
            signal: controller.signal,
          },
        );
        return { name: "reddit", installed: true, configured: res.ok };
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return {
        name: "reddit",
        installed: true,
        configured: false,
        error: "Network unreachable (may need proxy)",
      };
    }
  },
};

export default redditAdapter;
