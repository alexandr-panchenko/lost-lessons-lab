import { describe, expect, it } from "vitest";

import { validateBridgeAnalysis } from "../../src/shared/validation/bridge-analysis";
import { wrongBridgeAnalysis } from "../fixtures/openai/solution-results";

describe("deterministic bridge analysis validation", () => {
  it("classifies the prepared wrong and correct work from extracted inputs", () => {
    const wrong = validateBridgeAnalysis(wrongBridgeAnalysis);
    expect(wrong.ok).toBe(true);
    if (wrong.ok) {
      expect(wrong.value.outcome.resultClass).toBe("bridge_far_too_short");
      expect(wrong.value.disagreement).toBe(false);
    }

    const correct = validateBridgeAnalysis({
      ...wrongBridgeAnalysis,
      finalAnswers: [
        { name: "deployedLengthMeters", unit: "meters", value: 9 },
      ],
      firstError: null,
      scenarioInputs: { deployedLengthMeters: 9, fractionAsDecimal: 0.75 },
      verdict: "correct",
    });
    expect(correct.ok).toBe(true);
    if (correct.ok)
      expect(correct.value.outcome.resultClass).toBe("bridge_correct");
  });

  it("rejects contradictory values, unsupported units, and ambiguous work", () => {
    expect(
      validateBridgeAnalysis({
        ...wrongBridgeAnalysis,
        scenarioInputs: {
          deployedLengthMeters: 4.08,
          fractionAsDecimal: 0.75,
        },
      }).ok,
    ).toBe(false);
    expect(
      validateBridgeAnalysis({
        ...wrongBridgeAnalysis,
        finalAnswers: [
          { name: "deployedLengthMeters", unit: "seconds", value: 4.08 },
        ],
      }).ok,
    ).toBe(false);
    expect(
      validateBridgeAnalysis({ ...wrongBridgeAnalysis, verdict: "ambiguous" })
        .ok,
    ).toBe(false);
  });

  it("records model disagreement without allowing it to control truth", () => {
    const result = validateBridgeAnalysis({
      ...wrongBridgeAnalysis,
      verdict: "correct",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.disagreement).toBe(true);
      expect(result.value.outcome.isMathematicallyCorrect).toBe(false);
    }
  });
});
