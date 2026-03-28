import { defineConfig } from "tsup";

export default defineConfig([
  // CLI binary — outputs to dist/bin/
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
  // Library / public API — outputs to dist/lib/
  // Using a separate outDir allows clean:true on both configs without
  // one wiping the other's output (eliminates the fragile clean:false).
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    target: "node20",
    splitting: false,
    sourcemap: true,
    external: ["playwright"],
    outDir: "dist/lib",
  },
]);
