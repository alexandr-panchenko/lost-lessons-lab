import { z } from "zod";

import {
  BridgeSimulationInputsSchema,
  type BridgeOutcome,
} from "./domain/bridge";
import { WaterSimulationInputsSchema, type WaterOutcome } from "./domain/water";

const BoundedTextSchema = z.string().trim().min(1).max(320);

export const TaskPlanSchema = z
  .object({
    parameterCandidate: z
      .record(
        z.string().min(1).max(64),
        z.union([z.number(), z.string(), z.boolean()]),
      )
      .nullable(),
    schemaVersion: z.literal("task-plan.v1"),
    skillId: z.string().min(1).max(80).nullable(),
    suggestedAlternatives: z.array(z.string().min(1).max(120)).max(6),
    supportStatus: z.enum(["supported", "unsupported"]),
    templateId: z.string().min(1).max(80).nullable(),
    wording: z.string().min(1).max(600).nullable(),
  })
  .strict();
export type TaskPlan = z.infer<typeof TaskPlanSchema>;

const AnalysisStepSchema = z
  .object({
    normalizedExpression: z.string().trim().min(1).max(180).nullable(),
    regionId: z.string().trim().min(1).max(64).nullable(),
    status: z.enum(["valid", "suspected_error", "uncertain"]),
    text: z.string().trim().min(1).max(280),
  })
  .strict();

const FinalAnswerSchema = z
  .object({
    name: z.literal("deployedLengthMeters"),
    unit: z.enum(["m", "meter", "meters", "metre", "metres"]).nullable(),
    value: z.number().finite().nullable(),
  })
  .strict();

export const SolutionAnalysisSchema = z
  .object({
    confidence: z.number().finite().min(0).max(1),
    finalAnswers: z.array(FinalAnswerSchema).max(8),
    firstError: z
      .object({
        regionId: z.string().trim().min(1).max(64).nullable(),
        summary: BoundedTextSchema,
      })
      .strict()
      .nullable(),
    scenarioInputs: z
      .object({
        deployedLengthMeters: z.number().finite().nullable(),
        fractionAsDecimal: z.number().finite().nullable(),
      })
      .strict(),
    schemaVersion: z.literal("solution-analysis.v1"),
    steps: z.array(AnalysisStepSchema).max(12),
    studentFacingExplanation: z.string().trim().min(1).max(420),
    transcription: z.string().trim().min(1).max(1200),
    verdict: z.enum(["correct", "incorrect", "ambiguous", "unreadable"]),
  })
  .strict();
export type SolutionAnalysis = z.infer<typeof SolutionAnalysisSchema>;

const WaterFinalAnswerSchema = z
  .object({
    name: z.literal("volumeLiters"),
    unit: z.enum(["L", "liter", "liters", "litre", "litres"]).nullable(),
    value: z.number().finite().nullable(),
  })
  .strict();

export const WaterSolutionAnalysisSchema = SolutionAnalysisSchema.omit({
  finalAnswers: true,
  scenarioInputs: true,
}).extend({
  finalAnswers: z.array(WaterFinalAnswerSchema).max(8),
  scenarioInputs: z
    .object({
      flowRateLitersPerMinute: z.number().finite().nullable(),
      timeMinutes: z.number().finite().nullable(),
      volumeLiters: z.number().finite().nullable(),
    })
    .strict(),
});
export type WaterSolutionAnalysis = z.infer<typeof WaterSolutionAnalysisSchema>;

export const AnySolutionAnalysisSchema = z.union([
  SolutionAnalysisSchema,
  WaterSolutionAnalysisSchema,
]);
export type AnySolutionAnalysis = z.infer<typeof AnySolutionAnalysisSchema>;

export const SOLUTION_ANALYSIS_JSON_SCHEMA = {
  additionalProperties: false,
  properties: {
    confidence: { maximum: 1, minimum: 0, type: "number" },
    finalAnswers: {
      items: {
        additionalProperties: false,
        properties: {
          name: { const: "deployedLengthMeters", type: "string" },
          unit: {
            anyOf: [
              {
                enum: ["m", "meter", "meters", "metre", "metres"],
                type: "string",
              },
              { type: "null" },
            ],
          },
          value: { anyOf: [{ type: "number" }, { type: "null" }] },
        },
        required: ["name", "value", "unit"],
        type: "object",
      },
      maxItems: 8,
      type: "array",
    },
    firstError: {
      anyOf: [
        {
          additionalProperties: false,
          properties: {
            regionId: {
              anyOf: [
                { maxLength: 64, minLength: 1, type: "string" },
                { type: "null" },
              ],
            },
            summary: { maxLength: 320, minLength: 1, type: "string" },
          },
          required: ["summary", "regionId"],
          type: "object",
        },
        { type: "null" },
      ],
    },
    scenarioInputs: {
      additionalProperties: false,
      properties: {
        deployedLengthMeters: {
          anyOf: [{ type: "number" }, { type: "null" }],
          description:
            "The final bridge length written by the learner, such as 4.08 or 9. It must match their visible multiplication result; use null if absent.",
        },
        fractionAsDecimal: {
          anyOf: [{ type: "number" }, { type: "null" }],
          description:
            "The learner's written decimal conversion of 3/4, such as 0.34 or 0.75. Extract what is written rather than correcting it; use null if absent.",
        },
      },
      required: ["deployedLengthMeters", "fractionAsDecimal"],
      type: "object",
    },
    schemaVersion: { const: "solution-analysis.v1", type: "string" },
    steps: {
      items: {
        additionalProperties: false,
        properties: {
          normalizedExpression: {
            anyOf: [
              { maxLength: 180, minLength: 1, type: "string" },
              { type: "null" },
            ],
          },
          regionId: {
            anyOf: [
              { maxLength: 64, minLength: 1, type: "string" },
              { type: "null" },
            ],
          },
          status: {
            enum: ["valid", "suspected_error", "uncertain"],
            type: "string",
          },
          text: { maxLength: 280, minLength: 1, type: "string" },
        },
        required: ["text", "normalizedExpression", "regionId", "status"],
        type: "object",
      },
      maxItems: 12,
      type: "array",
    },
    studentFacingExplanation: {
      maxLength: 420,
      minLength: 1,
      type: "string",
    },
    transcription: { maxLength: 1200, minLength: 1, type: "string" },
    verdict: {
      enum: ["correct", "incorrect", "ambiguous", "unreadable"],
      type: "string",
    },
  },
  required: [
    "schemaVersion",
    "transcription",
    "steps",
    "finalAnswers",
    "scenarioInputs",
    "verdict",
    "firstError",
    "confidence",
    "studentFacingExplanation",
  ],
  type: "object",
} as const;

export const WATER_SOLUTION_ANALYSIS_JSON_SCHEMA = {
  ...SOLUTION_ANALYSIS_JSON_SCHEMA,
  properties: {
    ...SOLUTION_ANALYSIS_JSON_SCHEMA.properties,
    finalAnswers: {
      items: {
        additionalProperties: false,
        properties: {
          name: { const: "volumeLiters", type: "string" },
          unit: {
            anyOf: [
              {
                enum: ["L", "liter", "liters", "litre", "litres"],
                type: "string",
              },
              { type: "null" },
            ],
          },
          value: { anyOf: [{ type: "number" }, { type: "null" }] },
        },
        required: ["name", "value", "unit"],
        type: "object",
      },
      maxItems: 8,
      type: "array",
    },
    scenarioInputs: {
      additionalProperties: false,
      properties: {
        flowRateLitersPerMinute: {
          anyOf: [{ type: "number" }, { type: "null" }],
          description:
            "The flow rate written by the learner, in liters per minute.",
        },
        timeMinutes: {
          anyOf: [{ type: "number" }, { type: "null" }],
          description: "The duration written by the learner, in minutes.",
        },
        volumeLiters: {
          anyOf: [{ type: "number" }, { type: "null" }],
          description: "The final volume written by the learner, in liters.",
        },
      },
      required: ["flowRateLitersPerMinute", "timeMinutes", "volumeLiters"],
      type: "object",
    },
  },
} as const;

export const AnalysisStatusSchema = z.enum([
  "uploading",
  "reading",
  "extracting",
  "validating",
  "preparing",
  "complete",
  "failed",
]);
export type AnalysisStatus = z.infer<typeof AnalysisStatusSchema>;

export const AnalysisFailureCategorySchema = z.enum([
  "ambiguous",
  "ai_disabled",
  "invalid_media",
  "media_storage",
  "rate_limited",
  "timeout",
  "upstream",
  "refusal",
  "invalid_schema",
  "semantic_invalid",
  "unreadable",
]);
export type AnalysisFailureCategory = z.infer<
  typeof AnalysisFailureCategorySchema
>;

export const AttemptMediaSchema = z
  .object({
    byteSize: z.number().int().positive(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
    contentType: z.literal("image/png"),
    height: z.number().int().positive(),
    id: z.string().min(8).max(128),
    width: z.number().int().positive(),
  })
  .strict();
export type AttemptMedia = z.infer<typeof AttemptMediaSchema>;

export const AiAttemptSchema = z
  .object({
    authorId: z.string().min(8).max(128),
    createdAt: z.string(),
    id: z.string().min(8).max(128),
    media: AttemptMediaSchema.nullable(),
    mode: z.literal("ai"),
    roomSeq: z.number().int().positive(),
    sourceCanvasSeq: z.number().int().nonnegative(),
    status: AnalysisStatusSchema,
    taskId: z.enum(["bridge-task-v1", "water-task-v1"]),
  })
  .strict();
export type AiAttempt = z.infer<typeof AiAttemptSchema>;

export const AnalysisRecordSchema = z
  .object({
    attemptId: z.string().min(8).max(128),
    completedAt: z.string(),
    disagreement: z.boolean(),
    failureCategory: AnalysisFailureCategorySchema.nullable(),
    latencyMs: z.number().int().nonnegative(),
    modelId: z.string().min(1).max(80).nullable(),
    responseId: z.string().min(1).max(160).nullable(),
    result: AnySolutionAnalysisSchema.nullable(),
    usedRepair: z.boolean(),
  })
  .strict();
export type AnalysisRecord = z.infer<typeof AnalysisRecordSchema>;

export type ValidatedBridgeAnalysis = {
  analysis: SolutionAnalysis;
  disagreement: boolean;
  inputs: z.infer<typeof BridgeSimulationInputsSchema>;
  outcome: BridgeOutcome;
};

export type ValidatedWaterAnalysis = {
  analysis: WaterSolutionAnalysis;
  disagreement: boolean;
  inputs: z.infer<typeof WaterSimulationInputsSchema>;
  outcome: WaterOutcome;
};
