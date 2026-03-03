import type { Command } from "commander";
import { Router } from "../../core/router.js";
import { formatFetchResult, formatError } from "../formatter.js";

export function registerFetchCommand(program: Command): void {
  program
    .command("fetch <url>")
    .description("Smart-fetch content from any URL")
    .option("--json", "Output as JSON", false)
    .option("--adapter <name>", "Force specific adapter")
    .option("--max-length <n>", "Max content length", parseInt)
    .option("--lang <code>", "Preferred language")
    .option("--timeout <ms>", "Timeout in milliseconds", parseInt)
    .action(async (url: string, opts) => {
      try {
        const router = new Router();
        const options = {
          maxLength: opts.maxLength as number | undefined,
          lang: opts.lang as string | undefined,
          timeout: opts.timeout as number | undefined,
        };

        const result = opts.adapter
          ? await router.fetchWith(opts.adapter as string, url, options)
          : await router.fetch(url, options);

        console.log(formatFetchResult(result, opts.json as boolean));
      } catch (err) {
        console.error(formatError(err));
        process.exit(1);
      }
    });
}
