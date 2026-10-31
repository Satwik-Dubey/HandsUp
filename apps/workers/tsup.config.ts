import { defineConfig } from "tsup";

// Bundles the workspace packages (@handsup/*) into dist so the workers deploy as one folder.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  sourcemap: true,
  clean: true,
  noExternal: [/^@handsup\//],
});
