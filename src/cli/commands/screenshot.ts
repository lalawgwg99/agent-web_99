import type { Command } from "commander";
import path from "node:path";
import { getSession, hasSession } from "../../browser/manager.js";
import { formatError } from "../formatter.js";

export function registerScreenshotCommand(program: Command): void {
  program
    .command("screenshot [filename]")
    .description("Take screenshot of current page")
    .option("--full", "Full page screenshot")
    .option("--session <name>", "Named session", "default")
    .action(async (filename: string | undefined, opts) => {
      try {
        const sessionName = opts.session as string;
        if (!hasSession(sessionName)) {
          console.error("Error: No browser open. Run `agent-web open <url>` first.");
          process.exit(1);
        }

        const session = await getSession(sessionName);
        const outputPath = filename ?? `screenshot-${Date.now()}.png`;
        const fullPath = path.resolve(outputPath);

        await session.page.screenshot({
          path: fullPath,
          fullPage: opts.full as boolean,
        });

        console.log(`Screenshot saved: ${fullPath}`);
      } catch (err) {
        console.error(formatError(err));
        process.exit(1);
      }
    });
}
