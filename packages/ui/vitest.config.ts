import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    // globals habilita o afterEach global que o @testing-library/react usa
    // para desmontar o DOM entre testes automaticamente.
    globals: true,
  },
});
