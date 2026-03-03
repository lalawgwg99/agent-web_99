import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["bin/agent-web.ts"],
    format: ["esm"],
    clean: true,
    target: "node20",
    splitting: false,
    sourcemap: true,
    external: ["playwright"],
    banner: {
      js: "#!/usr/bin/env node",
    },
    outDir: "dist/bin",
  },
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: false,
    target: "node20",
    splitting: false,
    sourcemap: true,
    external: ["playwright"],
    outDir: "dist",
  },
]);
