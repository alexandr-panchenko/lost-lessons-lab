import type { CanvasOperation } from "./canvas";

type Glyph = ReadonlyArray<ReadonlyArray<readonly [number, number]>>;

const GLYPHS: Record<string, Glyph> = {
  ".": [
    [
      [0.42, 0.92],
      [0.5, 1],
    ],
  ],
  "/": [
    [
      [0.05, 1],
      [0.95, 0],
    ],
  ],
  "0": [
    [
      [0.15, 0],
      [0.85, 0],
      [1, 0.18],
      [1, 0.82],
      [0.85, 1],
      [0.15, 1],
      [0, 0.82],
      [0, 0.18],
      [0.15, 0],
    ],
  ],
  "1": [
    [
      [0.2, 0.18],
      [0.55, 0],
      [0.55, 1],
    ],
    [
      [0.2, 1],
      [0.9, 1],
    ],
  ],
  "2": [
    [
      [0, 0.18],
      [0.2, 0],
      [0.85, 0],
      [1, 0.18],
      [1, 0.38],
      [0, 1],
      [1, 1],
    ],
  ],
  "3": [
    [
      [0, 0.08],
      [0.75, 0],
      [1, 0.18],
      [0.75, 0.48],
      [0.35, 0.5],
      [0.78, 0.52],
      [1, 0.78],
      [0.78, 1],
      [0, 0.92],
    ],
  ],
  "4": [
    [
      [0.78, 1],
      [0.78, 0],
      [0, 0.62],
      [1, 0.62],
    ],
  ],
  "5": [
    [
      [1, 0],
      [0.08, 0],
      [0, 0.5],
      [0.78, 0.5],
      [1, 0.7],
      [0.85, 1],
      [0.05, 0.92],
    ],
  ],
  "7": [
    [
      [0, 0],
      [1, 0],
      [0.35, 1],
    ],
  ],
  "8": [
    [
      [0.2, 0],
      [0.8, 0],
      [1, 0.2],
      [0.8, 0.48],
      [0.2, 0.48],
      [0, 0.2],
      [0.2, 0],
    ],
    [
      [0.2, 0.52],
      [0.8, 0.52],
      [1, 0.8],
      [0.8, 1],
      [0.2, 1],
      [0, 0.8],
      [0.2, 0.52],
    ],
  ],
  "9": [
    [
      [0.9, 0.55],
      [0.18, 0.55],
      [0, 0.35],
      [0.15, 0],
      [0.82, 0],
      [1, 0.2],
      [0.9, 1],
      [0.2, 1],
    ],
  ],
  "=": [
    [
      [0, 0.38],
      [1, 0.38],
    ],
    [
      [0, 0.7],
      [1, 0.7],
    ],
  ],
  m: [
    [
      [0, 1],
      [0.08, 0.35],
      [0.4, 0.52],
      [0.5, 1],
      [0.58, 0.35],
      [0.9, 0.52],
      [1, 1],
    ],
  ],
  x: [
    [
      [0, 0.1],
      [1, 0.9],
    ],
    [
      [1, 0.1],
      [0, 0.9],
    ],
  ],
};

function lineOperations(input: {
  height: number;
  prefix: string;
  step: number;
  text: string;
  width: number;
  x: number;
  y: number;
}): CanvasOperation[] {
  const operations: CanvasOperation[] = [];
  let cursor = input.x;
  let strokeIndex = 0;
  for (const character of input.text) {
    if (character === " ") {
      cursor += input.step * 0.65;
      continue;
    }
    const glyph = GLYPHS[character];
    if (glyph === undefined)
      throw new Error(`Unsupported fixture glyph: ${character}`);
    for (const stroke of glyph) {
      const id = `${input.prefix}-${strokeIndex}`;
      operations.push({
        clientOperationId: `fixture-operation-${id}`,
        layer: "student",
        opacity: 1,
        operation: "stroke.add",
        points: stroke.map(([x, y]) => ({
          x: cursor + x * input.width,
          y: input.y + y * input.height,
        })),
        strokeId: `fixture-stroke-${id}`,
        tool: "pen",
        width: 5,
        workspaceId: "bridge-workspace-v1",
      });
      strokeIndex += 1;
    }
    cursor += input.step;
  }
  return operations;
}

export function preparedBridgeHandwriting(
  variant: "correct" | "wrong",
  prefix: string = variant,
): CanvasOperation[] {
  const decimal = variant === "wrong" ? "0.34" : "0.75";
  const result = variant === "wrong" ? "4.08m" : "9m";
  return [
    ...lineOperations({
      height: 0.12,
      prefix: `${prefix}-line-1`,
      step: 0.068,
      text: `3/4 = ${decimal}`,
      width: 0.042,
      x: 0.18,
      y: 0.18,
    }),
    ...lineOperations({
      height: 0.13,
      prefix: `${prefix}-line-2`,
      step: 0.057,
      text: `12 x ${decimal} = ${result}`,
      width: 0.038,
      x: 0.08,
      y: 0.52,
    }),
  ];
}

export function preparedBridgeCorrection(prefix: string): CanvasOperation[] {
  return [
    {
      clientOperationId: `fixture-operation-${prefix}-clear`,
      layer: "student",
      operation: "layer.clear",
      workspaceId: "bridge-workspace-v1",
    },
    ...preparedBridgeHandwriting("correct", prefix),
  ];
}
