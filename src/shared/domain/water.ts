import { z } from "zod";

export const WaterTaskParametersSchema = z
  .object({
    capacityLiters: z.number().finite().positive().max(100),
    flowRateLitersPerMinute: z.number().finite().positive().max(20),
    presentationVariant: z.literal("tank-splash-v1"),
    timeMinutes: z.number().finite().positive().max(30),
  })
  .strict();
export type WaterTaskParameters = z.infer<typeof WaterTaskParametersSchema>;

export const WaterSimulationInputsSchema = z
  .object({
    flowRateLitersPerMinute: z
      .number()
      .finite()
      .positive()
      .max(20)
      .nullable()
      .optional(),
    timeMinutes: z.number().finite().positive().max(30).nullable().optional(),
    volumeLiters: z.number().finite().nonnegative().max(120),
  })
  .strict();
export type WaterSimulationInputs = z.infer<typeof WaterSimulationInputsSchema>;

export const WaterResultClassSchema = z.enum([
  "water_underfill",
  "water_correct",
  "water_overfill",
  "water_overflow",
]);
export type WaterResultClass = z.infer<typeof WaterResultClassSchema>;

export const WaterOutcomeSchema = z
  .object({
    correctInputs: z.object({ volumeLiters: z.number() }).strict(),
    errorMagnitude: z.number().nonnegative(),
    explanationData: z
      .object({
        capacityLiters: z.number(),
        expectedVolumeLiters: z.number(),
        submittedVolumeLiters: z.number(),
      })
      .strict(),
    fillRatio: z.number().nonnegative(),
    isMathematicallyCorrect: z.boolean(),
    resultClass: WaterResultClassSchema,
    submittedInputs: WaterSimulationInputsSchema,
  })
  .strict();
export type WaterOutcome = z.infer<typeof WaterOutcomeSchema>;

export function deriveWaterVolume(parameters: WaterTaskParameters): number {
  const parsed = WaterTaskParametersSchema.parse(parameters);
  return parsed.flowRateLitersPerMinute * parsed.timeMinutes;
}

export function classifyWaterInput(
  parameters: WaterTaskParameters,
  input: WaterSimulationInputs,
): WaterOutcome {
  const parsedParameters = WaterTaskParametersSchema.parse(parameters);
  const parsedInput = WaterSimulationInputsSchema.parse(input);
  const correctVolume = deriveWaterVolume(parsedParameters);
  const errorMagnitude = Math.abs(parsedInput.volumeLiters - correctVolume);
  const isMathematicallyCorrect = errorMagnitude <= 0.01;
  const resultClass: WaterResultClass = isMathematicallyCorrect
    ? "water_correct"
    : parsedInput.volumeLiters < correctVolume
      ? "water_underfill"
      : parsedInput.volumeLiters > parsedParameters.capacityLiters
        ? "water_overflow"
        : "water_overfill";

  return {
    correctInputs: { volumeLiters: correctVolume },
    errorMagnitude,
    explanationData: {
      capacityLiters: parsedParameters.capacityLiters,
      expectedVolumeLiters: correctVolume,
      submittedVolumeLiters: parsedInput.volumeLiters,
    },
    fillRatio: parsedInput.volumeLiters / parsedParameters.capacityLiters,
    isMathematicallyCorrect,
    resultClass,
    submittedInputs: parsedInput,
  };
}
