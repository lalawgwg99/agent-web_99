import { Command } from "commander";
import { registerFetchCommand } from "./commands/fetch.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerConfigCommand } from "./commands/config.js";
import { registerOpenCommand } from "./commands/open.js";
import { registerSnapshotCommand } from "./commands/snapshot.js";
import { registerActionCommands } from "./commands/action.js";
import { registerScreenshotCommand } from "./commands/screenshot.js";

export function createCli(): Command {
  const program = new Command();

  program
    .name("agent-web")
    .description(
      "Unified web content fetching and browser automation for AI agents",
    )
    .version("0.1.0");

  // 內容抓取
  registerFetchCommand(program);

  // 瀏覽器操作
  registerOpenCommand(program);
  registerSnapshotCommand(program);
  registerActionCommands(program);
  registerScreenshotCommand(program);

  // 設定與診斷
  registerDoctorCommand(program);
  registerConfigCommand(program);

  // MCP Server 模式
  program
    .command("serve")
    .description("Start as MCP server (STDIO transport)")
    .action(async () => {
      const { startServer } = await import("../mcp/server.js");
      await startServer();
    });

  return program;
}

export async function run(): Promise<void> {
  const program = createCli();
  await program.parseAsync(process.argv);
}
