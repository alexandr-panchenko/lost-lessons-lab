import { describe, expect, it } from "vitest";

import {
  reduceVisibleStrokes,
  type CanvasOperationRecord,
} from "../../src/shared/canvas";
import { simplifyStrokePoints } from "../../src/client/canvas/stroke-simplify";
import { studentRecordsForRaster } from "../../src/client/canvas/stroke-render";

function addRecord(
  seq: number,
  strokeId: string,
  layer: "student" | "teacher",
): CanvasOperationRecord {
  return {
    authorId: "canvas-test-author",
    createdAt: "2026-07-21T00:00:00.000Z",
    layer,
    operation: {
      clientOperationId: `operation-${seq}`,
      layer,
      opacity: 1,
      operation: "stroke.add",
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.9, y: 0.9 },
      ],
      strokeId,
      tool: "pen",
      width: 4,
      workspaceId: "bridge-workspace-v1",
    },
    seq,
  };
}

describe("canvas model", () => {
  it("simplifies points while preserving endpoints and finite bounds", () => {
    const points = Array.from({ length: 600 }, (_, index) => ({
      x: index / 599,
      y: 0.5 + Math.sin(index / 30) * 0.05,
    }));
    const simplified = simplifyStrokePoints(points, 0.001);

    expect(simplified.length).toBeLessThanOrEqual(256);
    expect(simplified[0]).toEqual(points[0]);
    expect(simplified.at(-1)).toEqual(points.at(-1));
    expect(
      simplified.every(
        (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
      ),
    ).toBe(true);
  });

  it("applies add, delete, restore, and clear operations", () => {
    const records: CanvasOperationRecord[] = [
      addRecord(1, "student-stroke", "student"),
      addRecord(2, "teacher-stroke", "teacher"),
      {
        authorId: "canvas-test-author",
        createdAt: "2026-07-21T00:00:00.000Z",
        layer: "student",
        operation: {
          clientOperationId: "delete-student",
          operation: "stroke.delete",
          targetStrokeId: "student-stroke",
          workspaceId: "bridge-workspace-v1",
        },
        seq: 3,
      },
      {
        authorId: "canvas-test-author",
        createdAt: "2026-07-21T00:00:00.000Z",
        layer: "student",
        operation: {
          clientOperationId: "restore-student",
          operation: "stroke.restore",
          targetStrokeId: "student-stroke",
          workspaceId: "bridge-workspace-v1",
        },
        seq: 4,
      },
      {
        authorId: "canvas-test-author",
        createdAt: "2026-07-21T00:00:00.000Z",
        layer: "teacher",
        operation: {
          clientOperationId: "clear-teacher",
          layer: "teacher",
          operation: "layer.clear",
          workspaceId: "bridge-workspace-v1",
        },
        seq: 5,
      },
    ];

    expect(
      reduceVisibleStrokes(records).map((stroke) => stroke.strokeId),
    ).toEqual(["student-stroke"]);
  });

  it("builds student-only attempt input at an immutable cutoff", () => {
    const records = [
      addRecord(1, "student-before", "student"),
      addRecord(2, "teacher-before", "teacher"),
      addRecord(3, "student-after", "student"),
    ];
    const attemptStrokes = reduceVisibleStrokes(records, {
      cutoffSeq: 2,
      layers: ["student"],
    });

    expect(attemptStrokes.map((stroke) => stroke.strokeId)).toEqual([
      "student-before",
    ]);
    expect(
      studentRecordsForRaster(records, 2).map((record) => record.layer),
    ).toEqual(["student"]);
  });
});
