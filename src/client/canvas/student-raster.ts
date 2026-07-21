import type { CanvasOperationRecord } from "../../shared/canvas";
import { drawCanvasOperations, studentRecordsForRaster } from "./stroke-render";

export type StudentRaster = {
  contentHash: string;
  height: number;
  mediaBase64: string;
  width: number;
};

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) reject(new Error("Student raster encoding failed"));
      else resolve(blob);
    }, "image/png");
  });
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return btoa(binary);
}

export async function rasterizeStudentAttempt(
  records: readonly CanvasOperationRecord[],
  sourceCanvasSeq: number,
): Promise<StudentRaster> {
  const studentRecords = studentRecordsForRaster(records, sourceCanvasSeq);
  if (studentRecords.length === 0) {
    throw new Error(
      "Write a solution on the canvas before asking AI to read it.",
    );
  }
  const source = document.createElement("canvas");
  source.width = 1600;
  source.height = 900;
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  if (sourceContext === null)
    throw new Error("Canvas 2D rendering is unavailable");
  drawCanvasOperations(sourceContext, studentRecords, {
    background: "#ffffff",
    layers: ["student"],
  });

  const pixels = sourceContext.getImageData(
    0,
    0,
    source.width,
    source.height,
  ).data;
  let minX = source.width;
  let minY = source.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const offset = (y * source.width + x) * 4;
      if (
        pixels[offset]! < 248 ||
        pixels[offset + 1]! < 248 ||
        pixels[offset + 2]! < 248
      ) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX || maxY < minY) {
    throw new Error(
      "The student layer appears blank. Add darker handwriting and retry.",
    );
  }

  const padding = 64;
  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropWidth = Math.min(source.width - cropX, maxX - cropX + padding + 1);
  const cropHeight = Math.min(
    source.height - cropY,
    maxY - cropY + padding + 1,
  );
  const output = document.createElement("canvas");
  output.width = Math.max(64, cropWidth);
  output.height = Math.max(64, cropHeight);
  const outputContext = output.getContext("2d");
  if (outputContext === null)
    throw new Error("Canvas 2D rendering is unavailable");
  outputContext.fillStyle = "#ffffff";
  outputContext.fillRect(0, 0, output.width, output.height);
  outputContext.drawImage(
    source,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight,
  );
  const blob = await canvasBlob(output);
  const buffer = await blob.arrayBuffer();
  return {
    contentHash: hex(await crypto.subtle.digest("SHA-256", buffer)),
    height: output.height,
    mediaBase64: base64(new Uint8Array(buffer)),
    width: output.width,
  };
}
