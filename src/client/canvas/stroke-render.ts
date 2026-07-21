import {
  reduceVisibleStrokes,
  type CanvasLayer,
  type CanvasOperationRecord,
  type VisibleStroke,
} from "../../shared/canvas";

function traceStroke(
  context: CanvasRenderingContext2D,
  stroke: VisibleStroke,
  width: number,
  height: number,
): void {
  const first = stroke.points[0];
  if (first === undefined) return;
  context.beginPath();
  context.moveTo(first.x * width, first.y * height);
  for (let index = 1; index < stroke.points.length - 1; index += 1) {
    const point = stroke.points[index];
    const next = stroke.points[index + 1];
    if (point === undefined || next === undefined) continue;
    context.quadraticCurveTo(
      point.x * width,
      point.y * height,
      ((point.x + next.x) / 2) * width,
      ((point.y + next.y) / 2) * height,
    );
  }
  const last = stroke.points.at(-1);
  if (last !== undefined) context.lineTo(last.x * width, last.y * height);
  context.stroke();
}

export function drawCanvasOperations(
  context: CanvasRenderingContext2D,
  records: readonly CanvasOperationRecord[],
  options: {
    background?: string;
    cutoffSeq?: number;
    layers?: readonly CanvasLayer[];
  } = {},
): void {
  const { width, height } = context.canvas;
  context.save();
  context.fillStyle = options.background ?? "#fffdf7";
  context.fillRect(0, 0, width, height);
  context.lineCap = "round";
  context.lineJoin = "round";

  for (const stroke of reduceVisibleStrokes(records, options)) {
    const scale = Math.max(1, width / 720);
    context.globalAlpha = stroke.opacity;
    context.lineWidth = stroke.width * scale;
    context.strokeStyle =
      stroke.layer === "teacher"
        ? "#d45438"
        : stroke.tool === "highlighter"
          ? "#e6b72f"
          : "#17324d";
    context.setLineDash(
      stroke.layer === "teacher" ? [8 * scale, 5 * scale] : [],
    );
    traceStroke(context, stroke, width, height);
  }
  context.restore();
}

export async function rasterizeStudentLayer(
  records: readonly CanvasOperationRecord[],
  sourceCanvasSeq: number,
  dimensions = { height: 900, width: 1600 },
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("Canvas 2D rendering is unavailable");
  const studentRecords = studentRecordsForRaster(records, sourceCanvasSeq);
  drawCanvasOperations(context, studentRecords, {
    background: "#ffffff",
    layers: ["student"],
  });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) reject(new Error("Student raster encoding failed"));
      else resolve(blob);
    }, "image/png");
  });
}

export function studentRecordsForRaster(
  records: readonly CanvasOperationRecord[],
  sourceCanvasSeq: number,
): CanvasOperationRecord[] {
  return records.filter(
    (record) => record.layer === "student" && record.seq <= sourceCanvasSeq,
  );
}

export function nearestStroke(
  records: readonly CanvasOperationRecord[],
  layer: "student" | "teacher",
  point: { x: number; y: number },
  threshold = 0.035,
): VisibleStroke | null {
  let nearest: VisibleStroke | null = null;
  let nearestDistance = threshold;
  for (const stroke of reduceVisibleStrokes(records, { layers: [layer] })) {
    for (const candidate of stroke.points) {
      const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
      if (distance < nearestDistance) {
        nearest = stroke;
        nearestDistance = distance;
      }
    }
  }
  return nearest;
}
