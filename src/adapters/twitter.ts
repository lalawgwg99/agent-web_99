import type {
  Adapter,
  FetchResult,
  AdapterHealth,
  AdapterOptions,
} from "./types.js";
import { exec, commandExists } from "../utils/exec.js";
import { estimateTokens } from "../utils/tokens.js";

/**
 * Twitter/X adapter — 透過 xreach CLI 抓取推文
 */
const twitterAdapter: Adapter = {
  name: "twitter",
  description: "Twitter/X posts via xreach CLI",
  priority: 100,
  patterns: [
    /(?:twitter\.com|x\.com)\/\w+\/status\/\d+/,
    /(?:twitter\.com|x\.com)\/\w+$/,
  ],
  dependencies: [
    {
      name: "xreach",
      type: "binary",
      required: true,
      installCmd: "npm install -g xreach",
      checkCmd: "xreach --version",
    },
  ],

  async fetch(url: string, options?: AdapterOptions): Promise<FetchResult> {
    const timeout = options?.timeout ?? 30_000;

    // 判斷是單一推文還是用戶頁面
    const statusMatch = url.match(/status\/(\d+)/);

    let rawOutput: string;
    if (statusMatch) {
      rawOutput = await exec(
        "xreach",
        ["tweet", statusMatch[1]!, "--json"],
        { timeout },
      );
    } else {
      const userMatch = url.match(/(?:twitter\.com|x\.com)\/(\w+)/);
      const username = userMatch?.[1] ?? "";
      rawOutput = await exec(
        "xreach",
        ["search", `from:${username}`, "--json", "--limit", "20"],
        { timeout },
      );
    }

    let content: string;
    try {
      const data = JSON.parse(rawOutput);
      if (Array.isArray(data)) {
        content = data
          .map(
            (tweet: { user?: { name?: string }; text?: string; created_at?: string }) =>
              `**${tweet.user?.name ?? "unknown"}** (${tweet.created_at ?? ""})\n${tweet.text ?? ""}\n`,
          )
          .join("\n---\n\n");
      } else {
        content = `**${data.user?.name ?? "unknown"}** (${data.created_at ?? ""})\n${data.text ?? rawOutput}`;
      }
    } catch {
      content = rawOutput;
    }

    return {
      url,
      platform: "twitter",
      content,
      metadata: { source: "xreach" },
      contentType: statusMatch ? "post" : "thread",
      fetchedAt: new Date().toISOString(),
      tokenEstimate: estimateTokens(content),
    };
  },

  async check(): Promise<AdapterHealth> {
    const exists = await commandExists("xreach");
    if (!exists) {
      return {
        name: "twitter",
        installed: false,
        configured: false,
        installHint: "npm install -g xreach",
      };
    }

    try {
      const version = (await exec("xreach", ["--version"])).trim();
      return { name: "twitter", installed: true, configured: true, version };
    } catch {
      return { name: "twitter", installed: true, configured: true };
    }
  },
};

export default twitterAdapter;
