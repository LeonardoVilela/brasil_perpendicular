import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    // overlay-manager injeta CSS real (styles.css?inline) no shadow root;
    // sem isso, Vitest troca todo import de CSS por um stub vazio.
    css: true,
  },
});
