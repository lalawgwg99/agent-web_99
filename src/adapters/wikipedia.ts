import type {
  Adapter,
  FetchResult,
  AdapterHealth,
  AdapterOptions,
} from "./types.js";
import { estimateTokens } from "../utils/tokens.js";

/**
 * Wikipedia adapter — 零依賴，透過 REST API 取得條目內容
 * 支援多語言（en.wikipedia.org, zh.wikipedia.org, etc.）
 */

interface WikipediaPage {
  title: string;
  extract: string;
  description?: string;
  content_urls?: {
    desktop?: { page?: string };
  };
}

const wikipediaAdapter: Adapter = {
  name: "wikipedia",
  description: "Wikipedia articles via REST API (free, no deps)",
  priority: 85,
  patterns: [
    /wikipedia\.org\/wiki\//,
    /wikipedia\.org\/w\/index\.php\?title=/,
  ],
  dependencies: [],

  async fetch(url: string, options?: AdapterOptions): Promise<FetchResult> {
    const { lang, title } = parseWikipediaUrl(url);
    if (!title) {
      throw new Error(`Cannot parse Wikipedia article title from URL: ${url}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options?.timeout ?? 15_000,
    );

    try {
      const apiUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const response = await fetch(apiUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": "agent-web/0.1.0 (https://github.com/lalawgwg99/agent-web)",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Wikipedia API returned ${response.status}`);
      }

      const data = (await response.json()) as WikipediaPage;

      let content = [
        `# ${data.title}`,
        data.description ? `*${data.description}*` : "",
        "",
        data.extract ?? "",
      ]
        .filter(Boolean)
        .join("\n");

      if (options?.maxLength && content.length > options.maxLength) {
        content = content.slice(0, options.maxLength) + "\n\n...(truncated)";
      }

      return {
        url,
        platform: "wikipedia",
        content,
        metadata: {
          title: data.title,
          description: data.description,
          lang,
        },
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
        const res = await fetch(
          "https://en.wikipedia.org/api/rest_v1/page/summary/Main_Page",
          { signal: controller.signal },
        );
        return {
          name: "wikipedia",
          installed: true,
          configured: res.ok,
        };
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return {
        name: "wikipedia",
        installed: true,
        configured: false,
        error: "Network unreachable",
      };
    }
  },
};

function parseWikipediaUrl(url: string): { lang: string; title: string | null } {
  try {
    const parsed = new URL(url);
    const lang = parsed.hostname.split(".")[0] ?? "en";

    // /wiki/Article_Title
    const wikiMatch = parsed.pathname.match(/^\/wiki\/(.+)/);
    if (wikiMatch) {
      return { lang, title: decodeURIComponent(wikiMatch[1]!) };
    }

    // /w/index.php?title=Article_Title
    const titleParam = parsed.searchParams.get("title");
    if (titleParam) {
      return { lang, title: decodeURIComponent(titleParam) };
    }

    return { lang, title: null };
  } catch {
    return { lang: "en", title: null };
  }
}

export default wikipediaAdapter;
