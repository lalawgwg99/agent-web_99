import type { Command } from "commander";
import { getSession, hasSession } from "../../browser/manager.js";
import { performAction, type ActionType } from "../../browser/actions.js";
import { globalRefMap } from "./open.js";
import { formatError } from "../formatter.js";

function requireSession(name: string): void {
  if (!hasSession(name)) {
    console.error("Error: No browser open. Run `agent-web open <url>` first.");
    process.exit(1);
  }
}

export function registerActionCommands(program: Command): void {
  // click @e1
  program
    .command("click <ref>")
    .description("Click element (e.g. @e1)")
    .option("--session <name>", "Named session", "default")
    .action(async (ref: string, opts) => {
      try {
        const sessionName = opts.session as string;
        requireSession(sessionName);
        const session = await getSession(sessionName);
        const result = await performAction({
          action: "click",
          ref,
          session,
          refMap: globalRefMap,
        });
        console.log(result);
      } catch (err) {
        console.error(formatError(err));
        process.exit(1);
      }
    });

  // fill @e1 "text"
  program
    .command("fill <ref> <text>")
    .description("Fill text into element (e.g. @e2 \"hello\")")
    .option("--session <name>", "Named session", "default")
    .action(async (ref: string, text: string, opts) => {
      try {
        const sessionName = opts.session as string;
        requireSession(sessionName);
        const session = await getSession(sessionName);
        const result = await performAction({
          action: "fill",
          ref,
          value: text,
          session,
          refMap: globalRefMap,
        });
        console.log(result);
      } catch (err) {
        console.error(formatError(err));
        process.exit(1);
      }
    });

  // select @e1 "value"
  program
    .command("select <ref> <value>")
    .description("Select dropdown option")
    .option("--session <name>", "Named session", "default")
    .action(async (ref: string, value: string, opts) => {
      try {
        const sessionName = opts.session as string;
        requireSession(sessionName);
        const session = await getSession(sessionName);
        const result = await performAction({
          action: "select",
          ref,
          value,
          session,
          refMap: globalRefMap,
        });
        console.log(result);
      } catch (err) {
        console.error(formatError(err));
        process.exit(1);
      }
    });

  // scroll [direction]
  program
    .command("scroll [direction]")
    .description("Scroll page (up/down/left/right)")
    .option("--session <name>", "Named session", "default")
    .action(async (direction: string | undefined, opts) => {
      try {
        const sessionName = opts.session as string;
        requireSession(sessionName);
        const session = await getSession(sessionName);
        const result = await performAction({
          action: "scroll",
          value: direction ?? "down",
          session,
          refMap: globalRefMap,
        });
        console.log(result);
      } catch (err) {
        console.error(formatError(err));
        process.exit(1);
      }
    });

  // press <key>
  program
    .command("press <key>")
    .description("Press keyboard key (e.g. Enter, Tab)")
    .option("--session <name>", "Named session", "default")
    .action(async (key: string, opts) => {
      try {
        const sessionName = opts.session as string;
        requireSession(sessionName);
        const session = await getSession(sessionName);
        const result = await performAction({
          action: "press" as ActionType,
          value: key,
          session,
          refMap: globalRefMap,
        });
        console.log(result);
      } catch (err) {
        console.error(formatError(err));
        process.exit(1);
      }
    });
}
