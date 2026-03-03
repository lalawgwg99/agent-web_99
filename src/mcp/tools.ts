import { z } from "zod";
import { Router } from "../core/router.js";
import { getSession, hasSession } from "../browser/manager.js";
import { takeSnapshot } from "../browser/snapshot.js";
import { performAction, type ActionType } from "../browser/actions.js";
import { RefMap } from "../browser/ref-map.js";
import { isDomainAllowed } from "../browser/security.js";
import { wrapContentBoundary } from "../browser/security.js";
import { loadConfig } from "../core/config.js";
import { runDoctor, formatDoctorReport } from "../core/doctor.js";

// 每個 MCP session 共享的狀態
const sessionRefMaps = new Map<string, RefMap>();

function getRefMap(sessionName: string): RefMap {
  let refMap = sessionRefMaps.get(sessionName);
  if (!refMap) {
    refMap = new RefMap();
    sessionRefMaps.set(sessionName, refMap);
  }
  return refMap;
}

/**
 * 工具定義與 handler
 */
export interface ToolDef {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  annotations?: Record<string, boolean>;
  handler: (input: unknown) => Promise<{ content: Array<{ type: string; text: string }> }>;
}

const router = new Router();

export function getTools(): ToolDef[] {
  return [
    // Tool 1: web_fetch
    {
      name: "web_fetch",
      description:
        "Fetch and extract content from any URL. Auto-detects platform (YouTube, Twitter, GitHub, etc.) and uses the best extraction method. Returns structured markdown.",
      inputSchema: z.object({
        url: z.string().describe("URL to fetch content from"),
        maxLength: z
          .number()
          .optional()
          .describe("Max content length in characters"),
        lang: z
          .string()
          .optional()
          .describe('Preferred language code (e.g. "en", "zh")'),
        adapter: z
          .string()
          .optional()
          .describe("Force specific adapter (e.g. youtube, jina)"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
      handler: async (input) => {
        const { url, maxLength, lang, adapter } = input as {
          url: string;
          maxLength?: number;
          lang?: string;
          adapter?: string;
        };

        const result = adapter
          ? await router.fetchWith(adapter, url, { maxLength, lang })
          : await router.fetch(url, { maxLength, lang });

        const output = [
          `**Platform:** ${result.platform} | **Type:** ${result.contentType} | **Tokens:** ~${result.tokenEstimate}`,
          "",
          wrapContentBoundary(result.content),
        ].join("\n");

        return { content: [{ type: "text", text: output }] };
      },
    },

    // Tool 2: web_open
    {
      name: "web_open",
      description:
        "Open URL in browser for interactive automation. Returns page snapshot with @ref element references. Use this when you need to interact with a page (click, fill forms, etc.).",
      inputSchema: z.object({
        url: z.string().describe("URL to open"),
        session: z
          .string()
          .optional()
          .default("default")
          .describe("Session name for isolation"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
      handler: async (input) => {
        const { url, session: sessionName } = input as {
          url: string;
          session: string;
        };

        const config = loadConfig();
        if (!isDomainAllowed(url, config.browser.allowedDomains)) {
          return {
            content: [
              { type: "text", text: "Error: Domain not in allowlist" },
            ],
          };
        }

        const browserSession = await getSession(sessionName);
        await browserSession.page.goto(url, { waitUntil: "domcontentloaded" });

        const refMap = getRefMap(sessionName);
        const snapshot = await takeSnapshot(browserSession.page, refMap, {
          interactiveOnly: true,
        });

        const output = [
          `**Page:** ${snapshot.title}`,
          `**URL:** ${snapshot.url}`,
          `**Refs:** ${snapshot.refCount} interactive elements`,
          "",
          wrapContentBoundary(snapshot.text),
        ].join("\n");

        return { content: [{ type: "text", text: output }] };
      },
    },

    // Tool 3: web_snapshot
    {
      name: "web_snapshot",
      description:
        "Get accessibility tree snapshot of current page with @ref element references. Use after navigation or DOM changes to get fresh refs.",
      inputSchema: z.object({
        interactiveOnly: z
          .boolean()
          .optional()
          .default(true)
          .describe("Only show interactive elements"),
        session: z.string().optional().default("default"),
      }),
      annotations: { readOnlyHint: true },
      handler: async (input) => {
        const { interactiveOnly, session: sessionName } = input as {
          interactiveOnly: boolean;
          session: string;
        };

        if (!hasSession(sessionName)) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No browser open. Use web_open first.",
              },
            ],
          };
        }

        const browserSession = await getSession(sessionName);
        const refMap = getRefMap(sessionName);
        const snapshot = await takeSnapshot(browserSession.page, refMap, {
          interactiveOnly,
        });

        const output = [
          `**Page:** ${snapshot.title}`,
          `**Refs:** ${snapshot.refCount} elements`,
          "",
          wrapContentBoundary(snapshot.text),
        ].join("\n");

        return { content: [{ type: "text", text: output }] };
      },
    },

    // Tool 4: web_action
    {
      name: "web_action",
      description:
        'Perform an action on the current browser page. Actions: click, fill, select, scroll, press, hover. Use @ref from snapshot to target elements (e.g. ref: "@e1").',
      inputSchema: z.object({
        action: z
          .enum(["click", "fill", "select", "scroll", "press", "hover"])
          .describe("Action type"),
        ref: z
          .string()
          .optional()
          .describe('Element ref from snapshot (e.g. "@e1")'),
        value: z
          .string()
          .optional()
          .describe(
            "Text for fill/select, key for press, direction for scroll",
          ),
        session: z.string().optional().default("default"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
      handler: async (input) => {
        const {
          action,
          ref,
          value,
          session: sessionName,
        } = input as {
          action: ActionType;
          ref?: string;
          value?: string;
          session: string;
        };

        if (!hasSession(sessionName)) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No browser open. Use web_open first.",
              },
            ],
          };
        }

        const browserSession = await getSession(sessionName);
        const refMap = getRefMap(sessionName);

        const result = await performAction({
          action,
          ref,
          value,
          session: browserSession,
          refMap,
        });

        return { content: [{ type: "text", text: result }] };
      },
    },

    // Tool 5: web_screenshot
    {
      name: "web_screenshot",
      description:
        "Take a screenshot of the current browser page. Returns base64 PNG image.",
      inputSchema: z.object({
        fullPage: z.boolean().optional().default(false),
        session: z.string().optional().default("default"),
      }),
      annotations: { readOnlyHint: true },
      handler: async (input) => {
        const { fullPage, session: sessionName } = input as {
          fullPage: boolean;
          session: string;
        };

        if (!hasSession(sessionName)) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No browser open. Use web_open first.",
              },
            ],
          };
        }

        const browserSession = await getSession(sessionName);
        const buffer = await browserSession.page.screenshot({ fullPage });
        const base64 = buffer.toString("base64");

        return {
          content: [{ type: "image", data: base64, mimeType: "image/png" } as unknown as { type: string; text: string }],
        };
      },
    },

    // Tool 6: web_doctor
    {
      name: "web_doctor",
      description: "Check status of all adapters and dependencies.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
      handler: async () => {
        const report = await runDoctor();
        return {
          content: [{ type: "text", text: formatDoctorReport(report) }],
        };
      },
    },
  ];
}
