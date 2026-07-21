import { z } from "zod";

import { AnalysisFailureCategorySchema } from "../../shared/analysis-types";

const AnalysisLogSchema = z
  .object({
    attemptId: z.string().min(8).max(128),
    category: AnalysisFailureCategorySchema.optional(),
    errorClass: z
      .string()
      .regex(/^[A-Za-z][A-Za-z0-9]*Error$/u)
      .optional(),
    event: z.enum(["analysis.completed", "analysis.failed"]),
    latencyMs: z.number().int().nonnegative().max(120_000),
    modelId: z.string().min(1).max(80).optional(),
    responseId: z.string().min(1).max(160).optional(),
    roomHash: z.string().regex(/^[a-f0-9]{24}$/u),
    upstreamStatus: z.number().int().min(100).max(599).optional(),
    usedRepair: z.boolean(),
  })
  .strict();

type AnalysisLog = z.input<typeof AnalysisLogSchema>;

export function safeErrorClass(
  diagnostic: string | undefined,
): string | undefined {
  if (diagnostic === undefined) return undefined;
  const match = /^([A-Za-z][A-Za-z0-9]*Error)(?::|$)/u.exec(diagnostic);
  return match?.[1];
}

export function logAnalysisMetadata(event: AnalysisLog): void {
  const parsed = AnalysisLogSchema.safeParse(event);
  if (!parsed.success) {
    console.info(
      JSON.stringify({
        event: "analysis.log_rejected",
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }
  console.info(
    JSON.stringify({ ...parsed.data, timestamp: new Date().toISOString() }),
  );
}
