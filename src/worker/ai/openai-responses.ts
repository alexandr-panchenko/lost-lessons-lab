import { z } from "zod";

import { bridgeRoomFixture } from "../../../fixtures/judge-v1/fixture";
import type { WaterFixturePack } from "../../../fixtures/water/packs";
import type { SpeedFixturePack } from "../../../fixtures/speed/packs";
import {
  SPEED_SOLUTION_ANALYSIS_JSON_SCHEMA,
  SpeedSolutionAnalysisSchema,
  SOLUTION_ANALYSIS_JSON_SCHEMA,
  SolutionAnalysisSchema,
  WATER_SOLUTION_ANALYSIS_JSON_SCHEMA,
  WaterSolutionAnalysisSchema,
  type AnalysisFailureCategory,
  type ValidatedBridgeAnalysis,
  type ValidatedSpeedAnalysis,
  type ValidatedWaterAnalysis,
} from "../../shared/analysis-types";
import {
  semanticRepairMessage,
  validateBridgeAnalysis,
} from "../../shared/validation/bridge-analysis";
import { validateWaterAnalysis } from "../../shared/validation/water-analysis";
import { validateSpeedAnalysis } from "../../shared/validation/speed-analysis";

const AiConfigurationSchema = z
  .object({
    AI_ENABLED: z.enum(["true", "false"]),
    AI_MAX_RETRIES: z.coerce.number().int().min(0).max(1),
    AI_TIMEOUT_MS: z.coerce.number().int().min(3_000).max(60_000),
    OPENAI_API_KEY: z.string().min(20).optional(),
    OPENAI_MODEL: z.literal("gpt-5.6"),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.AI_ENABLED === "true" && value.OPENAI_API_KEY === undefined) {
      context.addIssue({
        code: "custom",
        message: "OPENAI_API_KEY is required when AI_ENABLED=true",
        path: ["OPENAI_API_KEY"],
      });
    }
  });

export type AiConfiguration = z.infer<typeof AiConfigurationSchema>;

export function parseAiConfiguration(env: {
  AI_ENABLED?: string;
  AI_MAX_RETRIES?: string;
  AI_TIMEOUT_MS?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
}): AiConfiguration {
  return AiConfigurationSchema.parse({
    AI_ENABLED: env.AI_ENABLED ?? "false",
    AI_MAX_RETRIES: env.AI_MAX_RETRIES ?? "1",
    AI_TIMEOUT_MS: env.AI_TIMEOUT_MS ?? "24000",
    ...(env.OPENAI_API_KEY === undefined
      ? {}
      : { OPENAI_API_KEY: env.OPENAI_API_KEY }),
    OPENAI_MODEL: env.OPENAI_MODEL ?? "gpt-5.6",
  });
}

export type OpenAiSolutionRequest = {
  input: Array<{
    content: Array<
      | { text: string; type: "input_text" }
      | { detail: "high"; image_url: string; type: "input_image" }
    >;
    role: "user";
  }>;
  max_output_tokens: number;
  model: "gpt-5.6";
  reasoning: { effort: "low" };
  safety_identifier: string;
  store: false;
  text: {
    format: {
      name:
        | "solution_analysis_v1"
        | "water_solution_analysis_v1"
        | "speed_solution_analysis_v1";
      schema:
        | typeof SOLUTION_ANALYSIS_JSON_SCHEMA
        | typeof WATER_SOLUTION_ANALYSIS_JSON_SCHEMA
        | typeof SPEED_SOLUTION_ANALYSIS_JSON_SCHEMA;
      strict: true;
      type: "json_schema";
    };
  };
};

const BASE_INSTRUCTION = `Read only the learner handwriting in the image and interpret it for this exact task:
${bridgeRoomFixture.prompt}

Return solution-analysis.v1. Transcribe visible work faithfully. For fractionAsDecimal, extract the learner's written decimal conversion, not a corrected value. For deployedLengthMeters, extract the learner's written multiplication result, not a recomputed value. Those two extracted numbers must reflect the same visible line of work. Use finalAnswers name deployedLengthMeters and normalize a visible meter unit to one of the schema values. Identify the likely first mathematical error without shaming the learner. Do not decide simulation correctness; deterministic code will check the extracted values. Use null for a value that is not visible. Mark the result ambiguous or unreadable when appropriate.`;

function waterInstruction(fixture: WaterFixturePack): string {
  return `Read only the learner handwriting in the image and interpret it for this exact task:
${fixture.prompt}

Return solution-analysis.v1. Transcribe visible work faithfully. Extract the learner's written flow rate, time, and final volume without correcting them. Use finalAnswers name volumeLiters and normalize a visible liter unit to one of the schema values. Identify the likely first mathematical error without shaming the learner. Do not decide simulation correctness; deterministic code will check the values against the curated task parameters. Use null for a value that is not visible. Mark the result ambiguous or unreadable when appropriate.`;
}

function speedInstruction(fixture: SpeedFixturePack): string {
  return `Read only the learner handwriting in the image and interpret it for this exact task:
${fixture.prompt}

Return solution-analysis.v1. Transcribe visible work faithfully. Extract the learner's written speed, time, and final distance without correcting them. Use finalAnswers name distanceMeters and normalize a visible meter unit to one of the schema values. Identify the likely first mathematical error without shaming the learner. Do not decide simulation correctness; deterministic code will check the values against the curated task parameters. Use null for a value that is not visible. Mark the result ambiguous or unreadable when appropriate.`;
}

export function buildOpenAiSolutionRequest(input: {
  imageBase64: string;
  repairInstruction?: string;
  safetyIdentifier: string;
  template?: "bridge" | "water" | "speed";
  waterFixture?: WaterFixturePack;
  speedFixture?: SpeedFixturePack;
}): OpenAiSolutionRequest {
  const template = input.template ?? "bridge";
  if (template === "water" && input.waterFixture === undefined) {
    throw new Error("A curated water fixture is required");
  }
  if (template === "speed" && input.speedFixture === undefined) {
    throw new Error("A curated speed fixture is required");
  }
  const baseInstruction =
    template === "water"
      ? waterInstruction(input.waterFixture as WaterFixturePack)
      : template === "speed"
        ? speedInstruction(input.speedFixture as SpeedFixturePack)
        : BASE_INSTRUCTION;
  const instruction = input.repairInstruction
    ? `${baseInstruction}\n\n${input.repairInstruction}`
    : baseInstruction;
  return {
    input: [
      {
        content: [
          { text: instruction, type: "input_text" },
          {
            detail: "high",
            image_url: `data:image/png;base64,${input.imageBase64}`,
            type: "input_image",
          },
        ],
        role: "user",
      },
    ],
    max_output_tokens: 1_400,
    model: "gpt-5.6",
    reasoning: { effort: "low" },
    safety_identifier: input.safetyIdentifier,
    store: false,
    text: {
      format: {
        name:
          template === "water"
            ? "water_solution_analysis_v1"
            : template === "speed"
              ? "speed_solution_analysis_v1"
              : "solution_analysis_v1",
        schema:
          template === "water"
            ? WATER_SOLUTION_ANALYSIS_JSON_SCHEMA
            : template === "speed"
              ? SPEED_SOLUTION_ANALYSIS_JSON_SCHEMA
              : SOLUTION_ANALYSIS_JSON_SCHEMA,
        strict: true,
        type: "json_schema",
      },
    },
  };
}

const OpenAiResponseSchema = z
  .object({
    id: z.string().min(1),
    model: z.string().min(1),
    output: z.array(
      z
        .object({
          content: z
            .array(
              z
                .object({
                  refusal: z.string().optional(),
                  text: z.string().optional(),
                  type: z.string(),
                })
                .loose(),
            )
            .optional(),
          type: z.string(),
        })
        .loose(),
    ),
    usage: z
      .object({
        input_tokens: z.number().int().nonnegative().optional(),
        output_tokens: z.number().int().nonnegative().optional(),
        total_tokens: z.number().int().nonnegative().optional(),
      })
      .loose()
      .optional(),
  })
  .loose();

export type OpenAiUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type SolutionAnalysisRunResult =
  | {
      latencyMs: number;
      modelId: string;
      ok: true;
      responseId: string;
      usage: OpenAiUsage;
      usedRepair: boolean;
      validated: ValidatedBridgeAnalysis;
    }
  | {
      category: AnalysisFailureCategory;
      diagnostic?: string;
      latencyMs: number;
      ok: false;
      upstreamStatus?: number;
      usedRepair: boolean;
      validationIssues?: string[];
    };

export type WaterSolutionAnalysisRunResult =
  | {
      latencyMs: number;
      modelId: string;
      ok: true;
      responseId: string;
      usage: OpenAiUsage;
      usedRepair: boolean;
      validated: ValidatedWaterAnalysis;
    }
  | {
      category: AnalysisFailureCategory;
      diagnostic?: string;
      latencyMs: number;
      ok: false;
      upstreamStatus?: number;
      usedRepair: boolean;
      validationIssues?: string[];
    };

export type SpeedSolutionAnalysisRunResult =
  | {
      latencyMs: number;
      modelId: string;
      ok: true;
      responseId: string;
      usage: OpenAiUsage;
      usedRepair: boolean;
      validated: ValidatedSpeedAnalysis;
    }
  | {
      category: AnalysisFailureCategory;
      diagnostic?: string;
      latencyMs: number;
      ok: false;
      upstreamStatus?: number;
      usedRepair: boolean;
      validationIssues?: string[];
    };

class UpstreamFailure extends Error {
  constructor(
    readonly retriable: boolean,
    readonly category: AnalysisFailureCategory = "upstream",
    readonly status?: number,
    readonly diagnostic?: string,
  ) {
    super(category);
  }
}

function outputText(response: z.infer<typeof OpenAiResponseSchema>): string {
  for (const item of response.output) {
    for (const content of item.content ?? []) {
      if (content.type === "refusal" || content.refusal !== undefined) {
        throw new UpstreamFailure(false, "refusal");
      }
      if (content.type === "output_text" && content.text !== undefined) {
        return content.text;
      }
    }
  }
  throw new UpstreamFailure(false, "invalid_schema");
}

function usage(response: z.infer<typeof OpenAiResponseSchema>): OpenAiUsage {
  return {
    ...(response.usage?.input_tokens === undefined
      ? {}
      : { inputTokens: response.usage.input_tokens }),
    ...(response.usage?.output_tokens === undefined
      ? {}
      : { outputTokens: response.usage.output_tokens }),
    ...(response.usage?.total_tokens === undefined
      ? {}
      : { totalTokens: response.usage.total_tokens }),
  };
}

async function requestOnce(input: {
  apiKey: string;
  fetchImpl: typeof fetch;
  imageBase64: string;
  repairInstruction?: string;
  safetyIdentifier: string;
  signal: AbortSignal;
  template?: "bridge" | "water" | "speed";
  waterFixture?: WaterFixturePack;
  speedFixture?: SpeedFixturePack;
}): Promise<{
  modelId: string;
  responseId: string;
  result: unknown;
  usage: OpenAiUsage;
}> {
  let response: Response;
  try {
    response = await input.fetchImpl("https://api.openai.com/v1/responses", {
      body: JSON.stringify(buildOpenAiSolutionRequest(input)),
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: input.signal,
    });
  } catch (error) {
    if (input.signal.aborted) throw new UpstreamFailure(false, "timeout");
    const diagnostic =
      error instanceof Error
        ? `${error.name}:${error.message}`.slice(0, 180)
        : "unknown-fetch-error";
    throw new UpstreamFailure(true, "upstream", undefined, diagnostic);
  }
  if (!response.ok) {
    throw new UpstreamFailure(
      response.status === 429 || response.status >= 500,
      response.status === 429 ? "rate_limited" : "upstream",
      response.status,
    );
  }
  const parsed = OpenAiResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new UpstreamFailure(false, "invalid_schema");
  const text = outputText(parsed.data);
  let result: unknown;
  try {
    result = JSON.parse(text) as unknown;
  } catch {
    throw new UpstreamFailure(false, "invalid_schema");
  }
  return {
    modelId: parsed.data.model,
    responseId: parsed.data.id,
    result,
    usage: usage(parsed.data),
  };
}

export async function analyzeBridgeSolution(input: {
  config: AiConfiguration;
  fetchImpl?: typeof fetch;
  imageBase64: string;
  onStage?: (
    stage: "reading" | "extracting" | "validating",
  ) => Promise<void> | void;
  safetyIdentifier: string;
}): Promise<SolutionAnalysisRunResult> {
  const startedAt = Date.now();
  if (
    input.config.AI_ENABLED !== "true" ||
    input.config.OPENAI_API_KEY === undefined
  ) {
    return {
      category: "ai_disabled",
      latencyMs: 0,
      ok: false,
      usedRepair: false,
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    input.config.AI_TIMEOUT_MS,
  );
  const fetchImpl: typeof fetch =
    input.fetchImpl ?? ((resource, init) => globalThis.fetch(resource, init));
  let repairInstruction: string | undefined;
  let usedRepair = false;

  try {
    for (
      let attempt = 0;
      attempt <= input.config.AI_MAX_RETRIES;
      attempt += 1
    ) {
      await input.onStage?.("reading");
      try {
        const response = await requestOnce({
          apiKey: input.config.OPENAI_API_KEY,
          fetchImpl,
          imageBase64: input.imageBase64,
          ...(repairInstruction === undefined ? {} : { repairInstruction }),
          safetyIdentifier: input.safetyIdentifier,
          signal: controller.signal,
        });
        await input.onStage?.("extracting");
        const schema = SolutionAnalysisSchema.safeParse(response.result);
        if (!schema.success) {
          if (attempt >= input.config.AI_MAX_RETRIES) {
            return {
              category: "invalid_schema",
              latencyMs: Date.now() - startedAt,
              ok: false,
              usedRepair,
            };
          }
          repairInstruction =
            "The prior result did not match the required strict schema. Return every required field with no additional fields.";
          usedRepair = true;
          continue;
        }
        if (schema.data.verdict === "unreadable") {
          return {
            category: "unreadable",
            latencyMs: Date.now() - startedAt,
            ok: false,
            usedRepair,
          };
        }
        if (schema.data.verdict === "ambiguous") {
          return {
            category: "ambiguous",
            latencyMs: Date.now() - startedAt,
            ok: false,
            usedRepair,
          };
        }
        await input.onStage?.("validating");
        const semantic = validateBridgeAnalysis(schema.data);
        if (semantic.ok) {
          return {
            latencyMs: Date.now() - startedAt,
            modelId: response.modelId,
            ok: true,
            responseId: response.responseId,
            usage: response.usage,
            usedRepair,
            validated: semantic.value,
          };
        }
        if (attempt >= input.config.AI_MAX_RETRIES) {
          return {
            category: "semantic_invalid",
            latencyMs: Date.now() - startedAt,
            ok: false,
            usedRepair,
            validationIssues: semantic.issues,
          };
        }
        repairInstruction = semanticRepairMessage(semantic.issues);
        usedRepair = true;
      } catch (error) {
        const upstream =
          error instanceof UpstreamFailure
            ? error
            : new UpstreamFailure(false, "upstream");
        if (!upstream.retriable || attempt >= input.config.AI_MAX_RETRIES) {
          return {
            category: upstream.category,
            ...(upstream.diagnostic === undefined
              ? {}
              : { diagnostic: upstream.diagnostic }),
            latencyMs: Date.now() - startedAt,
            ok: false,
            ...(upstream.status === undefined
              ? {}
              : { upstreamStatus: upstream.status }),
            usedRepair,
          };
        }
        usedRepair = true;
      }
    }
    return {
      category: "upstream",
      latencyMs: Date.now() - startedAt,
      ok: false,
      usedRepair,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeWaterSolution(input: {
  config: AiConfiguration;
  fetchImpl?: typeof fetch;
  fixture: WaterFixturePack;
  imageBase64: string;
  onStage?: (
    stage: "reading" | "extracting" | "validating",
  ) => Promise<void> | void;
  safetyIdentifier: string;
}): Promise<WaterSolutionAnalysisRunResult> {
  const startedAt = Date.now();
  if (
    input.config.AI_ENABLED !== "true" ||
    input.config.OPENAI_API_KEY === undefined
  ) {
    return {
      category: "ai_disabled",
      latencyMs: 0,
      ok: false,
      usedRepair: false,
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    input.config.AI_TIMEOUT_MS,
  );
  const fetchImpl: typeof fetch =
    input.fetchImpl ?? ((resource, init) => globalThis.fetch(resource, init));
  let repairInstruction: string | undefined;
  let usedRepair = false;

  try {
    for (
      let attempt = 0;
      attempt <= input.config.AI_MAX_RETRIES;
      attempt += 1
    ) {
      await input.onStage?.("reading");
      try {
        const response = await requestOnce({
          apiKey: input.config.OPENAI_API_KEY,
          fetchImpl,
          imageBase64: input.imageBase64,
          ...(repairInstruction === undefined ? {} : { repairInstruction }),
          safetyIdentifier: input.safetyIdentifier,
          signal: controller.signal,
          template: "water",
          waterFixture: input.fixture,
        });
        await input.onStage?.("extracting");
        const schema = WaterSolutionAnalysisSchema.safeParse(response.result);
        if (!schema.success) {
          if (attempt >= input.config.AI_MAX_RETRIES) {
            return {
              category: "invalid_schema",
              latencyMs: Date.now() - startedAt,
              ok: false,
              usedRepair,
            };
          }
          repairInstruction =
            "The prior result did not match the required strict water schema. Return every required field with no additional fields.";
          usedRepair = true;
          continue;
        }
        if (schema.data.verdict === "unreadable") {
          return {
            category: "unreadable",
            latencyMs: Date.now() - startedAt,
            ok: false,
            usedRepair,
          };
        }
        if (schema.data.verdict === "ambiguous") {
          return {
            category: "ambiguous",
            latencyMs: Date.now() - startedAt,
            ok: false,
            usedRepair,
          };
        }
        await input.onStage?.("validating");
        const semantic = validateWaterAnalysis(
          schema.data,
          input.fixture.parameters,
        );
        if (semantic.ok) {
          return {
            latencyMs: Date.now() - startedAt,
            modelId: response.modelId,
            ok: true,
            responseId: response.responseId,
            usage: response.usage,
            usedRepair,
            validated: semantic.value,
          };
        }
        if (attempt >= input.config.AI_MAX_RETRIES) {
          return {
            category: "semantic_invalid",
            latencyMs: Date.now() - startedAt,
            ok: false,
            usedRepair,
            validationIssues: semantic.issues,
          };
        }
        repairInstruction = semanticRepairMessage(semantic.issues);
        usedRepair = true;
      } catch (error) {
        const upstream =
          error instanceof UpstreamFailure
            ? error
            : new UpstreamFailure(false, "upstream");
        if (!upstream.retriable || attempt >= input.config.AI_MAX_RETRIES) {
          return {
            category: upstream.category,
            ...(upstream.diagnostic === undefined
              ? {}
              : { diagnostic: upstream.diagnostic }),
            latencyMs: Date.now() - startedAt,
            ok: false,
            ...(upstream.status === undefined
              ? {}
              : { upstreamStatus: upstream.status }),
            usedRepair,
          };
        }
        usedRepair = true;
      }
    }
    return {
      category: "upstream",
      latencyMs: Date.now() - startedAt,
      ok: false,
      usedRepair,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeSpeedSolution(input: {
  config: AiConfiguration;
  fetchImpl?: typeof fetch;
  fixture: SpeedFixturePack;
  imageBase64: string;
  onStage?: (
    stage: "reading" | "extracting" | "validating",
  ) => Promise<void> | void;
  safetyIdentifier: string;
}): Promise<SpeedSolutionAnalysisRunResult> {
  const startedAt = Date.now();
  if (
    input.config.AI_ENABLED !== "true" ||
    input.config.OPENAI_API_KEY === undefined
  ) {
    return {
      category: "ai_disabled",
      latencyMs: 0,
      ok: false,
      usedRepair: false,
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    input.config.AI_TIMEOUT_MS,
  );
  const fetchImpl: typeof fetch =
    input.fetchImpl ?? ((resource, init) => globalThis.fetch(resource, init));
  let repairInstruction: string | undefined;
  let usedRepair = false;
  try {
    for (
      let attempt = 0;
      attempt <= input.config.AI_MAX_RETRIES;
      attempt += 1
    ) {
      await input.onStage?.("reading");
      try {
        const response = await requestOnce({
          apiKey: input.config.OPENAI_API_KEY,
          fetchImpl,
          imageBase64: input.imageBase64,
          ...(repairInstruction === undefined ? {} : { repairInstruction }),
          safetyIdentifier: input.safetyIdentifier,
          signal: controller.signal,
          speedFixture: input.fixture,
          template: "speed",
        });
        await input.onStage?.("extracting");
        const schema = SpeedSolutionAnalysisSchema.safeParse(response.result);
        if (!schema.success) {
          if (attempt >= input.config.AI_MAX_RETRIES) {
            return {
              category: "invalid_schema",
              latencyMs: Date.now() - startedAt,
              ok: false,
              usedRepair,
            };
          }
          repairInstruction =
            "The prior result did not match the required strict speed schema. Return every required field with no additional fields.";
          usedRepair = true;
          continue;
        }
        if (
          schema.data.verdict === "unreadable" ||
          schema.data.verdict === "ambiguous"
        ) {
          return {
            category: schema.data.verdict,
            latencyMs: Date.now() - startedAt,
            ok: false,
            usedRepair,
          };
        }
        await input.onStage?.("validating");
        const semantic = validateSpeedAnalysis(
          schema.data,
          input.fixture.parameters,
        );
        if (semantic.ok) {
          return {
            latencyMs: Date.now() - startedAt,
            modelId: response.modelId,
            ok: true,
            responseId: response.responseId,
            usage: response.usage,
            usedRepair,
            validated: semantic.value,
          };
        }
        if (attempt >= input.config.AI_MAX_RETRIES) {
          return {
            category: "semantic_invalid",
            latencyMs: Date.now() - startedAt,
            ok: false,
            usedRepair,
            validationIssues: semantic.issues,
          };
        }
        repairInstruction = semanticRepairMessage(semantic.issues);
        usedRepair = true;
      } catch (error) {
        const upstream =
          error instanceof UpstreamFailure
            ? error
            : new UpstreamFailure(false, "upstream");
        if (!upstream.retriable || attempt >= input.config.AI_MAX_RETRIES) {
          return {
            category: upstream.category,
            ...(upstream.diagnostic === undefined
              ? {}
              : { diagnostic: upstream.diagnostic }),
            latencyMs: Date.now() - startedAt,
            ok: false,
            ...(upstream.status === undefined
              ? {}
              : { upstreamStatus: upstream.status }),
            usedRepair,
          };
        }
        usedRepair = true;
      }
    }
    return {
      category: "upstream",
      latencyMs: Date.now() - startedAt,
      ok: false,
      usedRepair,
    };
  } finally {
    clearTimeout(timer);
  }
}
