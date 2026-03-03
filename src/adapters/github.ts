import type {
  Adapter,
  FetchResult,
  AdapterHealth,
  AdapterOptions,
} from "./types.js";
import { exec, commandExists } from "../utils/exec.js";
import { estimateTokens } from "../utils/tokens.js";

/**
 * GitHub adapter — 透過 gh CLI 取得 repo/issue/PR 資訊
 */
const githubAdapter: Adapter = {
  name: "github",
  description: "GitHub repos, issues, PRs via gh CLI",
  priority: 90,
  patterns: [/github\.com\/[\w-]+\/[\w.-]+/],
  dependencies: [
    {
      name: "gh",
      type: "binary",
      required: true,
      installCmd: "brew install gh",
      checkCmd: "gh --version",
    },
  ],

  async fetch(url: string, options?: AdapterOptions): Promise<FetchResult> {
    const timeout = options?.timeout ?? 30_000;

    // 解析 URL 類型
    const issueMatch = url.match(
      /github\.com\/([\w-]+)\/([\w.-]+)\/issues\/(\d+)/,
    );
    const prMatch = url.match(
      /github\.com\/([\w-]+)\/([\w.-]+)\/pull\/(\d+)/,
    );
    const repoMatch = url.match(/github\.com\/([\w-]+)\/([\w.-]+)/);

    let content: string;
    let contentType: "repo" | "post" | "thread" = "repo";

    if (issueMatch) {
      const [, owner, repo, num] = issueMatch;
      const raw = await exec(
        "gh",
        ["issue", "view", num!, "--repo", `${owner}/${repo}`, "--json",
          "title,body,state,author,labels,comments"],
        { timeout },
      );
      const issue = JSON.parse(raw);
      content = [
        `# Issue #${num}: ${issue.title}`,
        `**State:** ${issue.state} | **Author:** ${issue.author?.login ?? "unknown"}`,
        `**Labels:** ${(issue.labels ?? []).map((l: { name: string }) => l.name).join(", ") || "none"}`,
        "",
        issue.body ?? "(no description)",
        "",
        `## Comments (${(issue.comments ?? []).length})`,
        ...(issue.comments ?? []).map(
          (c: { author?: { login?: string }; body?: string }) =>
            `**${c.author?.login ?? "unknown"}:** ${c.body ?? ""}`,
        ),
      ].join("\n");
      contentType = "post";
    } else if (prMatch) {
      const [, owner, repo, num] = prMatch;
      const raw = await exec(
        "gh",
        ["pr", "view", num!, "--repo", `${owner}/${repo}`, "--json",
          "title,body,state,author,additions,deletions,files"],
        { timeout },
      );
      const pr = JSON.parse(raw);
      content = [
        `# PR #${num}: ${pr.title}`,
        `**State:** ${pr.state} | **Author:** ${pr.author?.login ?? "unknown"}`,
        `**Changes:** +${pr.additions ?? 0} -${pr.deletions ?? 0} (${(pr.files ?? []).length} files)`,
        "",
        pr.body ?? "(no description)",
      ].join("\n");
      contentType = "post";
    } else if (repoMatch) {
      const [, owner, repo] = repoMatch;
      const raw = await exec(
        "gh",
        ["repo", "view", `${owner}/${repo}`, "--json",
          "name,description,stargazerCount,forkCount,primaryLanguage,defaultBranchRef,licenseInfo"],
        { timeout },
      );
      const r = JSON.parse(raw);

      // 嘗試取得 README
      let readme = "";
      try {
        readme = await exec(
          "gh",
          ["api", `repos/${owner}/${repo}/readme`, "--jq", ".content"],
          { timeout },
        );
        readme = Buffer.from(readme.trim(), "base64").toString("utf-8");
        if (options?.maxLength && readme.length > options.maxLength) {
          readme = readme.slice(0, options.maxLength) + "\n\n...(truncated)";
        }
      } catch {
        readme = "(README not available)";
      }

      content = [
        `# ${r.name}`,
        r.description ?? "",
        "",
        `**Stars:** ${r.stargazerCount ?? 0} | **Forks:** ${r.forkCount ?? 0}`,
        `**Language:** ${r.primaryLanguage?.name ?? "unknown"}`,
        `**License:** ${r.licenseInfo?.name ?? "unknown"}`,
        "",
        "## README",
        readme,
      ].join("\n");
    } else {
      content = `Unable to parse GitHub URL: ${url}`;
    }

    return {
      url,
      platform: "github",
      content,
      metadata: { source: "gh-cli" },
      contentType,
      fetchedAt: new Date().toISOString(),
      tokenEstimate: estimateTokens(content),
    };
  },

  async check(): Promise<AdapterHealth> {
    const exists = await commandExists("gh");
    if (!exists) {
      return {
        name: "github",
        installed: false,
        configured: false,
        installHint: "brew install gh && gh auth login",
      };
    }

    try {
      const version = (await exec("gh", ["--version"])).trim().split("\n")[0] ?? "";
      // 檢查是否已登入
      await exec("gh", ["auth", "status"]);
      return { name: "github", installed: true, configured: true, version };
    } catch {
      return {
        name: "github",
        installed: true,
        configured: false,
        error: "Not authenticated",
        installHint: "gh auth login",
      };
    }
  },
};

export default githubAdapter;
