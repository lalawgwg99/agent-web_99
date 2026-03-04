import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { estimateTokens } from "../utils/tokens.js";

/**
 * Readability 內容提取
 * 將 @mozilla/readability 注入瀏覽器上下文，提取乾淨文章文字
 * 適合 AI agent 閱讀文章（非互動操作）
 */

export interface ReadableResult {
  title: string;
  content: string;
  excerpt: string;
  byline: string | null;
  siteName: string | null;
  url: string;
  length: number;
  tokenEstimate: number;
}

let readabilitySource: string | null = null;

function getReadabilitySource(): string {
  if (readabilitySource) return readabilitySource;

  const require = createRequire(import.meta.url);
  const readabilityPath = require.resolve("@mozilla/readability/Readability.js");
  readabilitySource = readFileSync(readabilityPath, "utf-8");
  return readabilitySource;
}

/**
 * 從已開啟的 Playwright page 提取文章內容
 * @returns null if page is not article-like
 */
export async function extractReadableContent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
): Promise<ReadableResult | null> {
  const source = getReadabilitySource();

  // The function runs in browser context (has access to `document`),
  // so we use Function() constructor to avoid Node-side type checking.
  const result = await page.evaluate(`
    (function(code) {
      var module = { exports: {} };
      var fn = new Function("module", "exports", code);
      fn(module, module.exports);
      var Readability = module.exports;

      var doc = document.cloneNode(true);
      var reader = new Readability(doc);
      var article = reader.parse();

      if (!article) return null;

      var div = document.createElement("div");
      div.innerHTML = article.content;
      var textContent = (div.textContent || div.innerText || "").trim();

      return {
        title: article.title,
        content: textContent,
        excerpt: article.excerpt || "",
        byline: article.byline || null,
        siteName: article.siteName || null,
      };
    })(${JSON.stringify(source)})
  `);

  if (!result) return null;

  return {
    ...result,
    url: page.url(),
    length: result.content.length,
    tokenEstimate: estimateTokens(result.content),
  };
}
