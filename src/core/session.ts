import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SESSION_DIR = path.join(os.homedir(), ".agent-web", "sessions");

/**
 * 儲存 cookie 到磁碟
 */
export async function saveCookies(
  sessionName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
): Promise<void> {
  const dir = path.join(SESSION_DIR, sessionName);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

  const cookies = await context.cookies();
  const filePath = path.join(dir, "cookies.json");
  fs.writeFileSync(filePath, JSON.stringify(cookies, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

/**
 * 從磁碟載入 cookie
 */
export async function loadCookies(
  sessionName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
): Promise<boolean> {
  const filePath = path.join(SESSION_DIR, sessionName, "cookies.json");
  if (!fs.existsSync(filePath)) return false;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const cookies = JSON.parse(raw);
    await context.addCookies(cookies);
    return true;
  } catch {
    return false;
  }
}

/**
 * 列出所有已儲存的 sessions
 */
export function listSessions(): string[] {
  if (!fs.existsSync(SESSION_DIR)) return [];
  return fs.readdirSync(SESSION_DIR).filter((name) => {
    const stat = fs.statSync(path.join(SESSION_DIR, name));
    return stat.isDirectory();
  });
}
