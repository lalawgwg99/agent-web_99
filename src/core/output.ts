import type { FetchResult } from "../adapters/types.js";

/**
 * 將 FetchResult 格式化為 AI 友善的結構化輸出
 */
export function toStructuredOutput(result: FetchResult): string {
  const lines: string[] = [];

  lines.push(`**Platform:** ${result.platform}`);
  lines.push(`**Type:** ${result.contentType}`);
  lines.push(`**Tokens:** ~${result.tokenEstimate}`);

  if (result.metadata._fallbackFrom) {
    lines.push(
      `**Note:** Fallback from ${result.metadata._fallbackFrom as string}`,
    );
  }

  lines.push("");
  lines.push(result.content);

  return lines.join("\n");
}
