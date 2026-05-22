// 預編譯 CJK 文字正則表達式以提高效能
const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

/**
 * 簡易 token 估算（英文 ~4 字元/token，中文 ~2 字元/token）
 * 效能優化：使用預編譯正則和避免不必要的陣列創建
 */
export function estimateTokens(text: string): number {
  // 使用短路計算避免空字符串情況
  if (!text) return 0;
  
  const matches = text.match(CJK_REGEX);
  const cjkCount = matches ? matches.length : 0;
  const otherCount = text.length - cjkCount;
  
  // 使用加法而非除法，並且只有一次 Math.ceil 調用
  return Math.ceil(cjkCount / 1.5 + otherCount / 4);
}
