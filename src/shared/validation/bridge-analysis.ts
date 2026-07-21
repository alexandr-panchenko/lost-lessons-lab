import {
  classifyBridgeInput,
  HERO_BRIDGE_PARAMETERS,
  type BridgeSimulationInputs,
} from "../domain/bridge";
import {
  SolutionAnalysisSchema,
  type ValidatedBridgeAnalysis,
} from "../analysis-types";

export type SemanticValidationResult =
  | { ok: true; value: ValidatedBridgeAnalysis }
  | { issues: string[]; ok: false };

const METERS = new Set(["m", "meter", "meters", "metre", "metres"]);

export function validateBridgeAnalysis(
  input: unknown,
): SemanticValidationResult {
  const parsed = SolutionAnalysisSchema.safeParse(input);
  if (!parsed.success) {
    return {
      issues: ["The response did not match solution-analysis.v1."],
      ok: false,
    };
  }

  const analysis = parsed.data;
  if (analysis.verdict === "unreadable") {
    return { issues: ["The handwriting was marked unreadable."], ok: false };
  }
  if (analysis.verdict === "ambiguous") {
    return { issues: ["The handwriting was marked ambiguous."], ok: false };
  }

  const deployedLengthMeters = analysis.scenarioInputs.deployedLengthMeters;
  if (deployedLengthMeters === null) {
    return { issues: ["deployedLengthMeters is required."], ok: false };
  }
  const fractionAsDecimal = analysis.scenarioInputs.fractionAsDecimal;
  const inputs: BridgeSimulationInputs = {
    deployedLengthMeters,
    ...(fractionAsDecimal === null ? {} : { fractionAsDecimal }),
  };
  const parsedInputs = (() => {
    try {
      return classifyBridgeInput(HERO_BRIDGE_PARAMETERS, inputs);
    } catch {
      return null;
    }
  })();
  if (parsedInputs === null) {
    return {
      issues: ["The extracted bridge inputs are outside supported ranges."],
      ok: false,
    };
  }

  const finalAnswer = analysis.finalAnswers.find(
    (answer) => answer.name === "deployedLengthMeters",
  );
  if (finalAnswer?.value !== null && finalAnswer?.value !== undefined) {
    if (Math.abs(finalAnswer.value - deployedLengthMeters) > 0.001) {
      return {
        issues: ["The final bridge answer contradicts deployedLengthMeters."],
        ok: false,
      };
    }
    if (
      finalAnswer.unit !== null &&
      !METERS.has(finalAnswer.unit.toLowerCase())
    ) {
      return { issues: ["The bridge answer unit must be meters."], ok: false };
    }
  }

  if (
    fractionAsDecimal !== null &&
    Math.abs(
      HERO_BRIDGE_PARAMETERS.kitLengthMeters * fractionAsDecimal -
        deployedLengthMeters,
    ) > 0.011
  ) {
    return {
      issues: [
        "The extracted decimal and bridge length contradict the visible multiplication.",
      ],
      ok: false,
    };
  }

  const deterministicVerdict = parsedInputs.isMathematicallyCorrect
    ? "correct"
    : "incorrect";
  return {
    ok: true,
    value: {
      analysis,
      disagreement: analysis.verdict !== deterministicVerdict,
      inputs,
      outcome: parsedInputs,
    },
  };
}

export function semanticRepairMessage(issues: readonly string[]): string {
  return `The prior structured result failed deterministic validation: ${issues
    .slice(0, 3)
    .join(
      " ",
    )} Re-read the image and return a corrected result using the same schema.`;
}
