// Public API
export type {
  Adapter,
  FetchResult,
  AdapterHealth,
  AdapterOptions,
  DependencySpec,
} from "./adapters/types.js";

export { AdapterRegistry, loadBuiltinAdapters } from "./adapters/registry.js";
export { Router } from "./core/router.js";
export { jinaAdapter } from "./adapters/jina.js";
export { estimateTokens } from "./utils/tokens.js";
