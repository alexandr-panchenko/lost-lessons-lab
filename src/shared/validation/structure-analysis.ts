import {
  StructureSolutionAnalysisSchema,
  type ValidatedStructureAnalysis,
} from "../analysis-types";
import {
  classifyStructureInput,
  type StructureSimulationInputs,
  type StructureTaskParameters,
} from "../domain/structure";

export type StructureSemanticValidationResult =
  | { ok: true; value: ValidatedStructureAnalysis }
  | { issues: string[]; ok: false };

const KILOGRAMS = new Set(["kg", "kilogram", "kilograms"]);

export function validateStructureAnalysis(
  input: unknown,
  parameters: StructureTaskParameters,
): StructureSemanticValidationResult {
  const parsed = StructureSolutionAnalysisSchema.safeParse(input);
  if (!parsed.success) {
    return {
      issues: ["The response did not match structure solution-analysis.v1."],
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
  const totalLoadKg = analysis.scenarioInputs.totalLoadKg;
  if (totalLoadKg === null)
    return { issues: ["totalLoadKg is required."], ok: false };
  const inputs: StructureSimulationInputs = {
    totalLoadKg,
    ...(analysis.scenarioInputs.itemCount === null
      ? {}
      : { itemCount: analysis.scenarioInputs.itemCount }),
    ...(analysis.scenarioInputs.unitLoadKg === null
      ? {}
      : { unitLoadKg: analysis.scenarioInputs.unitLoadKg }),
  };
  let outcome;
  try {
    outcome = classifyStructureInput(parameters, inputs);
  } catch {
    return {
      issues: ["The extracted load inputs are outside supported ranges."],
      ok: false,
    };
  }
  const finalAnswer = analysis.finalAnswers.find(
    (answer) => answer.name === "totalLoadKg",
  );
  if (
    finalAnswer?.value !== null &&
    finalAnswer?.value !== undefined &&
    Math.abs(finalAnswer.value - totalLoadKg) > 0.001
  ) {
    return { issues: ["The final load contradicts totalLoadKg."], ok: false };
  }
  if (
    finalAnswer?.unit !== null &&
    finalAnswer?.unit !== undefined &&
    !KILOGRAMS.has(finalAnswer.unit.toLowerCase())
  ) {
    return { issues: ["The load unit must be kilograms."], ok: false };
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
