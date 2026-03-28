import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export interface AgentWebConfig {
  browser: {
    headless: boolean;
    defaultTimeout: number;
    viewport: { width: number; height: number };
    allowedDomains?: string[];
    cdp?: {
      url?: string;
      port?: number;
    };
    blockResources?: string[];
  };
  platforms: {
    twitter?: { cookies: string };
    github?: { token: string };
    xiaohongshu?: { cookies: string };
  };
  proxy?: {
    http?: string;
    https?: string;
  };
  adapters: {
    disabled?: string[];
  };
}

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

/**
 * Deep merge: sub-objects are merged recursively so partial user configs
 * (e.g. only setting browser.headless) preserve all other nested defaults.
 * Arrays and primitives from `override` always win.
 */
function deepMerge<T extends object>(base: T, override: Partial<T>): T {
  const result = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(override)) {
    if (
      value !== null &&
      value !== undefined &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof result[key] === "object" &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key] as object, value as object);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

export function loadConfig(): AgentWebConfig {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = parseYaml(raw) as Partial<AgentWebConfig>;
    // Deep merge so partial user configs preserve nested defaults
    return deepMerge(DEFAULT_CONFIG, parsed);
  } catch {
    return { ...DEFAULT_CONFIG };
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
  let obj: any = config;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (obj[part] === undefined || typeof obj[part] !== "object") {
      obj[part] = {};
    }
    obj = obj[part];
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

export { getConfigDir, getConfigPath };
