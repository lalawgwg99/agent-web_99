import { loadConfig } from "../core/config.js";

/**
 * Playwright 瀏覽器生命週期管理
 * Lazy install：首次使用時才安裝 Playwright + Chromium
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PlaywrightModule = any;

let playwrightModule: PlaywrightModule | null = null;

async function getPlaywright(): Promise<PlaywrightModule> {
  if (playwrightModule) return playwrightModule;

  try {
    playwrightModule = await import("playwright");
    return playwrightModule;
  } catch {
    throw new Error(
      "Playwright is not installed.\n" +
        "Run: npm install -g playwright && npx playwright install chromium",
    );
  }
}

export interface BrowserSession {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browser: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any;
}

const sessions = new Map<string, BrowserSession>();

/**
 * 取得或建立瀏覽器 session
 */
export async function getSession(
  name = "default",
  options?: { headless?: boolean; headed?: boolean },
): Promise<BrowserSession> {
  const existing = sessions.get(name);
  if (existing) return existing;

  const pw = await getPlaywright();
  const config = loadConfig();

  const headless = options?.headed ? false : (options?.headless ?? config.browser.headless);

  const browser = await pw.chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: config.browser.viewport,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(config.browser.defaultTimeout);

  const session: BrowserSession = { browser, context, page };
  sessions.set(name, session);
  return session;
}

/**
 * 關閉瀏覽器 session
 */
export async function closeSession(name = "default"): Promise<void> {
  const session = sessions.get(name);
  if (!session) return;

  await session.browser.close();
  sessions.delete(name);
}

/**
 * 關閉所有 sessions
 */
export async function closeAllSessions(): Promise<void> {
  for (const [name] of sessions) {
    await closeSession(name);
  }
}

/**
 * 檢查是否有活躍 session
 */
export function hasSession(name = "default"): boolean {
  return sessions.has(name);
}
