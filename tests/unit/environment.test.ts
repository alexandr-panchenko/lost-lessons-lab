import { describe, expect, it } from "vitest";

import {
  parsePublicEnvironment,
  type PublicEnvironmentInput,
} from "../../src/worker/env";

function environment(
  overrides: PublicEnvironmentInput = {},
): PublicEnvironmentInput {
  return overrides;
}

describe("public Worker environment", () => {
  it("applies safe local defaults", () => {
    expect(parsePublicEnvironment(environment())).toEqual({
      AI_ENABLED: "false",
      APP_ENV: "development",
      OPENAI_MODEL: "gpt-5.6",
    });
  });

  it("rejects an invalid public origin", () => {
    expect(() =>
      parsePublicEnvironment(environment({ PUBLIC_APP_ORIGIN: "not-a-url" })),
    ).toThrow();
  });
});
