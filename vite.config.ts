import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: {
    include: ["pixi.js/unsafe-eval"],
  },
  plugins: [
    react(),
    cloudflare({
      persistState: process.env.E2E_ISOLATED_STATE === "1" ? false : true,
    }),
  ],
});
