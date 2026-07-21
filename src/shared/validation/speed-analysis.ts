import {
  SpeedSolutionAnalysisSchema,
  type ValidatedSpeedAnalysis,
} from "../analysis-types";
import {
  classifySpeedInput,
  type SpeedSimulationInputs,
  type SpeedTaskParameters,
} from "../domain/speed";

export type SpeedSemanticValidationResult =
  { ok: true; value: ValidatedSpeedAnalysis } | { issues: string[]; ok: false };

const METERS = new Set(["m", "meter", "meters", "metre", "metres"]);

export function validateSpeedAnalysis(
  input: unknown,
  parameters: SpeedTaskParameters,
): SpeedSemanticValidationResult {
  const parsed = SpeedSolutionAnalysisSchema.safeParse(input);
  if (!parsed.success) {
    return {
      issues: ["The response did not match speed solution-analysis.v1."],
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
  const distanceMeters = analysis.scenarioInputs.distanceMeters;
  if (distanceMeters === null) {
    return { issues: ["distanceMeters is required."], ok: false };
  }
  const inputs: SpeedSimulationInputs = {
    distanceMeters,
    ...(analysis.scenarioInputs.speedMetersPerSecond === null
      ? {}
      : { speedMetersPerSecond: analysis.scenarioInputs.speedMetersPerSecond }),
    ...(analysis.scenarioInputs.timeSeconds === null
      ? {}
      : { timeSeconds: analysis.scenarioInputs.timeSeconds }),
  };
  let outcome;
  try {
    outcome = classifySpeedInput(parameters, inputs);
  } catch {
    return {
      issues: ["The extracted motion inputs are outside supported ranges."],
      ok: false,
    };
  }
  const finalAnswer = analysis.finalAnswers.find(
    (answer) => answer.name === "distanceMeters",
  );
  if (
    finalAnswer?.value !== null &&
    finalAnswer?.value !== undefined &&
    Math.abs(finalAnswer.value - distanceMeters) > 0.001
  ) {
    return {
      issues: ["The final distance contradicts distanceMeters."],
      ok: false,
    };
  }
  if (
    finalAnswer?.unit !== null &&
    finalAnswer?.unit !== undefined &&
    !METERS.has(finalAnswer.unit.toLowerCase())
  ) {
    return { issues: ["The distance unit must be meters."], ok: false };
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
