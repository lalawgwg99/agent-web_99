import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AdapterHealth } from "../adapters/types.js";
import { AdapterRegistry, loadBuiltinAdapters } from "../adapters/registry.js";

// Read version dynamically from package.json to stay in sync with releases
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../package.json"), "utf-8"),
) as { version: string };
const agentVersion = pkg.version;

export interface DoctorReport {
  nodeVersion: string;
  adapters: AdapterHealth[];
  readyCount: number;
  totalCount: number;
}

/**
 * 執行全面診斷
 */
export async function runDoctor(): Promise<DoctorReport> {
  const registry = new AdapterRegistry();
  await loadBuiltinAdapters(registry);

  const adapters = registry.getAll();
  const healthChecks = await Promise.all(
    adapters.map((adapter) =>
      adapter.check().catch(
        (err): AdapterHealth => ({
          name: adapter.name,
          installed: false,
          configured: false,
          error: (err as Error).message,
        }),
      ),
    ),
  );

  const readyCount = healthChecks.filter(
    (h) => h.installed && h.configured,
  ).length;

  return {
    nodeVersion: process.version,
    adapters: healthChecks,
    readyCount,
    totalCount: healthChecks.length,
  };
}

/**
 * 格式化診斷報告
 */
export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];

  lines.push(`agent-web v${agentVersion} Diagnostics`);
  lines.push("=".repeat(35));
  lines.push("");
  lines.push("Core:");
  lines.push(`  ✅ Node.js     ${report.nodeVersion}`);
  lines.push("");
  lines.push("Adapters:");

  for (const adapter of report.adapters) {
    if (adapter.installed && adapter.configured) {
      const ver = adapter.version ? ` (${adapter.version})` : "";
      lines.push(`  ✅ ${adapter.name.padEnd(14)}ready${ver}`);
    } else if (adapter.installed) {
      lines.push(`  ⚠️  ${adapter.name.padEnd(14)}not configured`);
      if (adapter.error) {
        lines.push(`     → ${adapter.error}`);
      }
    } else {
      lines.push(`  ❌ ${adapter.name.padEnd(14)}not installed`);
      if (adapter.installHint) {
        lines.push(`     → Install: ${adapter.installHint}`);
      }
    }
  }

  lines.push("");
  lines.push(`Summary: ${report.readyCount}/${report.totalCount} adapters ready`);

  return lines.join("\n");
}
