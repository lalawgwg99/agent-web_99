import type { FetchResult } from "../adapters/types.js";

/**
 * CLI 輸出格式化
 */
export function formatFetchResult(result: FetchResult, json: boolean): string {
  if (json) {
    return JSON.stringify(result, null, 2);
  }

  const lines: string[] = [];
  lines.push(`--- ${result.platform} | ${result.contentType} ---`);
  lines.push(`URL: ${result.url}`);
  lines.push(`Tokens: ~${result.tokenEstimate}`);

  if (result.metadata._fallbackFrom) {
    lines.push(`Fallback: ${result.metadata._fallbackFrom as string} → ${result.platform}`);
  }

  lines.push("");
  lines.push(result.content);

  return lines.join("\n");
}

export function formatError(err: unknown): string {
  if (err instanceof Error) {
    return `Error: ${err.message}`;
  }
  return `Error: ${String(err)}`;
}
