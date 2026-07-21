import type { SolutionAnalysis } from "../../../src/shared/analysis-types";

export const wrongBridgeAnalysis: SolutionAnalysis = {
  confidence: 0.98,
  finalAnswers: [{ name: "deployedLengthMeters", unit: "m", value: 4.08 }],
  firstError: {
    regionId: "step-1",
    summary: "The fraction 3/4 was converted to 0.34 instead of 0.75.",
  },
  scenarioInputs: { deployedLengthMeters: 4.08, fractionAsDecimal: 0.34 },
  schemaVersion: "solution-analysis.v1",
  steps: [
    {
      normalizedExpression: "3/4 = 0.34",
      regionId: "step-1",
      status: "suspected_error",
      text: "3/4 = 0.34",
    },
    {
      normalizedExpression: "12 * 0.34 = 4.08 m",
      regionId: "step-2",
      status: "valid",
      text: "12 × 0.34 = 4.08 m",
    },
  ],
  studentFacingExplanation:
    "Three quarters is 0.75, so multiply 12 by 0.75 and try again.",
  transcription: "3/4 = 0.34\n12 × 0.34 = 4.08 m",
  verdict: "incorrect",
};

export const correctBridgeAnalysis: SolutionAnalysis = {
  ...wrongBridgeAnalysis,
  finalAnswers: [{ name: "deployedLengthMeters", unit: "m", value: 9 }],
  firstError: null,
  scenarioInputs: { deployedLengthMeters: 9, fractionAsDecimal: 0.75 },
  steps: [
    {
      normalizedExpression: "3/4 = 0.75",
      regionId: "step-1",
      status: "valid",
      text: "3/4 = 0.75",
    },
    {
      normalizedExpression: "12 * 0.75 = 9 m",
      regionId: "step-2",
      status: "valid",
      text: "12 × 0.75 = 9 m",
    },
  ],
  studentFacingExplanation: "Three quarters of the 12-meter kit is 9 meters.",
  transcription: "3/4 = 0.75\n12 × 0.75 = 9 m",
  verdict: "correct",
};
