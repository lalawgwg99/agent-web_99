import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ExecOptions {
  timeout?: number;
  cwd?: string;
  env?: Record<string, string>;
}

/**
 * 執行外部命令，回傳 stdout
 */
export async function exec(
  command: string,
  args: string[] = [],
  options: ExecOptions = {},
): Promise<string> {
  const { stdout } = await execFileAsync(command, args, {
    timeout: options.timeout ?? 30_000,
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

/**
 * 檢查命令是否存在（Windows 用 'where'，其他平台用 'which'）
 */
export async function commandExists(command: string): Promise<boolean> {
  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    await execFileAsync(cmd, [command]);
    return true;
  } catch {
    return false;
  }
}
