import type { Command } from "commander";
import { getSession } from "../../browser/manager.js";
import { takeSnapshot } from "../../browser/snapshot.js";
import { extractReadableContent } from "../../browser/readability.js";
import { RefMap } from "../../browser/ref-map.js";
import { isDomainAllowed } from "../../browser/security.js";
import { loadConfig } from "../../core/config.js";
import { formatError } from "../formatter.js";

// 全域共享 refMap（同一 CLI session 內）
export const globalRefMap = new RefMap();

export function registerOpenCommand(program: Command): void {
  program
    .command("open <url>")
    .description("Open URL in browser, returns snapshot with @refs")
    .option("--headed", "Show browser window")
    .option("--session <name>", "Named session", "default")
    .option("--cdp <url>", "Connect via CDP WebSocket URL (e.g. ws://localhost:9222)")
    .option("--cdp-port <port>", "Connect via CDP port (auto-discovers WebSocket URL)", parseInt)
    .option("--no-block", "Disable resource blocking (load images, fonts, etc.)")
    .option("--readable", "Extract clean article text instead of ARIA snapshot")
    .action(async (url: string, opts) => {
      try {
        const config = loadConfig();
        if (!isDomainAllowed(url, config.browser.allowedDomains)) {
          console.error(`Error: Domain not in allowlist`);
          process.exit(1);
        }

        const session = await getSession(opts.session as string, {
          headed: opts.headed as boolean,
          cdp: opts.cdp as string | undefined,
          cdpPort: opts.cdpPort as number | undefined,
          blockResources: opts.block as boolean,
        });

        await session.page.goto(url, { waitUntil: "domcontentloaded" });

        if (opts.readable) {
          const article = await extractReadableContent(session.page);
          if (!article) {
            console.error("Readability could not extract article content from this page.");
            process.exit(1);
          }
          console.log(`Page: ${article.title}`);
          console.log(`URL: ${article.url}`);
          console.log(`Tokens: ~${article.tokenEstimate}`);
          if (article.byline) console.log(`Author: ${article.byline}`);
          console.log("");
          console.log(article.content);
          return;
        }

        const snapshot = await takeSnapshot(session.page, globalRefMap, {
          interactiveOnly: true,
        });

        console.log(`Page: ${snapshot.title}`);
        console.log(`URL: ${snapshot.url}`);
        console.log(`Refs: ${snapshot.refCount} interactive elements`);
        console.log("");
        console.log(snapshot.text);
      } catch (err) {
        console.error(formatError(err));
        process.exit(1);
      }
    });

  program
    .command("close")
    .description("Close browser session")
    .option("--session <name>", "Named session", "default")
    .action(async (opts) => {
      const { closeSession } = await import("../../browser/manager.js");
      await closeSession(opts.session as string);
      console.log("Browser closed");
    });
}
