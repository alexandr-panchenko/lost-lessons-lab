import type { StrokePoint } from "../../shared/canvas";

const MAX_POINTS = 256;

function distanceToSegment(
  point: StrokePoint,
  start: StrokePoint,
  end: StrokePoint,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0)
    return Math.hypot(point.x - start.x, point.y - start.y);
  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) /
        (dx * dx + dy * dy),
    ),
  );
  return Math.hypot(
    point.x - (start.x + projection * dx),
    point.y - (start.y + projection * dy),
  );
}

function simplifySection(
  points: readonly StrokePoint[],
  first: number,
  last: number,
  tolerance: number,
  keep: Set<number>,
): void {
  let furthestIndex = -1;
  let furthestDistance = tolerance;
  const start = points[first];
  const end = points[last];
  if (start === undefined || end === undefined) return;

  for (let index = first + 1; index < last; index += 1) {
    const point = points[index];
    if (point === undefined) continue;
    const distance = distanceToSegment(point, start, end);
    if (distance > furthestDistance) {
      furthestDistance = distance;
      furthestIndex = index;
    }
  }
  if (furthestIndex < 0) return;
  keep.add(furthestIndex);
  simplifySection(points, first, furthestIndex, tolerance, keep);
  simplifySection(points, furthestIndex, last, tolerance, keep);
}

export function simplifyStrokePoints(
  input: readonly StrokePoint[],
  tolerance = 0.0025,
): StrokePoint[] {
  const points = input.filter(
    (point) =>
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      point.x >= 0 &&
      point.x <= 1 &&
      point.y >= 0 &&
      point.y <= 1,
  );
  if (points.length <= 2) return points.slice(0, MAX_POINTS);

  const keep = new Set([0, points.length - 1]);
  simplifySection(points, 0, points.length - 1, tolerance, keep);
  const simplified = [...keep]
    .sort((a, b) => a - b)
    .map((index) => points[index])
    .filter((point): point is StrokePoint => point !== undefined);

  if (simplified.length <= MAX_POINTS) return simplified;
  const stride = (simplified.length - 1) / (MAX_POINTS - 1);
  return Array.from({ length: MAX_POINTS }, (_, index) => {
    const sourceIndex =
      index === MAX_POINTS - 1
        ? simplified.length - 1
        : Math.floor(index * stride);
    const point = simplified[sourceIndex];
    if (point === undefined) throw new Error("Stroke sampling failed");
    return point;
  });
}
