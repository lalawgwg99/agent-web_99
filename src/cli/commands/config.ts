import type { Command } from "commander";
import { getConfigValue, setConfigValue, getConfigPath } from "../../core/config.js";

export function registerConfigCommand(program: Command): void {
  const config = program
    .command("config")
    .description("Manage configuration");

  config
    .command("get <key>")
    .description("Get a config value (dot notation)")
    .action((key: string) => {
      const value = getConfigValue(key);
      if (value === undefined) {
        console.log("(not set)");
      } else if (typeof value === "object") {
        console.log(JSON.stringify(value, null, 2));
      } else {
        console.log(String(value));
      }
    });

  config
    .command("set <key> <value>")
    .description("Set a config value (dot notation)")
    .action((key: string, value: string) => {
      setConfigValue(key, value);
      console.log(`Set ${key} = ${value}`);
    });

  config
    .command("path")
    .description("Show config file path")
    .action(() => {
      console.log(getConfigPath());
    });
}
