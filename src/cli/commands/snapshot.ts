import type { Command } from "commander";
import { getSession, hasSession } from "../../browser/manager.js";
import { takeSnapshot } from "../../browser/snapshot.js";
import { globalRefMap } from "./open.js";
import { formatError } from "../formatter.js";

export function registerSnapshotCommand(program: Command): void {
  program
    .command("snapshot")
    .description("Get element tree with @refs")
    .option("-i, --interactive", "Interactive elements only (default)", true)
    .option("-a, --all", "Include all elements")
    .option("--session <name>", "Named session", "default")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const sessionName = opts.session as string;
        if (!hasSession(sessionName)) {
          console.error("Error: No browser open. Run `agent-web open <url>` first.");
          process.exit(1);
        }

        const session = await getSession(sessionName);
        const snapshot = await takeSnapshot(session.page, globalRefMap, {
          interactiveOnly: !opts.all,
        });

        if (opts.json) {
          console.log(JSON.stringify(snapshot, null, 2));
        } else {
          console.log(`Page: ${snapshot.title}`);
          console.log(`Refs: ${snapshot.refCount} elements`);
          console.log("");
          console.log(snapshot.text);
        }
      } catch (err) {
        console.error(formatError(err));
        process.exit(1);
      }
    });
}
