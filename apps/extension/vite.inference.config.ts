import { fileURLToPath } from "node:url";
import { copyFileSync } from "node:fs";
import { defineConfig } from "vite";

export default defineConfig({
  define: { "process.env.NODE_ENV": '"production"' },
  resolve: { conditions: ["onnxruntime-web-use-extern-wasm"] },
  plugins: [
    {
      name: "copy-onnx-wasm",
      writeBundle() {
        copyFileSync(
          fileURLToPath(
            new URL("../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm", import.meta.url),
          ),
          fileURLToPath(new URL("./dist/ort-wasm-simd-threaded.jsep.wasm", import.meta.url)),
        );
      },
    },
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL("./src/detectors/inference-worker.ts", import.meta.url)),
      name: "BrasilPerpendicularInference",
      formats: ["iife"],
      fileName: () => "inference-worker.js",
    },
  },
});
