import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  analyzeBridgeSolution,
  parseAiConfiguration,
} from "../../src/worker/ai/openai-responses";

function localSecret(name: string): string | undefined {
  const source = readFileSync(".dev.vars", "utf8");
  const line = source
    .split(/\r?\n/u)
    .find((candidate) => candidate.startsWith(`${name}=`));
  if (line === undefined) return undefined;
  return line
    .slice(name.length + 1)
    .trim()
    .replace(/^['"]|['"]$/gu, "");
}

const apiKey = localSecret("OPENAI_API_KEY");
const config = parseAiConfiguration({
  AI_ENABLED: "true",
  AI_MAX_RETRIES: "1",
  AI_TIMEOUT_MS: "60000",
  ...(apiKey === undefined ? {} : { OPENAI_API_KEY: apiKey }),
  OPENAI_MODEL: "gpt-5.6",
});

const samples = [
  {
    expectedDecimal: 0.34,
    expectedLength: 4.08,
    expectedResultClass: "bridge_far_too_short",
    file: "tests/fixtures/handwriting/bridge-wrong.png",
    name: "prepared wrong work",
  },
  {
    expectedDecimal: 0.75,
    expectedLength: 9,
    expectedResultClass: "bridge_correct",
    file: "tests/fixtures/handwriting/bridge-correct.png",
    name: "prepared correct work",
  },
] as const;

describe("live GPT-5.6 handwriting evaluation", () => {
  for (const sample of samples) {
    it(`extracts exact inputs from ${sample.name}`, async () => {
      const result = await analyzeBridgeSolution({
        config,
        imageBase64: readFileSync(sample.file).toString("base64"),
        safetyIdentifier: `live_eval_${sample.expectedLength}`,
      });
      if (!result.ok) {
        console.info(
          JSON.stringify({
            category: result.category,
            latencyMs: result.latencyMs,
            sample: sample.name,
            usedRepair: result.usedRepair,
            validationIssues: result.validationIssues,
          }),
        );
      }
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.modelId).toMatch(/^gpt-5\.6/u);
      expect(result.validated.inputs).toMatchObject({
        deployedLengthMeters: sample.expectedLength,
        fractionAsDecimal: sample.expectedDecimal,
      });
      expect(result.validated.outcome.resultClass).toBe(
        sample.expectedResultClass,
      );
      console.info(
        JSON.stringify({
          inputTokens: result.usage.inputTokens,
          latencyMs: result.latencyMs,
          modelId: result.modelId,
          outputTokens: result.usage.outputTokens,
          responseIdSuffix: result.responseId.slice(-8),
          sample: sample.name,
          usedRepair: result.usedRepair,
        }),
      );
    }, 70_000);
  }
});
