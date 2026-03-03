/**
 * Adapter 介面定義
 * 每個平台（YouTube, Twitter, GitHub...）都實作這個介面
 */

/** Adapter 抓取結果 */
export interface FetchResult {
  url: string;
  platform: string;
  content: string;
  metadata: Record<string, unknown>;
  contentType:
    | "article"
    | "video"
    | "post"
    | "thread"
    | "repo"
    | "feed"
    | "page";
  fetchedAt: string;
  tokenEstimate: number;
}

/** Adapter 健康狀態（doctor 用） */
export interface AdapterHealth {
  name: string;
  installed: boolean;
  configured: boolean;
  version?: string;
  error?: string;
  installHint?: string;
}

/** 外部依賴規格 */
export interface DependencySpec {
  name: string;
  type: "binary" | "npm" | "pip";
  required: boolean;
  installCmd: string;
  checkCmd: string;
}

/** Adapter 選項 */
export interface AdapterOptions {
  maxLength?: number;
  lang?: string;
  cookies?: string;
  proxy?: string;
  timeout?: number;
}

/** 所有 Adapter 必須實作的介面 */
export interface Adapter {
  name: string;
  description: string;
  patterns: RegExp[];
  priority: number;
  dependencies: DependencySpec[];

  fetch(url: string, options?: AdapterOptions): Promise<FetchResult>;
  check(): Promise<AdapterHealth>;
}
