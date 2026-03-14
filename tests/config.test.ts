import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stringify as stringifyYaml } from "yaml";

// Mock os.homedir to return a temp dir
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-web-test-"));
const origHomedir = os.homedir;
os.homedir = () => tmpDir;

const agentWebDir = path.join(tmpDir, ".agent-web");
const configPath = path.join(agentWebDir, "config.yaml");

// Import after mocking homedir
import {
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  AgentWebConfigSchema,
} from "../src/core/config.js";

function cleanConfig(): void {
  try {
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
  } catch { /* noop */ }
}

function writeConfig(data: Record<string, unknown>): void {
  fs.mkdirSync(agentWebDir, { recursive: true });
  fs.writeFileSync(configPath, stringifyYaml(data));
}

describe("config", () => {
  afterAll(() => {
    os.homedir = origHomedir;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns defaults when no config file exists", () => {
    cleanConfig();
    const config = loadConfig();
    expect(config.browser.headless).toBe(true);
    expect(config.browser.defaultTimeout).toBe(25_000);
    expect(config.browser.viewport).toEqual({ width: 1280, height: 720 });
    expect(config.browser.blockResources).toEqual(["image", "font", "media"]);
  });

  it("loads valid YAML config", () => {
    writeConfig({
      browser: {
        headless: false,
        defaultTimeout: 10000,
        viewport: { width: 1920, height: 1080 },
      },
    });
    const config = loadConfig();
    expect(config.browser.headless).toBe(false);
    expect(config.browser.defaultTimeout).toBe(10000);
    expect(config.browser.viewport).toEqual({ width: 1920, height: 1080 });
    cleanConfig();
  });

  it("falls back to defaults on invalid YAML", () => {
    writeConfig({});
    fs.writeFileSync(configPath, "{{invalid yaml}}");
    const config = loadConfig();
    expect(config.browser.headless).toBe(true);
    cleanConfig();
  });

  it("saves config to disk", () => {
    cleanConfig();
    const config = loadConfig();
    config.browser.headless = false;
    saveConfig(config);

    expect(fs.existsSync(configPath)).toBe(true);
    const raw = fs.readFileSync(configPath, "utf-8");
    expect(raw).toContain("headless: false");
    cleanConfig();
  });

  it("getConfigValue reads dot notation from defaults", () => {
    cleanConfig();
    expect(getConfigValue("browser.headless")).toBe(true);
    expect(getConfigValue("browser.viewport.width")).toBe(1280);
  });

  it("getConfigValue returns undefined for missing paths", () => {
    cleanConfig();
    expect(getConfigValue("nonexistent.path")).toBeUndefined();
  });

  it("setConfigValue creates nested objects", () => {
    cleanConfig();
    setConfigValue("platforms.github.token", "test-token-123");
    expect(getConfigValue("platforms.github.token")).toBe("test-token-123");
    cleanConfig();
  });

  describe("zod validation", () => {
    it("accepts valid config", () => {
      const result = AgentWebConfigSchema.safeParse({
        browser: {
          headless: true,
          defaultTimeout: 5000,
          viewport: { width: 800, height: 600 },
        },
      });
      expect(result.success).toBe(true);
    });

    it("applies defaults for missing fields", () => {
      const result = AgentWebConfigSchema.safeParse({ browser: {} });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.browser.headless).toBe(true);
        expect(result.data.browser.blockResources).toEqual(["image", "font", "media"]);
      }
    });

    it("rejects invalid types", () => {
      const result = AgentWebConfigSchema.safeParse({
        browser: { headless: "yes" },
      });
      expect(result.success).toBe(false);
    });

    it("allows unknown keys via passthrough", () => {
      const result = AgentWebConfigSchema.safeParse({
        browser: { headless: true },
        customField: "anything",
      });
      expect(result.success).toBe(true);
    });
  });
});
