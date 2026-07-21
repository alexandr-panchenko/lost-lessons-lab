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
          AI_ENABLED: "false",
          AI_IP_LIMIT_PER_HOUR: "2",
          AI_ROOM_LIMIT_PER_HOUR: "2",
          OPENAI_API_KEY: "test-openai-key-unused-while-ai-is-disabled",
          PUBLIC_SUPPORTING_SCENARIOS_ENABLED: "true",
          ROOM_TOKEN_PEPPER: "test-room-pepper-with-at-least-thirty-two-bytes",
        },
      },
    }),
  ],
  test: {
    include: ["tests/integration/**/*.test.ts"],
  },
});
