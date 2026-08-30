import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// .mts, бо Vite вантажить конфіг нативним лоадером: у .ts він пішов би як CJS
// і спіткнувся б на ESM-синтаксисі.
export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
});
