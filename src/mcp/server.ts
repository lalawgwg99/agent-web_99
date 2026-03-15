import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getTools } from "./tools.js";
import { type ZodType, ZodString, ZodNumber, ZodBoolean, ZodEnum, ZodOptional, ZodDefault } from "zod";

/**
 * Convert a Zod schema to a JSON Schema object for MCP tool listing.
 * Preserves type information (string, number, boolean, enum) instead of
 * hardcoding everything as "string".
 */
function zodToJsonSchema(schema: ZodType): Record<string, unknown> {
  const shape = (schema as unknown as { shape?: Record<string, ZodType> }).shape;
  if (!shape) return { type: "object", properties: {} };

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, fieldSchema] of Object.entries(shape)) {
    properties[key] = zodFieldToJsonSchema(fieldSchema);
    if (!isOptional(fieldSchema)) {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 && { required }),
  };
}

function isOptional(schema: ZodType): boolean {
  return schema instanceof ZodOptional || schema instanceof ZodDefault;
}

function zodFieldToJsonSchema(schema: ZodType): Record<string, unknown> {
  // Unwrap optional/default wrappers
  const inner = schema instanceof ZodOptional
    ? schema._def.innerType
    : schema instanceof ZodDefault
      ? schema._def.innerType
      : schema;

  const description = (schema as unknown as { description?: string }).description;

  let typeSchema: Record<string, unknown>;

  if (inner instanceof ZodString) {
    typeSchema = { type: "string" };
  } else if (inner instanceof ZodNumber) {
    typeSchema = { type: "number" };
  } else if (inner instanceof ZodBoolean) {
    typeSchema = { type: "boolean" };
  } else if (inner instanceof ZodEnum) {
    typeSchema = { type: "string", enum: (inner as unknown as { _def: { values: string[] } })._def.values };
  } else {
    typeSchema = { type: "string" };
  }

  if (description) typeSchema.description = description;
  return typeSchema;
}

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
        inputSchema: zodToJsonSchema(tool.inputSchema),
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
