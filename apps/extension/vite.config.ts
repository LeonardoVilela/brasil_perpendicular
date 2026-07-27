import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Passe 2: popup, options (páginas) e o service worker (ESM). Não pode limpar
// o dist/ do passe 1 (content.js).
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: {
        popup: r("./popup.html"),
        options: r("./options.html"),
        "service-worker": r("./src/background/service-worker.ts"),
      },
      output: {
        // service-worker.js precisa de nome fixo (referenciado no manifest.json).
        entryFileNames: (chunk) =>
          chunk.name === "service-worker" ? "service-worker.js" : "assets/[name]-[hash].js",
      },
    },
  },
});
