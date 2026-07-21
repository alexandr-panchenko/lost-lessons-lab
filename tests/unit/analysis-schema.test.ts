import { describe, expect, it } from "vitest";

import {
  SolutionAnalysisSchema,
  TaskPlanSchema,
} from "../../src/shared/analysis-types";
import { wrongBridgeAnalysis } from "../fixtures/openai/solution-results";

describe("strict analysis contracts", () => {
  it("accepts the versioned bridge analysis and rejects extra keys", () => {
    expect(SolutionAnalysisSchema.parse(wrongBridgeAnalysis)).toEqual(
      wrongBridgeAnalysis,
    );
    expect(
      SolutionAnalysisSchema.safeParse({ ...wrongBridgeAnalysis, hidden: true })
        .success,
    ).toBe(false);
  });

  it("requires explicit nullable fields and bounded finite values", () => {
    const missingNullable = structuredClone(wrongBridgeAnalysis) as Record<
      string,
      unknown
    >;
    delete missingNullable.firstError;
    expect(SolutionAnalysisSchema.safeParse(missingNullable).success).toBe(
      false,
    );
    expect(
      SolutionAnalysisSchema.safeParse({
        ...wrongBridgeAnalysis,
        confidence: Number.POSITIVE_INFINITY,
      }).success,
    ).toBe(false);
    expect(
      SolutionAnalysisSchema.safeParse({
        ...wrongBridgeAnalysis,
        verdict: "mostly-correct",
      }).success,
    ).toBe(false);
  });

  it("keeps task planning versioned and strict", () => {
    const plan = {
      parameterCandidate: null,
      schemaVersion: "task-plan.v1",
      skillId: null,
      suggestedAlternatives: ["Fractions and the bridge"],
      supportStatus: "unsupported",
      templateId: null,
      wording: null,
    } as const;
    expect(TaskPlanSchema.parse(plan)).toEqual(plan);
    expect(TaskPlanSchema.safeParse({ ...plan, extra: "no" }).success).toBe(
      false,
    );
  });
});
