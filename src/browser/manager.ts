import { type AgentWebConfig, loadConfig } from "../core/config.js";

/**
 * Playwright 瀏覽器生命週期管理
 * 支援：standalone launch / CDP 連接已開啟的 Chrome
 * 支援：resource blocking（預設攔截 image/font/media）
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
  isCDP: boolean;
}

export interface SessionOptions {
  headless?: boolean;
  headed?: boolean;
  cdp?: string;
  cdpPort?: number;
  blockResources?: boolean;
}

const sessions = new Map<string, BrowserSession>();

// ─── CDP Endpoint Discovery ─────────────────────────────────

async function resolveCdpEndpoint(
  config: AgentWebConfig,
  overridePort?: number,
): Promise<string | undefined> {
  // 1. env var (highest priority)
  const envUrl = process.env["AGENT_WEB_CDP_URL"];
  if (envUrl) return envUrl;

  // 2. config url
  if (config.browser.cdp?.url) return config.browser.cdp.url;

  // 3. config port or override → auto-discover
  const port = overridePort ?? config.browser.cdp?.port;
  if (port) {
    return discoverCdpEndpoint(port);
  }

  return undefined;
}

async function discoverCdpEndpoint(port: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);

  try {
    const res = await fetch(`http://localhost:${port}/json/version`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { webSocketDebuggerUrl?: string };
    if (!data.webSocketDebuggerUrl) {
      throw new Error("No webSocketDebuggerUrl in response");
    }
    return data.webSocketDebuggerUrl;
  } catch (err) {
    throw new Error(
      `Cannot discover CDP endpoint on port ${port}: ${(err as Error).message}\n` +
        `Make sure Chrome is running with: --remote-debugging-port=${port}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Browser Launch / Connect ────────────────────────────────

async function connectViaCDP(
  pw: PlaywrightModule,
  wsEndpoint: string,
  config: AgentWebConfig,
): Promise<BrowserSession> {
  const browser = await pw.chromium.connectOverCDP(wsEndpoint);

  // Use the default context (preserves user's cookies/login state)
  const contexts = browser.contexts();
  const context =
    contexts.length > 0
      ? contexts[0]
      : await browser.newContext({ viewport: config.browser.viewport });

  // Create a new page (don't disturb user's existing tabs)
  const page = await context.newPage();
  page.setDefaultTimeout(config.browser.defaultTimeout);

  return { browser, context, page, isCDP: true };
}

async function launchBrowser(
  pw: PlaywrightModule,
  config: AgentWebConfig,
  options?: SessionOptions,
): Promise<BrowserSession> {
  const headless = options?.headed
    ? false
    : (options?.headless ?? config.browser.headless);

  const browser = await pw.chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: config.browser.viewport,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(config.browser.defaultTimeout);

  return { browser, context, page, isCDP: false };
}

// ─── Resource Blocking ───────────────────────────────────────

export async function setupResourceBlocking(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  blockedTypes?: string[],
): Promise<void> {
  if (!blockedTypes || blockedTypes.length === 0) return;

  const blocked = new Set(blockedTypes);

  await page.route("**/*", (route: { request: () => { resourceType: () => string }; abort: () => Promise<void>; continue: () => Promise<void> }) => {
    if (blocked.has(route.request().resourceType())) {
      route.abort();
    } else {
      route.continue();
    }
  });
}

export async function unblockResources(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
): Promise<void> {
  await page.unrouteAll({ behavior: "wait" });
}

// ─── Session Management ──────────────────────────────────────

/**
 * 取得或建立瀏覽器 session
 */
export async function getSession(
  name = "default",
  options?: SessionOptions,
): Promise<BrowserSession> {
  const existing = sessions.get(name);
  if (existing) return existing;

  const pw = await getPlaywright();
  const config = loadConfig();

  // CDP resolution: option > env > config
  const cdpEndpoint = options?.cdp ?? (await resolveCdpEndpoint(config, options?.cdpPort));

  let session: BrowserSession;

  if (cdpEndpoint) {
    try {
      session = await connectViaCDP(pw, cdpEndpoint, config);
    } catch (err) {
      console.error(
        `CDP connection failed (${(err as Error).message}), launching new browser`,
      );
      session = await launchBrowser(pw, config, options);
    }
  } else {
    session = await launchBrowser(pw, config, options);
  }

  // Apply resource blocking (unless explicitly disabled)
  const shouldBlock = options?.blockResources !== false;
  if (shouldBlock) {
    await setupResourceBlocking(session.page, config.browser.blockResources);
  }

  sessions.set(name, session);
  return session;
}

/**
 * 關閉瀏覽器 session
 */
export async function closeSession(name = "default"): Promise<void> {
  const session = sessions.get(name);
  if (!session) return;

  if (session.isCDP) {
    // CDP mode: only close the page we created; do NOT call browser.close()
    // as that would disconnect (and potentially kill) the user's Chrome instance
    await session.page.close();
  } else {
    await session.browser.close();
  }
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
