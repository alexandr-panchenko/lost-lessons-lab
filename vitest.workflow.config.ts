import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

import { wrongBridgeAnalysis } from "./tests/fixtures/openai/solution-results";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          AI_ENABLED: "true",
          AI_IP_LIMIT_PER_HOUR: "10",
          AI_MAX_RETRIES: "0",
          AI_ROOM_LIMIT_PER_HOUR: "10",
          AI_TEST_FAKE_DELAY_MS: "31000",
          AI_TEST_RESPONSE_JSON: JSON.stringify(wrongBridgeAnalysis),
          AI_TIMEOUT_MS: "60000",
          APP_ENV: "test",
          OPENAI_API_KEY: "test-openai-key-long-enough-and-never-sent",
          OPENAI_MODEL: "gpt-5.6",
          PUBLIC_SUPPORTING_SCENARIOS_ENABLED: "false",
          ROOM_TOKEN_PEPPER: "test-room-pepper-with-at-least-thirty-two-bytes",
        },
      },
    }),
  ],
  test: {
    include: ["tests/workflow/**/*.test.ts"],
    testTimeout: 50_000,
  },
});
