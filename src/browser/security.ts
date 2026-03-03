/**
 * 安全策略：Domain 白名單 + 內容邊界
 */

/**
 * 檢查 URL 是否在允許的域名列表中
 */
export function isDomainAllowed(url: string, allowedDomains?: string[]): boolean {
  // 未設白名單 = 全部允許
  if (!allowedDomains || allowedDomains.length === 0) return true;

  // 也檢查環境變數
  const envDomains = process.env["AGENT_WEB_ALLOWED_DOMAINS"];
  const allDomains = [
    ...allowedDomains,
    ...(envDomains ? envDomains.split(",").map((d) => d.trim()) : []),
  ];

  try {
    const hostname = new URL(url).hostname;
    return allDomains.some((domain) => {
      if (domain.startsWith("*.")) {
        const suffix = domain.slice(2);
        return hostname.endsWith(suffix) || hostname === suffix;
      }
      return hostname === domain;
    });
  } catch {
    return false;
  }
}

/**
 * 用內容邊界標記包裹頁面內容，防止 prompt injection
 */
export function wrapContentBoundary(content: string): string {
  if (process.env["AGENT_WEB_CONTENT_BOUNDARIES"] === "1") {
    return `--- BEGIN PAGE CONTENT ---\n${content}\n--- END PAGE CONTENT ---`;
  }
  return content;
}
