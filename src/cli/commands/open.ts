import type { Command } from "commander";
import { getSession } from "../../browser/manager.js";
import { takeSnapshot } from "../../browser/snapshot.js";
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
    .action(async (url: string, opts) => {
      try {
        const config = loadConfig();
        if (!isDomainAllowed(url, config.browser.allowedDomains)) {
          console.error(`Error: Domain not in allowlist`);
          process.exit(1);
        }

        const session = await getSession(opts.session as string, {
          headed: opts.headed as boolean,
        });

        await session.page.goto(url, { waitUntil: "domcontentloaded" });

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
