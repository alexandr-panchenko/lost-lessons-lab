import {
  WaterSolutionAnalysisSchema,
  type ValidatedWaterAnalysis,
} from "../analysis-types";
import {
  classifyWaterInput,
  type WaterSimulationInputs,
  type WaterTaskParameters,
} from "../domain/water";

export type WaterSemanticValidationResult =
  { ok: true; value: ValidatedWaterAnalysis } | { issues: string[]; ok: false };

const LITERS = new Set(["l", "liter", "liters", "litre", "litres"]);

export function validateWaterAnalysis(
  input: unknown,
  parameters: WaterTaskParameters,
): WaterSemanticValidationResult {
  const parsed = WaterSolutionAnalysisSchema.safeParse(input);
  if (!parsed.success) {
    return {
      issues: ["The response did not match water solution-analysis.v1."],
      ok: false,
    };
  }
  const analysis = parsed.data;
  if (analysis.verdict === "unreadable" || analysis.verdict === "ambiguous") {
    return {
      issues: [`The handwriting was marked ${analysis.verdict}.`],
      ok: false,
    };
  }
  const volumeLiters = analysis.scenarioInputs.volumeLiters;
  if (volumeLiters === null) {
    return { issues: ["volumeLiters is required."], ok: false };
  }
  const inputs: WaterSimulationInputs = {
    volumeLiters,
    ...(analysis.scenarioInputs.flowRateLitersPerMinute === null
      ? {}
      : {
          flowRateLitersPerMinute:
            analysis.scenarioInputs.flowRateLitersPerMinute,
        }),
    ...(analysis.scenarioInputs.timeMinutes === null
      ? {}
      : { timeMinutes: analysis.scenarioInputs.timeMinutes }),
  };
  let outcome;
  try {
    outcome = classifyWaterInput(parameters, inputs);
  } catch {
    return {
      issues: ["The extracted water inputs are outside supported ranges."],
      ok: false,
    };
  }
  const finalAnswer = analysis.finalAnswers.find(
    (answer) => answer.name === "volumeLiters",
  );
  if (
    finalAnswer?.value !== null &&
    finalAnswer?.value !== undefined &&
    Math.abs(finalAnswer.value - volumeLiters) > 0.001
  ) {
    return {
      issues: ["The final water answer contradicts volumeLiters."],
      ok: false,
    };
  }
  if (
    finalAnswer?.unit !== null &&
    finalAnswer?.unit !== undefined &&
    !LITERS.has(finalAnswer.unit.toLowerCase())
  ) {
    return { issues: ["The water answer unit must be liters."], ok: false };
  }
  const deterministicVerdict = outcome.isMathematicallyCorrect
    ? "correct"
    : "incorrect";
  return {
    ok: true,
    value: {
      analysis,
      disagreement: analysis.verdict !== deterministicVerdict,
      inputs,
      outcome,
    },
  };
}
