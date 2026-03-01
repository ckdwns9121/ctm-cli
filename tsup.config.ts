import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: true,
  bundle: true,
  target: "node20",
  banner: {
    js: "#!/usr/bin/env node",
  },
});
