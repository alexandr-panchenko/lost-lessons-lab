import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: "./wrangler.jsonc",
      },
      miniflare: {
        bindings: {
          OPENAI_API_KEY: "test-openai-key-unused-in-m2",
          ROOM_TOKEN_PEPPER: "test-room-pepper-with-at-least-thirty-two-bytes",
        },
      },
    }),
  ],
  test: {
    include: ["tests/integration/**/*.test.ts"],
  },
});
