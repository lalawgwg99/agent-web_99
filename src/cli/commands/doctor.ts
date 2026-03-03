import type { Command } from "commander";
import { runDoctor, formatDoctorReport } from "../../core/doctor.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Check all adapters and dependencies")
    .action(async () => {
      const report = await runDoctor();
      console.log(formatDoctorReport(report));
    });
}
