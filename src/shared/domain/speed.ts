import { z } from "zod";

export const SpeedTaskParametersSchema = z
  .object({
    bumperDistanceMeters: z.number().finite().positive().max(200),
    presentationVariant: z.literal("shuttle-bumper-v1"),
    speedMetersPerSecond: z.number().finite().positive().max(40),
    timeSeconds: z.number().finite().positive().max(30),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.speedMetersPerSecond * value.timeSeconds >=
      value.bumperDistanceMeters
    ) {
      context.addIssue({
        code: "custom",
        message: "The correct destination must be before the bumper.",
        path: ["bumperDistanceMeters"],
      });
    }
  });
export type SpeedTaskParameters = z.infer<typeof SpeedTaskParametersSchema>;

export const SpeedSimulationInputsSchema = z
  .object({
    distanceMeters: z.number().finite().nonnegative().max(240),
    speedMetersPerSecond: z
      .number()
      .finite()
      .positive()
      .max(40)
      .nullable()
      .optional(),
    timeSeconds: z.number().finite().positive().max(30).nullable().optional(),
  })
  .strict();
export type SpeedSimulationInputs = z.infer<typeof SpeedSimulationInputsSchema>;

export const SpeedResultClassSchema = z.enum([
  "speed_short",
  "speed_correct",
  "speed_overshoot",
  "speed_collision",
]);
export type SpeedResultClass = z.infer<typeof SpeedResultClassSchema>;

export const SpeedOutcomeSchema = z
  .object({
    correctInputs: z.object({ distanceMeters: z.number() }).strict(),
    errorMagnitude: z.number().nonnegative(),
    explanationData: z
      .object({
        bumperDistanceMeters: z.number(),
        expectedDistanceMeters: z.number(),
        submittedDistanceMeters: z.number(),
      })
      .strict(),
    isMathematicallyCorrect: z.boolean(),
    resultClass: SpeedResultClassSchema,
    submittedInputs: SpeedSimulationInputsSchema,
    travelRatio: z.number().nonnegative(),
  })
  .strict();
export type SpeedOutcome = z.infer<typeof SpeedOutcomeSchema>;

export function deriveTravelDistance(parameters: SpeedTaskParameters): number {
  const parsed = SpeedTaskParametersSchema.parse(parameters);
  return parsed.speedMetersPerSecond * parsed.timeSeconds;
}

export function classifySpeedInput(
  parameters: SpeedTaskParameters,
  input: SpeedSimulationInputs,
): SpeedOutcome {
  const parsedParameters = SpeedTaskParametersSchema.parse(parameters);
  const parsedInput = SpeedSimulationInputsSchema.parse(input);
  const correctDistance = deriveTravelDistance(parsedParameters);
  const errorMagnitude = Math.abs(parsedInput.distanceMeters - correctDistance);
  const isMathematicallyCorrect = errorMagnitude <= 0.01;
  const resultClass: SpeedResultClass = isMathematicallyCorrect
    ? "speed_correct"
    : parsedInput.distanceMeters < correctDistance
      ? "speed_short"
      : parsedInput.distanceMeters >= parsedParameters.bumperDistanceMeters
        ? "speed_collision"
        : "speed_overshoot";
  return {
    correctInputs: { distanceMeters: correctDistance },
    errorMagnitude,
    explanationData: {
      bumperDistanceMeters: parsedParameters.bumperDistanceMeters,
      expectedDistanceMeters: correctDistance,
      submittedDistanceMeters: parsedInput.distanceMeters,
    },
    isMathematicallyCorrect,
    resultClass,
    submittedInputs: parsedInput,
    travelRatio:
      parsedInput.distanceMeters / parsedParameters.bumperDistanceMeters,
  };
}
