import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { z } from "zod";

// ─── Zod Schema ──────────────────────────────────────────────

const ViewportSchema = z.object({
  width: z.number().int().positive().default(1280),
  height: z.number().int().positive().default(720),
});

const CdpSchema = z.object({
  url: z.string().url().optional(),
  port: z.number().int().positive().optional(),
}).optional();

const BrowserConfigSchema = z.object({
  headless: z.boolean().default(true),
  defaultTimeout: z.number().int().positive().default(25_000),
  viewport: ViewportSchema.default({ width: 1280, height: 720 }),
  allowedDomains: z.array(z.string()).optional(),
  cdp: CdpSchema,
  blockResources: z.array(z.string()).default(["image", "font", "media"]),
});

const PlatformTwitterSchema = z.object({ cookies: z.string() }).optional();
const PlatformGithubSchema = z.object({ token: z.string() }).optional();
const PlatformXiaohongshuSchema = z.object({ cookies: z.string() }).optional();

const PlatformsSchema = z.object({
  twitter: PlatformTwitterSchema,
  github: PlatformGithubSchema,
  xiaohongshu: PlatformXiaohongshuSchema,
}).partial().default({});

const ProxySchema = z.object({
  http: z.string().optional(),
  https: z.string().optional(),
}).optional();

const AdaptersSchema = z.object({
  disabled: z.array(z.string()).optional(),
}).default({});

const AgentWebConfigSchema = z.object({
  browser: BrowserConfigSchema.default({
    headless: true,
    defaultTimeout: 25_000,
    viewport: { width: 1280, height: 720 },
    blockResources: ["image", "font", "media"],
  }),
  platforms: PlatformsSchema,
  proxy: ProxySchema,
  adapters: AdaptersSchema,
}).passthrough(); // Allow unknown keys for backward compat

export type AgentWebConfig = z.infer<typeof AgentWebConfigSchema>;

const DEFAULT_CONFIG: AgentWebConfig = {
  browser: {
    headless: true,
    defaultTimeout: 25_000,
    viewport: { width: 1280, height: 720 },
    blockResources: ["image", "font", "media"],
  },
  platforms: {},
  adapters: {},
};

function getConfigDir(): string {
  return path.join(os.homedir(), ".agent-web");
}

function getConfigPath(): string {
  return path.join(getConfigDir(), "config.yaml");
}

export function loadConfig(): AgentWebConfig {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return structuredClone(DEFAULT_CONFIG);
  }

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = parseYaml(raw);
    // Validate & apply defaults via zod
    const result = AgentWebConfigSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    // Validation failed — fall back to defaults with warning
    console.error(`[config] Validation warnings: ${result.error.issues.map(i => i.path.join('.')).join(', ')}`);
    return structuredClone(DEFAULT_CONFIG);
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

export function saveConfig(config: AgentWebConfig): void {
  const dir = getConfigDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

  const configPath = getConfigPath();
  fs.writeFileSync(configPath, stringifyYaml(config), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

/**
 * 用 dot notation 設定值（如 "platforms.twitter.cookies"）
 */
export function setConfigValue(key: string, value: string): void {
  const config = loadConfig();
  const parts = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: Record<string, unknown> = config as unknown as Record<string, unknown>;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (obj[part] === undefined || typeof obj[part] !== "object") {
      obj[part] = {};
    }
    obj = obj[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1]!;
  obj[lastPart] = value;
  saveConfig(config);
}

/**
 * 用 dot notation 讀取值
 */
export function getConfigValue(key: string): unknown {
  const config = loadConfig();
  const parts = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: any = config;

  for (const part of parts) {
    if (obj === undefined || obj === null) return undefined;
    obj = obj[part];
  }

  return obj;
}

export { getConfigDir, getConfigPath, AgentWebConfigSchema };
