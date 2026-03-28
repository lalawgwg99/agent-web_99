import type {
  Adapter,
  FetchResult,
  AdapterHealth,
  AdapterOptions,
} from "./types.js";
import { exec, commandExists } from "../utils/exec.js";
import { estimateTokens } from "../utils/tokens.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/**
 * Parse a WebVTT subtitle string into plain readable text.
 * Strips timestamps, cue headers, VTT tags and deduplicates adjacent identical lines.
 */
function parseVtt(vtt: string): string {
  const lines = vtt.split("\n");
  const textLines: string[] = [];
  let prevLine = "";

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip WEBVTT header, empty lines, NOTE/STYLE blocks, and timestamp lines
    if (
      !trimmed ||
      trimmed === "WEBVTT" ||
      trimmed.startsWith("NOTE") ||
      trimmed.startsWith("STYLE") ||
      /^\d{2}:\d{2}/.test(trimmed) ||
      /-->/.test(trimmed)
    ) {
      continue;
    }

    // Strip VTT inline tags: <c>, </c>, <00:00:00.000>, <b>, etc.
    const clean = trimmed
      .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, "")
      .replace(/<[^>]+>/g, "")
      .trim();

    // Deduplicate consecutive identical lines (common in auto-generated captions)
    if (clean && clean !== prevLine) {
      textLines.push(clean);
      prevLine = clean;
    }
  }

  return textLines.join(" ");
}

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
    const lang = options?.lang ?? "en";

    // Temp directory to receive the .vtt subtitle file
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "yt-sub-"));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let meta: Record<string, any>;
    let transcript = "(No transcript available)";

    try {
      // Single yt-dlp invocation: --dump-json writes metadata JSON to stdout
      // while --write-auto-sub writes the .vtt file to tmpDir
      const metaJson = await exec(
        "yt-dlp",
        [
          "--dump-json",
          "--write-auto-sub",
          "--sub-lang", lang,
          "--skip-download",
          "--sub-format", "vtt",
          "--output", path.join(tmpDir, "%(id)s"),
          url,
        ],
        { timeout },
      );
      meta = JSON.parse(metaJson);

      // Read the generated .vtt file (yt-dlp names it <id>.<lang>.vtt)
      try {
        const files = await fs.readdir(tmpDir);
        const vttFile = files.find((f) => f.endsWith(".vtt"));
        if (vttFile) {
          const vttContent = await fs.readFile(
            path.join(tmpDir, vttFile),
            "utf-8",
          );
          const parsed = parseVtt(vttContent);
          if (parsed.trim()) {
            transcript = parsed;
          }
        }
      } catch {
        // Subtitles unavailable for this video — keep default message
      }
    } finally {
      // Always clean up the temp directory
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => void 0);
    }

    const durationSecs = meta["duration"] as number | undefined;
    const duration = durationSecs
      ? `${Math.floor(durationSecs / 60)}:${String(durationSecs % 60).padStart(2, "0")}`
      : "unknown";

    const content = [
      `# ${meta["title"] as string}`,
      "",
      `**Channel:** ${(meta["channel"] ?? meta["uploader"] ?? "unknown") as string}`,
      `**Duration:** ${duration}`,
      `**Views:** ${((meta["view_count"] as number | undefined)?.toLocaleString() ?? "unknown")}`,
      `**Published:** ${(meta["upload_date"] ?? "unknown") as string}`,
      "",
      "## Description",
      ((meta["description"] as string | undefined) ?? "").slice(0, 2000),
      "",
      "## Transcript",
      transcript,
    ].join("\n");

    return {
      url,
      platform: "youtube",
      content,
      metadata: {
        title: meta["title"],
        channel: meta["channel"] ?? meta["uploader"],
        duration: meta["duration"],
        viewCount: meta["view_count"],
        uploadDate: meta["upload_date"],
        thumbnailUrl: meta["thumbnail"],
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
