import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import terminal from "vite-plugin-terminal";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    terminal({
      console: "terminal",
      strip: false,
    }),
  ],
  server: {
    port: 3000,
    host: true,
  },
});
