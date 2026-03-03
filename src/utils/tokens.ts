/**
 * 簡易 token 估算（英文 ~4 字元/token，中文 ~2 字元/token）
 */
export function estimateTokens(text: string): number {
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const otherCount = text.length - cjkCount;
  return Math.ceil(cjkCount / 1.5 + otherCount / 4);
}
