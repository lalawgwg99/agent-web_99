import type {
  Adapter,
  FetchResult,
  AdapterHealth,
  AdapterOptions,
} from "./types.js";
import { exec, commandExists } from "../utils/exec.js";
import { estimateTokens } from "../utils/tokens.js";

/**
 * Bilibili adapter — 透過 yt-dlp 取得影片資訊
 */
const bilibiliAdapter: Adapter = {
  name: "bilibili",
  description: "Bilibili videos via yt-dlp",
  priority: 80,
  patterns: [/bilibili\.com\/video\/BV[\w]+/, /b23\.tv\/[\w]+/],
  dependencies: [
    {
      name: "yt-dlp",
      type: "binary",
      required: true,
      installCmd: "brew install yt-dlp",
      checkCmd: "yt-dlp --version",
    },
  ],

  async fetch(url: string, options?: AdapterOptions): Promise<FetchResult> {
    const timeout = options?.timeout ?? 30_000;

    const metaJson = await exec(
      "yt-dlp",
      ["--dump-json", "--no-download", url],
      { timeout },
    );
    const meta = JSON.parse(metaJson);

    const duration = meta.duration
      ? `${Math.floor(meta.duration / 60)}:${String(meta.duration % 60).padStart(2, "0")}`
      : "unknown";

    const content = [
      `# ${meta.title ?? "Unknown"}`,
      "",
      `**UP主:** ${meta.uploader ?? "unknown"}`,
      `**Duration:** ${duration}`,
      `**Views:** ${meta.view_count?.toLocaleString() ?? "unknown"}`,
      "",
      "## Description",
      (meta.description ?? "").slice(0, 2000),
    ].join("\n");

    return {
      url,
      platform: "bilibili",
      content,
      metadata: {
        title: meta.title,
        uploader: meta.uploader,
        duration: meta.duration,
        viewCount: meta.view_count,
      },
      contentType: "video",
      fetchedAt: new Date().toISOString(),
      tokenEstimate: estimateTokens(content),
    };
  },

  async check(): Promise<AdapterHealth> {
    const exists = await commandExists("yt-dlp");
    if (!exists) {
      return {
        name: "bilibili",
        installed: false,
        configured: false,
        installHint: "brew install yt-dlp",
      };
    }
    return { name: "bilibili", installed: true, configured: true };
  },
};

export default bilibiliAdapter;
