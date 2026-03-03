import type { DependencySpec } from "../adapters/types.js";
import { exec, commandExists } from "./exec.js";

export interface DepCheckResult {
  name: string;
  available: boolean;
  version?: string;
  installCmd: string;
}

/**
 * 檢查單一依賴是否可用
 */
export async function checkDependency(
  dep: DependencySpec,
): Promise<DepCheckResult> {
  if (dep.type === "binary") {
    const exists = await commandExists(dep.name);
    if (!exists) {
      return {
        name: dep.name,
        available: false,
        installCmd: dep.installCmd,
      };
    }
    try {
      const version = (await exec(dep.name, ["--version"])).trim();
      return { name: dep.name, available: true, version, installCmd: dep.installCmd };
    } catch {
      return { name: dep.name, available: true, installCmd: dep.installCmd };
    }
  }

  return { name: dep.name, available: false, installCmd: dep.installCmd };
}
