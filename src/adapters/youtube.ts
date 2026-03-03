import type {
  Adapter,
  FetchResult,
  AdapterHealth,
  AdapterOptions,
} from "./types.js";
import { exec, commandExists } from "../utils/exec.js";
import { estimateTokens } from "../utils/tokens.js";

/**
 * YouTube adapter — 透過 yt-dlp 取得影片資訊與字幕
 */
const youtubeAdapter: Adapter = {
  name: "youtube",
  description: "YouTube videos via yt-dlp (metadata + subtitles)",
  priority: 100,
  patterns: [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[\w-]+/,
  ],
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

    // 取得影片 metadata
    const metaJson = await exec(
      "yt-dlp",
      ["--dump-json", "--no-download", url],
      { timeout },
    );
    const meta = JSON.parse(metaJson);

    // 嘗試取得字幕
    let transcript = "(No transcript available)";
    try {
      const lang = options?.lang ?? "en";
      const subResult = await exec(
        "yt-dlp",
        [
          "--write-auto-sub",
          "--sub-lang",
          lang,
          "--skip-download",
          "--sub-format",
          "vtt",
          "--print",
          "%(requested_subtitles)j",
          url,
        ],
        { timeout },
      );
      if (subResult.trim() !== "null" && subResult.trim() !== "NA") {
        transcript = subResult.trim();
      }
    } catch {
      // 字幕不可用，保持預設值
    }

    const duration = meta.duration
      ? `${Math.floor(meta.duration / 60)}:${String(meta.duration % 60).padStart(2, "0")}`
      : "unknown";

    const content = [
      `# ${meta.title}`,
      "",
      `**Channel:** ${meta.channel ?? meta.uploader ?? "unknown"}`,
      `**Duration:** ${duration}`,
      `**Views:** ${meta.view_count?.toLocaleString() ?? "unknown"}`,
      `**Published:** ${meta.upload_date ?? "unknown"}`,
      "",
      "## Description",
      (meta.description ?? "").slice(0, 2000),
      "",
      "## Transcript",
      transcript,
    ].join("\n");

    return {
      url,
      platform: "youtube",
      content,
      metadata: {
        title: meta.title,
        channel: meta.channel ?? meta.uploader,
        duration: meta.duration,
        viewCount: meta.view_count,
        uploadDate: meta.upload_date,
        thumbnailUrl: meta.thumbnail,
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
        name: "youtube",
        installed: false,
        configured: false,
        installHint: "brew install yt-dlp",
      };
    }

    try {
      const version = (await exec("yt-dlp", ["--version"])).trim();
      return { name: "youtube", installed: true, configured: true, version };
    } catch {
      return { name: "youtube", installed: true, configured: true };
    }
  },
};

export default youtubeAdapter;
