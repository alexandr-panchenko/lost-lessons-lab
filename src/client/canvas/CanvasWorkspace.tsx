import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  reduceVisibleStrokes,
  type CanvasOperation,
  type CanvasOperationRecord,
  type DrawableCanvasLayer,
  type StrokePoint,
} from "../../shared/canvas";
import { drawCanvasOperations, nearestStroke } from "./stroke-render";
import { simplifyStrokePoints } from "./stroke-simplify";

type Tool = "pen" | "highlighter" | "eraser";

type CanvasWorkspaceProps = {
  activeLayer: DrawableCanvasLayer;
  connected: boolean;
  onOperation: (operation: CanvasOperation) => void;
  preparedSample: boolean;
  records: CanvasOperationRecord[];
  roomSeq: number;
};

const WORKSPACE_ID = "bridge-workspace-v1";

export function CanvasWorkspace({
  activeLayer,
  connected,
  onOperation,
  preparedSample,
  records,
  roomSeq,
}: CanvasWorkspaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activePointerId = useRef<number | null>(null);
  const rawPoints = useRef<StrokePoint[]>([]);
  const [tool, setTool] = useState<Tool>("pen");
  const [optimistic, setOptimistic] = useState<CanvasOperation[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [drawingRevision, setDrawingRevision] = useState(0);

  useEffect(() => {
    const acceptedIds = new Set(
      records.map((record) => record.operation.clientOperationId),
    );
    setOptimistic((current) =>
      current.filter(
        (operation) => !acceptedIds.has(operation.clientOperationId),
      ),
    );
  }, [records]);

  const displayRecords = useMemo<CanvasOperationRecord[]>(
    () => [
      ...records,
      ...optimistic.map((operation, index) => ({
        authorId: "optimistic-local-client",
        createdAt: new Date().toISOString(),
        layer:
          operation.operation === "stroke.add" ||
          operation.operation === "layer.clear"
            ? operation.layer
            : activeLayer,
        operation,
        seq: roomSeq + index + 1,
      })),
    ],
    [activeLayer, optimistic, records, roomSeq],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const resizeAndDraw = () => {
      const bounds = canvas.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(bounds.width * scale));
      canvas.height = Math.max(1, Math.round(bounds.height * scale));
      const context = canvas.getContext("2d");
      if (context !== null) {
        const transient: CanvasOperationRecord[] =
          rawPoints.current.length >= 2 && tool !== "eraser"
            ? [
                {
                  authorId: "optimistic-local-client",
                  createdAt: new Date().toISOString(),
                  layer: activeLayer,
                  operation: {
                    clientOperationId: "transient-operation",
                    layer: activeLayer,
                    opacity: tool === "highlighter" ? 0.45 : 1,
                    operation: "stroke.add",
                    points: rawPoints.current,
                    strokeId: "transient-stroke",
                    tool,
                    width: tool === "highlighter" ? 15 : 4,
                    workspaceId: WORKSPACE_ID,
                  },
                  seq: roomSeq + optimistic.length + 1,
                },
              ]
            : [];
        drawCanvasOperations(context, [...displayRecords, ...transient]);
      }
    };
    resizeAndDraw();
    const observer = new ResizeObserver(resizeAndDraw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [
    activeLayer,
    displayRecords,
    drawingRevision,
    optimistic.length,
    roomSeq,
    tool,
  ]);

  function normalizedPoint(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): StrokePoint {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pressure = event.pressure > 0 ? event.pressure : undefined;
    return {
      ...(pressure === undefined ? {} : { pressure }),
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  }

  function emit(operation: CanvasOperation): void {
    setOptimistic((current) => [...current, operation]);
    onOperation(operation);
  }

  function deleteStroke(strokeId: string): void {
    emit({
      clientOperationId: crypto.randomUUID(),
      operation: "stroke.delete",
      targetStrokeId: strokeId,
      workspaceId: WORKSPACE_ID,
    });
    setRedoStack((current) => [...current, strokeId]);
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): void {
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerId.current = event.pointerId;
    const point = normalizedPoint(event);
    if (tool === "eraser") {
      const stroke = nearestStroke(displayRecords, activeLayer, point);
      if (stroke !== null) deleteStroke(stroke.strokeId);
      return;
    }
    rawPoints.current = [point];
  }

  function handlePointerMove(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): void {
    if (activePointerId.current !== event.pointerId || tool === "eraser")
      return;
    rawPoints.current.push(normalizedPoint(event));
    setDrawingRevision((revision) => revision + 1);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (activePointerId.current !== event.pointerId) return;
    activePointerId.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (tool === "eraser") return;
    const finalPoint = normalizedPoint(event);
    const points = simplifyStrokePoints([...rawPoints.current, finalPoint]);
    rawPoints.current = [];
    if (points.length < 2) return;
    const operation: CanvasOperation = {
      clientOperationId: crypto.randomUUID(),
      layer: activeLayer,
      opacity: tool === "highlighter" ? 0.45 : 1,
      operation: "stroke.add",
      points,
      strokeId: crypto.randomUUID(),
      tool,
      width: tool === "highlighter" ? 15 : 4,
      workspaceId: WORKSPACE_ID,
    };
    setRedoStack([]);
    emit(operation);
  }

  function undo(): void {
    const visible = reduceVisibleStrokes(displayRecords, {
      layers: [activeLayer],
    });
    const latest = visible.at(-1);
    if (latest !== undefined) deleteStroke(latest.strokeId);
  }

  function redo(): void {
    const targetStrokeId = redoStack.at(-1);
    if (targetStrokeId === undefined) return;
    emit({
      clientOperationId: crypto.randomUUID(),
      operation: "stroke.restore",
      targetStrokeId,
      workspaceId: WORKSPACE_ID,
    });
    setRedoStack((current) => current.slice(0, -1));
  }

  function clear(): void {
    emit({
      clientOperationId: crypto.randomUUID(),
      layer: activeLayer,
      operation: "layer.clear",
      workspaceId: WORKSPACE_ID,
    });
    setRedoStack([]);
  }

  return (
    <section className="canvas-card" aria-labelledby="canvas-title">
      <div className="canvas-card__heading">
        <div>
          <p className="feed-card__label">
            {activeLayer === "teacher"
              ? "Teacher annotation layer · dashed"
              : "Learner solution layer · solid"}
          </p>
          <h2 id="canvas-title">Work it out by hand</h2>
        </div>
        <span className={`layer-badge layer-badge--${activeLayer}`}>
          {activeLayer === "teacher" ? "Teacher ink" : "Student ink"}
        </span>
      </div>

      <div className="canvas-toolbar" role="toolbar" aria-label="Drawing tools">
        {(["pen", "highlighter", "eraser"] as const).map((value) => (
          <button
            aria-pressed={tool === value}
            className="tool-button"
            key={value}
            onClick={() => setTool(value)}
            type="button"
          >
            {value === "eraser"
              ? "Erase stroke"
              : value[0]?.toUpperCase() + value.slice(1)}
          </button>
        ))}
        <span className="toolbar-separator" aria-hidden="true" />
        <button className="tool-button" onClick={undo} type="button">
          Undo
        </button>
        <button
          className="tool-button"
          disabled={redoStack.length === 0}
          onClick={redo}
          type="button"
        >
          Redo
        </button>
        <button
          className="tool-button tool-button--danger"
          onClick={clear}
          type="button"
        >
          Clear {activeLayer} layer
        </button>
      </div>

      <canvas
        aria-describedby="canvas-instructions"
        aria-label={`${activeLayer === "teacher" ? "Teacher annotation" : "Student math solution"} drawing canvas`}
        className="math-canvas"
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={canvasRef}
        role="img"
        tabIndex={0}
      />
      <div className="canvas-card__footer">
        <p id="canvas-instructions">
          Draw with a mouse, finger, or stylus. Non-drawing actions are
          available as buttons above the canvas.
          {preparedSample && " This prepared sample is yours to edit."}
        </p>
        <span aria-live="polite" data-saved-strokes={records.length}>
          {connected
            ? activeLayer === "student"
              ? "Your work is saved"
              : "Teacher notes are saved"
            : "Offline — new strokes will send after reconnect"}
        </span>
      </div>
    </section>
  );
}
