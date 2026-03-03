import type {
  Adapter,
  FetchResult,
  AdapterHealth,
  AdapterOptions,
} from "./types.js";
import Parser from "rss-parser";
import { estimateTokens } from "../utils/tokens.js";

const parser = new Parser();

/**
 * RSS/Atom adapter — 解析 feed
 */
const rssAdapter: Adapter = {
  name: "rss",
  description: "RSS/Atom feeds",
  priority: 50,
  patterns: [
    /\.rss$/,
    /\/feed\/?$/,
    /\/atom\.xml$/,
    /\/rss\.xml$/,
    /feeds\.\w+\.com/,
  ],
  dependencies: [],

  async fetch(url: string, options?: AdapterOptions): Promise<FetchResult> {
    const feed = await parser.parseURL(url);

    const items = (feed.items ?? []).slice(0, 25);
    const content = [
      `# ${feed.title ?? "RSS Feed"}`,
      feed.description ?? "",
      "",
      ...items.map((item) => {
        const date = item.pubDate
          ? new Date(item.pubDate).toISOString().split("T")[0]
          : "";
        return `- **${item.title ?? "Untitled"}** (${date})\n  ${item.link ?? ""}\n  ${(item.contentSnippet ?? "").slice(0, 200)}`;
      }),
    ].join("\n");

    const truncated =
      options?.maxLength && content.length > options.maxLength
        ? content.slice(0, options.maxLength) + "\n\n...(truncated)"
        : content;

    return {
      url,
      platform: "rss",
      content: truncated,
      metadata: {
        title: feed.title,
        itemCount: items.length,
      },
      contentType: "feed",
      fetchedAt: new Date().toISOString(),
      tokenEstimate: estimateTokens(truncated),
    };
  },

  async check(): Promise<AdapterHealth> {
    return { name: "rss", installed: true, configured: true, version: "built-in" };
  },
};

export default rssAdapter;
