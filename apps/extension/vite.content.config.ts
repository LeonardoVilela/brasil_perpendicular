import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Passe 1: content script como IIFE (content scripts do MV3 não são módulos ES).
export default defineConfig({
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    outDir: "dist",
    lib: {
      entry: fileURLToPath(new URL("./src/content/index.ts", import.meta.url)),
      name: "BrasilPerpendicularContent",
      formats: ["iife"],
      fileName: () => "content.js",
    },
  },
});
