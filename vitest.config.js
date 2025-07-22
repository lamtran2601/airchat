import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    globals: true,
    css: true,
    // Include real code tests
    include: [
      "src/test/basic.test.js",
      "src/test/real-code-tests.test.js",
      "src/test/real-react-tests.test.jsx",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/test/",
        "**/*.{test,spec}.{js,jsx}",
        "vite.config.js",
        "vitest.config.js",
        "playwright.config.js",
      ],
    },
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
