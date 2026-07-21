import { z } from "zod";

export const BridgeTaskParametersSchema = z
  .object({
    denominator: z.number().int().positive().max(100),
    kitLengthMeters: z.number().finite().positive().max(1000),
    numerator: z.number().int().nonnegative().max(100),
    presentationVariant: z.literal("ravine-rescue-v1"),
  })
  .strict()
  .refine((value) => value.numerator <= value.denominator, {
    message: "The fraction cannot exceed one for this bridge kit.",
  });
export type BridgeTaskParameters = z.infer<typeof BridgeTaskParametersSchema>;

export const BridgeSimulationInputsSchema = z
  .object({
    deployedLengthMeters: z.number().finite().positive().max(24),
    fractionAsDecimal: z.number().finite().min(0).max(2).nullable().optional(),
  })
  .strict();
export type BridgeSimulationInputs = z.infer<
  typeof BridgeSimulationInputsSchema
>;

export const BridgeResultClassSchema = z.enum([
  "bridge_far_too_short",
  "bridge_slightly_short",
  "bridge_correct",
  "bridge_excessively_long",
]);
export type BridgeResultClass = z.infer<typeof BridgeResultClassSchema>;

export const BridgeOutcomeSchema = z
  .object({
    correctInputs: z
      .object({ deployedLengthMeters: z.number() })
      .strict()
      .optional(),
    errorMagnitude: z.number().nonnegative(),
    explanationData: z
      .object({
        deployedLengthMeters: z.number(),
        expectedLengthMeters: z.number(),
        kitLengthMeters: z.number(),
      })
      .strict()
      .optional(),
    isMathematicallyCorrect: z.boolean(),
    resultClass: BridgeResultClassSchema,
    submittedInputs: BridgeSimulationInputsSchema,
  })
  .strict();
export type BridgeOutcome = z.infer<typeof BridgeOutcomeSchema>;
export type ClassifiedBridgeOutcome = BridgeOutcome & {
  correctInputs: { deployedLengthMeters: number };
  explanationData: {
    deployedLengthMeters: number;
    expectedLengthMeters: number;
    kitLengthMeters: number;
  };
};

export const HERO_BRIDGE_PARAMETERS: BridgeTaskParameters = {
  denominator: 4,
  kitLengthMeters: 12,
  numerator: 3,
  presentationVariant: "ravine-rescue-v1",
};

export function deriveBridgeLength(parameters: BridgeTaskParameters): number {
  const parsed = BridgeTaskParametersSchema.parse(parameters);
  return parsed.kitLengthMeters * (parsed.numerator / parsed.denominator);
}

export function classifyBridgeInput(
  parameters: BridgeTaskParameters,
  input: BridgeSimulationInputs,
): ClassifiedBridgeOutcome {
  const parsedParameters = BridgeTaskParametersSchema.parse(parameters);
  const parsedInput = BridgeSimulationInputsSchema.parse(input);
  const correctLength = deriveBridgeLength(parsedParameters);
  const errorMagnitude = Math.abs(
    parsedInput.deployedLengthMeters - correctLength,
  );
  const isMathematicallyCorrect = errorMagnitude <= 0.005;
  let resultClass: BridgeResultClass;

  if (isMathematicallyCorrect) resultClass = "bridge_correct";
  else if (parsedInput.deployedLengthMeters < correctLength * 0.65)
    resultClass = "bridge_far_too_short";
  else if (parsedInput.deployedLengthMeters < correctLength)
    resultClass = "bridge_slightly_short";
  else resultClass = "bridge_excessively_long";

  return {
    correctInputs: { deployedLengthMeters: correctLength },
    errorMagnitude,
    explanationData: {
      deployedLengthMeters: parsedInput.deployedLengthMeters,
      expectedLengthMeters: correctLength,
      kitLengthMeters: parsedParameters.kitLengthMeters,
    },
    isMathematicallyCorrect,
    resultClass,
    submittedInputs: parsedInput,
  };
}
