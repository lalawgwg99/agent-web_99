import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getTools } from "./tools.js";

/**
 * MCP Server — STDIO 傳輸
 * 用法：agent-web serve
 * 或 npx agent-web serve
 */
export async function startServer(): Promise<void> {
  const server = new Server(
    {
      name: "agent-web",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  const tools = getTools();

  // 列出所有工具
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: "object" as const,
          properties: Object.fromEntries(
            Object.entries(
              (tool.inputSchema as { shape?: Record<string, unknown> }).shape ?? {},
            ).map(([key, schema]) => [
              key,
              { type: "string", description: (schema as { description?: string }).description },
            ]),
          ),
        },
        annotations: tool.annotations,
      })),
    };
  });

  // 執行工具
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const tool = tools.find((t) => t.name === toolName);

    if (!tool) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
        isError: true,
      };
    }

    try {
      return await tool.handler(request.params.arguments ?? {});
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // 寫到 stderr，不干擾 JSON-RPC
  console.error("agent-web MCP server started (STDIO)");
}
