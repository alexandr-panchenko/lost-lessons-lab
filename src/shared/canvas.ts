import { z } from "zod";

export const CanvasLayerSchema = z.enum(["student", "teacher", "system"]);
export type CanvasLayer = z.infer<typeof CanvasLayerSchema>;

export const DrawableCanvasLayerSchema = z.enum(["student", "teacher"]);
export type DrawableCanvasLayer = z.infer<typeof DrawableCanvasLayerSchema>;

export const StrokePointSchema = z
  .object({
    pressure: z.number().finite().min(0).max(1).optional(),
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
  })
  .strict();
export type StrokePoint = z.infer<typeof StrokePointSchema>;

const OperationIdentitySchema = z.object({
  clientOperationId: z.string().min(8).max(128),
  workspaceId: z.string().min(1).max(80),
});

export const AddStrokeOperationSchema = OperationIdentitySchema.extend({
  layer: DrawableCanvasLayerSchema,
  opacity: z.number().finite().min(0.05).max(1),
  operation: z.literal("stroke.add"),
  points: z.array(StrokePointSchema).min(2).max(256),
  strokeId: z.string().min(8).max(128),
  tool: z.enum(["pen", "highlighter"]),
  width: z.number().finite().min(1).max(32),
}).strict();

export const DeleteStrokeOperationSchema = OperationIdentitySchema.extend({
  operation: z.literal("stroke.delete"),
  targetStrokeId: z.string().min(8).max(128),
}).strict();

export const RestoreStrokeOperationSchema = OperationIdentitySchema.extend({
  operation: z.literal("stroke.restore"),
  targetStrokeId: z.string().min(8).max(128),
}).strict();

export const ClearLayerOperationSchema = OperationIdentitySchema.extend({
  layer: DrawableCanvasLayerSchema,
  operation: z.literal("layer.clear"),
}).strict();

export const CanvasOperationSchema = z.discriminatedUnion("operation", [
  AddStrokeOperationSchema,
  DeleteStrokeOperationSchema,
  RestoreStrokeOperationSchema,
  ClearLayerOperationSchema,
]);
export type CanvasOperation = z.infer<typeof CanvasOperationSchema>;

export const CanvasOperationRecordSchema = z
  .object({
    authorId: z.string().min(8).max(128),
    createdAt: z.string(),
    layer: DrawableCanvasLayerSchema,
    operation: CanvasOperationSchema,
    seq: z.number().int().positive(),
  })
  .strict();
export type CanvasOperationRecord = z.infer<typeof CanvasOperationRecordSchema>;

export type VisibleStroke = z.infer<typeof AddStrokeOperationSchema> & {
  authorId: string;
  seq: number;
};

export function reduceVisibleStrokes(
  records: readonly CanvasOperationRecord[],
  options: {
    cutoffSeq?: number;
    layers?: readonly CanvasLayer[];
  } = {},
): VisibleStroke[] {
  const layers = new Set(options.layers ?? ["student", "teacher", "system"]);
  const visible = new Map<string, VisibleStroke>();
  const deleted = new Set<string>();

  for (const record of [...records].sort((a, b) => a.seq - b.seq)) {
    if (options.cutoffSeq !== undefined && record.seq > options.cutoffSeq) {
      continue;
    }
    const operation = record.operation;
    if (operation.operation === "stroke.add") {
      if (layers.has(operation.layer)) {
        visible.set(operation.strokeId, {
          ...operation,
          authorId: record.authorId,
          seq: record.seq,
        });
      }
      continue;
    }
    if (operation.operation === "stroke.delete") {
      deleted.add(operation.targetStrokeId);
      continue;
    }
    if (operation.operation === "stroke.restore") {
      deleted.delete(operation.targetStrokeId);
      continue;
    }
    for (const [strokeId, stroke] of visible) {
      if (stroke.layer === operation.layer) deleted.add(strokeId);
    }
  }

  return [...visible.values()].filter(
    (stroke) => !deleted.has(stroke.strokeId),
  );
}
