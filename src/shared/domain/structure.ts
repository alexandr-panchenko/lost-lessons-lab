import { z } from "zod";

export const StructureTaskParametersSchema = z
  .object({
    collapseThresholdKg: z.number().finite().positive().max(1000),
    itemCount: z.number().int().positive().max(50),
    presentationVariant: z.literal("platform-fragments-v1"),
    unitLoadKg: z.number().finite().positive().max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.itemCount * value.unitLoadKg >= value.collapseThresholdKg) {
      context.addIssue({
        code: "custom",
        message: "The correct load must remain below the collapse threshold.",
        path: ["collapseThresholdKg"],
      });
    }
  });
export type StructureTaskParameters = z.infer<
  typeof StructureTaskParametersSchema
>;

export const StructureSimulationInputsSchema = z
  .object({
    itemCount: z.number().int().positive().max(50).nullable().optional(),
    totalLoadKg: z.number().finite().nonnegative().max(1200),
    unitLoadKg: z.number().finite().positive().max(100).nullable().optional(),
  })
  .strict();
export type StructureSimulationInputs = z.infer<
  typeof StructureSimulationInputsSchema
>;

export const StructureResultClassSchema = z.enum([
  "structure_underload",
  "structure_stable",
  "structure_strained",
  "structure_collapse",
]);
export type StructureResultClass = z.infer<typeof StructureResultClassSchema>;

export const StructureOutcomeSchema = z
  .object({
    correctInputs: z.object({ totalLoadKg: z.number() }).strict(),
    errorMagnitude: z.number().nonnegative(),
    explanationData: z
      .object({
        collapseThresholdKg: z.number(),
        expectedLoadKg: z.number(),
        submittedLoadKg: z.number(),
      })
      .strict(),
    isMathematicallyCorrect: z.boolean(),
    loadRatio: z.number().nonnegative(),
    resultClass: StructureResultClassSchema,
    submittedInputs: StructureSimulationInputsSchema,
  })
  .strict();
export type StructureOutcome = z.infer<typeof StructureOutcomeSchema>;

export function deriveStructureLoad(
  parameters: StructureTaskParameters,
): number {
  const parsed = StructureTaskParametersSchema.parse(parameters);
  return parsed.itemCount * parsed.unitLoadKg;
}

export function classifyStructureInput(
  parameters: StructureTaskParameters,
  input: StructureSimulationInputs,
): StructureOutcome {
  const parsedParameters = StructureTaskParametersSchema.parse(parameters);
  const parsedInput = StructureSimulationInputsSchema.parse(input);
  const correctLoad = deriveStructureLoad(parsedParameters);
  const errorMagnitude = Math.abs(parsedInput.totalLoadKg - correctLoad);
  const isMathematicallyCorrect = errorMagnitude <= 0.01;
  const resultClass: StructureResultClass = isMathematicallyCorrect
    ? "structure_stable"
    : parsedInput.totalLoadKg < correctLoad
      ? "structure_underload"
      : parsedInput.totalLoadKg >= parsedParameters.collapseThresholdKg
        ? "structure_collapse"
        : "structure_strained";
  return {
    correctInputs: { totalLoadKg: correctLoad },
    errorMagnitude,
    explanationData: {
      collapseThresholdKg: parsedParameters.collapseThresholdKg,
      expectedLoadKg: correctLoad,
      submittedLoadKg: parsedInput.totalLoadKg,
    },
    isMathematicallyCorrect,
    loadRatio: parsedInput.totalLoadKg / parsedParameters.collapseThresholdKg,
    resultClass,
    submittedInputs: parsedInput,
  };
}
