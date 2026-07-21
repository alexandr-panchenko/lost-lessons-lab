import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { CanvasWorkspace } from "./canvas/CanvasWorkspace";
import { rasterizeStudentAttempt } from "./canvas/student-raster";
import { AnalysisCard } from "./feed/AnalysisCard";
import { AnalysisSubmitPanel } from "./feed/AnalysisSubmitPanel";
import { LearningFeed } from "./feed/LearningFeed";
import {
  fetchRoomBootstrap,
  readRoomLocation,
  roomSocketUrl,
  submitAnalysisAttempt,
} from "./room/room-client";
import { ManualBridgePanel } from "./simulation/ManualBridgePanel";
import type { CanvasOperation } from "../shared/canvas";
import type { BridgeSimulationInputs } from "../shared/domain/bridge";
import type { AnalysisRecord } from "../shared/analysis-types";
import type {
  RoomBootstrap,
  SocketAuthenticatedMessage,
  SocketServerMessage,
} from "../shared/protocol";

type ConnectionState = "connecting" | "connected" | "disconnected";

const BridgeSimulation = lazy(() =>
  import("./simulation/BridgeSimulation").then((module) => ({
    default: module.BridgeSimulation,
  })),
);

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const merged = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) merged.set(item.id, item);
  return [...merged.values()];
}

function mergeAnalyses(
  current: AnalysisRecord[],
  incoming: AnalysisRecord[],
): AnalysisRecord[] {
  const merged = new Map(current.map((item) => [item.attemptId, item]));
  for (const item of incoming) merged.set(item.attemptId, item);
  return [...merged.values()];
}

export function App() {
  const [roomLocation, setRoomLocation] = useState(() =>
    readRoomLocation(window.location),
  );
  const [room, setRoom] = useState<RoomBootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commandError, setCommandError] = useState("");
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [previewStudent, setPreviewStudent] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [submittingAnalysis, setSubmittingAnalysis] = useState(false);
  const [readyAiRuns, setReadyAiRuns] = useState<Set<string>>(() => new Set());
  const socketRef = useRef<WebSocket | null>(null);
  const pendingCommands = useRef(new Map<string, SocketAuthenticatedMessage>());
  const lastSeenSeq = useRef(0);
  const clientId = useRef(crypto.randomUUID());
  const launchAiRun = useCallback((attemptId: string) => {
    setReadyAiRuns((current) => new Set(current).add(attemptId));
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      setRoom(null);
      setError(null);
      setCommandError("");
      setConnection("connecting");
      setPreviewStudent(false);
      pendingCommands.current.clear();
      setPendingCount(0);
      setSubmittingAnalysis(false);
      setReadyAiRuns(new Set());
      lastSeenSeq.current = 0;
      setRoomLocation(readRoomLocation(window.location));
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (roomLocation === null) {
      setError("Open the root page to create a fresh room.");
      return;
    }

    const controller = new AbortController();
    let stopped = false;
    let reconnectTimer = 0;

    const applyMessage = (message: SocketServerMessage) => {
      if (message.type === "auth.accepted") {
        setConnection("connected");
        socketRef.current?.send(
          JSON.stringify({
            clientId: clientId.current,
            payload: { lastSeenSeq: lastSeenSeq.current },
            type: "room.resume",
            v: 1,
          }),
        );
        for (const pending of pendingCommands.current.values()) {
          socketRef.current?.send(JSON.stringify(pending));
        }
        return;
      }
      if (message.type === "room.snapshot") {
        lastSeenSeq.current = message.payload.roomSeq;
        setRoom(message.payload);
        return;
      }
      if (message.type === "room.delta") {
        lastSeenSeq.current = Math.max(
          lastSeenSeq.current,
          message.payload.toSeq,
        );
        setRoom((current) =>
          current === null
            ? current
            : {
                ...current,
                analyses: mergeAnalyses(
                  current.analyses,
                  message.payload.analyses,
                ),
                attempts: mergeById(current.attempts, message.payload.attempts),
                canvasOperations: [
                  ...new Map(
                    [
                      ...current.canvasOperations,
                      ...message.payload.canvasOperations,
                    ].map((record) => [
                      record.operation.clientOperationId,
                      record,
                    ]),
                  ).values(),
                ].sort((a, b) => a.seq - b.seq),
                roomSeq: Math.max(current.roomSeq, message.payload.toSeq),
                simulationRuns: mergeById(
                  current.simulationRuns,
                  message.payload.simulationRuns,
                ).sort((a, b) => a.roomSeq - b.roomSeq),
              },
        );
        return;
      }
      if (message.type === "canvas.operation") {
        pendingCommands.current.delete(
          message.payload.operation.clientOperationId,
        );
        setPendingCount(pendingCommands.current.size);
        lastSeenSeq.current = Math.max(
          lastSeenSeq.current,
          message.payload.seq,
        );
        setRoom((current) => {
          if (current === null) return current;
          const withoutDuplicate = current.canvasOperations.filter(
            (record) =>
              record.operation.clientOperationId !==
              message.payload.operation.clientOperationId,
          );
          return {
            ...current,
            canvasOperations: [...withoutDuplicate, message.payload].sort(
              (a, b) => a.seq - b.seq,
            ),
            roomSeq: Math.max(current.roomSeq, message.payload.seq),
          };
        });
        return;
      }
      if (message.type === "simulation.launch") {
        lastSeenSeq.current = Math.max(
          lastSeenSeq.current,
          message.payload.run.roomSeq,
        );
        setRoom((current) =>
          current === null
            ? current
            : {
                ...current,
                attempts: mergeById(current.attempts, [
                  message.payload.attempt,
                ]),
                roomSeq: Math.max(current.roomSeq, message.payload.run.roomSeq),
                simulationRuns: mergeById(current.simulationRuns, [
                  message.payload.run,
                ]).sort((a, b) => a.roomSeq - b.roomSeq),
              },
        );
        return;
      }
      if (message.type === "analysis.status") {
        lastSeenSeq.current = Math.max(
          lastSeenSeq.current,
          message.payload.attempt.roomSeq,
        );
        setRoom((current) =>
          current === null
            ? current
            : {
                ...current,
                attempts: mergeById(current.attempts, [
                  message.payload.attempt,
                ]),
                roomSeq: Math.max(
                  current.roomSeq,
                  message.payload.attempt.roomSeq,
                ),
              },
        );
        return;
      }
      if (message.type === "analysis.completed") {
        setSubmittingAnalysis(false);
        lastSeenSeq.current = Math.max(
          lastSeenSeq.current,
          message.payload.attempt.roomSeq,
        );
        setRoom((current) =>
          current === null
            ? current
            : {
                ...current,
                analyses: mergeAnalyses(current.analyses, [
                  message.payload.analysis,
                ]),
                attempts: mergeById(current.attempts, [
                  message.payload.attempt,
                ]),
                roomSeq: Math.max(
                  current.roomSeq,
                  message.payload.attempt.roomSeq,
                ),
                simulationRuns: mergeById(current.simulationRuns, [
                  message.payload.run,
                ]).sort((a, b) => a.roomSeq - b.roomSeq),
              },
        );
        return;
      }
      if (message.type === "analysis.failed") {
        setSubmittingAnalysis(false);
        lastSeenSeq.current = Math.max(
          lastSeenSeq.current,
          message.payload.attempt.roomSeq,
        );
        setRoom((current) =>
          current === null
            ? current
            : {
                ...current,
                analyses: mergeAnalyses(current.analyses, [
                  message.payload.analysis,
                ]),
                attempts: mergeById(current.attempts, [
                  message.payload.attempt,
                ]),
                roomSeq: Math.max(
                  current.roomSeq,
                  message.payload.attempt.roomSeq,
                ),
              },
        );
        return;
      }
      if (message.type === "command.ack") {
        const pending = pendingCommands.current.get(
          message.payload.idempotencyKey,
        );
        if (message.payload.duplicate || pending?.type !== "canvas.operation") {
          pendingCommands.current.delete(message.payload.idempotencyKey);
        }
        setPendingCount(pendingCommands.current.size);
        lastSeenSeq.current = Math.max(
          lastSeenSeq.current,
          message.payload.roomSeq,
        );
        return;
      }
      if (message.type === "command.rejected") {
        if (message.payload.requestId !== undefined) {
          for (const [key, pending] of pendingCommands.current) {
            if (
              "requestId" in pending &&
              pending.requestId === message.payload.requestId
            ) {
              pendingCommands.current.delete(key);
            }
          }
          setPendingCount(pendingCommands.current.size);
        }
        setCommandError(
          message.payload.reason === "permission_denied"
            ? "That action is not permitted for this room role."
            : message.payload.reason === "stale_canvas_sequence"
              ? "The latest student stroke was not saved. Please try again."
              : "The room could not accept that action. Please retry.",
        );
        return;
      }
      if (message.type === "auth.rejected") {
        setError("This room link is not authorized.");
      }
    };

    const connect = () => {
      if (stopped) return;
      setConnection("connecting");
      const socket = new WebSocket(roomSocketUrl(roomLocation.roomId));
      socketRef.current = socket;
      socket.addEventListener("open", () => {
        socket.send(
          JSON.stringify({
            clientId: clientId.current,
            payload: { token: roomLocation.token },
            type: "auth",
            v: 1,
          }),
        );
      });
      socket.addEventListener("message", (event) => {
        if (typeof event.data !== "string") return;
        applyMessage(JSON.parse(event.data) as SocketServerMessage);
      });
      socket.addEventListener("close", () => {
        if (socketRef.current === socket) socketRef.current = null;
        if (!stopped) {
          setConnection("disconnected");
          reconnectTimer = window.setTimeout(connect, 750);
        }
      });
      socket.addEventListener("error", () => setConnection("disconnected"));
    };

    void fetchRoomBootstrap(roomLocation, controller.signal)
      .then((bootstrap) => {
        lastSeenSeq.current = bootstrap.roomSeq;
        setRoom(bootstrap);
        connect();
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error ? reason.message : "Room unavailable.",
          );
        }
      });

    return () => {
      stopped = true;
      controller.abort();
      window.clearTimeout(reconnectTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [roomLocation]);

  function queueCommand(
    idempotencyKey: string,
    message: SocketAuthenticatedMessage,
  ): void {
    setCommandError("");
    pendingCommands.current.set(idempotencyKey, message);
    setPendingCount(pendingCommands.current.size);
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  }

  if (error !== null) {
    return (
      <main className="room-page">
        <section className="error-card" role="alert">
          <h1>Room unavailable</h1>
          <p>{error}</p>
          <a href="/">Create a fresh teacher room</a>
        </section>
      </main>
    );
  }

  if (room === null) {
    return (
      <main className="room-page">
        <p className="loading-state" role="status" aria-live="polite">
          Opening your learning room…
        </p>
      </main>
    );
  }

  const isTeacher = room.role === "teacher";
  const studentPerspective = room.role === "student" || previewStudent;
  const activeLayer = studentPerspective ? "student" : "teacher";
  const studentLink =
    isTeacher && room.studentCapability !== undefined
      ? `${window.location.origin}/r/${room.roomId}#token=${room.studentCapability}`
      : null;
  const latestStudentSeq = room.canvasOperations.reduce(
    (latest, record) =>
      record.layer === "student" ? Math.max(latest, record.seq) : latest,
    0,
  );

  async function copyStudentLink(): Promise<void> {
    if (studentLink === null) return;
    try {
      await navigator.clipboard.writeText(studentLink);
      setCopyStatus("Student link copied.");
    } catch {
      setCopyStatus("Copy unavailable. Select the link field instead.");
    }
  }

  function sendCanvasOperation(operation: CanvasOperation): void {
    const requestId = crypto.randomUUID();
    queueCommand(operation.clientOperationId, {
      clientId: clientId.current,
      payload: {
        operation,
        previewAsStudent: isTeacher && previewStudent,
      },
      requestId,
      type: "canvas.operation",
      v: 1,
    });
  }

  function submitManualAttempt(inputs: BridgeSimulationInputs): void {
    const idempotencyKey = crypto.randomUUID();
    queueCommand(idempotencyKey, {
      clientId: clientId.current,
      payload: {
        idempotencyKey,
        inputs,
        previewAsStudent: isTeacher && previewStudent,
        sourceCanvasSeq: latestStudentSeq,
      },
      requestId: crypto.randomUUID(),
      type: "attempt.manual-capture",
      v: 1,
    });
  }

  async function submitHandwritingAttempt(): Promise<void> {
    if (roomLocation === null || room === null || pendingCount > 0) return;
    setCommandError("");
    setSubmittingAnalysis(true);
    try {
      const raster = await rasterizeStudentAttempt(
        room.canvasOperations,
        latestStudentSeq,
      );
      const result = await submitAnalysisAttempt({
        authorId: clientId.current,
        contentHash: raster.contentHash,
        idempotencyKey: crypto.randomUUID(),
        mediaBase64: raster.mediaBase64,
        previewAsStudent: isTeacher && previewStudent,
        room: roomLocation,
        sourceCanvasSeq: latestStudentSeq,
      });
      setRoom((current) =>
        current === null
          ? current
          : {
              ...current,
              attempts: mergeById(current.attempts, [result.attempt]),
              roomSeq: Math.max(current.roomSeq, result.attempt.roomSeq),
            },
      );
    } catch (reason) {
      setSubmittingAnalysis(false);
      const code = reason instanceof Error ? reason.message : "analysis_failed";
      setCommandError(
        code === "ai_disabled"
          ? "AI interpretation is disabled right now. Use the manual bridge controls below."
          : code === "ai_rate_limited" || code === "rate_limited"
            ? "The AI limit was reached. Use the manual bridge controls below."
            : code.includes("canvas") || code.includes("student layer")
              ? code
              : "The handwriting could not be submitted safely. Your drawing is intact; use the manual bridge controls below.",
      );
    }
  }

  return (
    <main className="room-page">
      <header className="room-header">
        <a className="brand" href="/">
          Lost Lessons Lab
        </a>
        <div className="room-header__controls">
          <span
            className={`connection connection--${connection}`}
            role="status"
          >
            {connection === "connected"
              ? "Live room connected"
              : connection === "disconnected"
                ? "Reconnecting — work is queued"
                : "Connecting to live room"}
          </span>
          {isTeacher && (
            <button
              aria-pressed={previewStudent}
              className="secondary-button"
              onClick={() => setPreviewStudent((value) => !value)}
              type="button"
            >
              {previewStudent ? "Return to teacher view" : "Preview as student"}
            </button>
          )}
        </div>
      </header>

      <section className="room-intro" aria-labelledby="room-title">
        <p className="room-intro__role">
          {studentPerspective ? "Student view" : "Teacher view"}
        </p>
        <h1 id="room-title">Make the math move.</h1>
        <p>
          Write a real solution, see how it was interpreted, and let the numbers
          control the physical result.
        </p>
      </section>

      {isTeacher && !previewStudent && studentLink !== null && (
        <section className="invite-card" aria-labelledby="invite-title">
          <div>
            <p className="feed-card__label">Separate learner access</p>
            <h2 id="invite-title">Invite the student</h2>
            <p>
              The learner link sees the shared task but never private teacher
              setup.
            </p>
          </div>
          <div className="invite-card__actions">
            <label htmlFor="student-link">Student link</label>
            <input id="student-link" readOnly value={studentLink} />
            <button
              className="secondary-button"
              onClick={copyStudentLink}
              type="button"
            >
              Copy student link
            </button>
            <span aria-live="polite">{copyStatus}</span>
          </div>
        </section>
      )}

      <div className="feed" aria-label="Learning room feed">
        <LearningFeed
          events={room.events}
          studentPerspective={studentPerspective}
        />
        <CanvasWorkspace
          activeLayer={activeLayer}
          connected={connection === "connected"}
          onOperation={sendCanvasOperation}
          records={room.canvasOperations}
          roomSeq={room.roomSeq}
        />
        {studentPerspective ? (
          <>
            <AnalysisSubmitPanel
              disabled={
                connection !== "connected" ||
                room.attempts.some(
                  (attempt) =>
                    "mode" in attempt &&
                    attempt.mode === "ai" &&
                    attempt.status !== "complete" &&
                    attempt.status !== "failed",
                )
              }
              onSubmit={() => void submitHandwritingAttempt()}
              pendingOperations={pendingCount}
              submitting={submittingAnalysis}
            />
            <ManualBridgePanel
              disabled={
                connection !== "connected" ||
                room.attempts.some(
                  (attempt) =>
                    "mode" in attempt &&
                    attempt.mode === "ai" &&
                    attempt.status !== "complete" &&
                    attempt.status !== "failed",
                )
              }
              onSubmit={submitManualAttempt}
              pendingOperations={pendingCount}
            />
          </>
        ) : (
          <section className="teacher-note-card">
            <strong>Teacher annotation mode</strong>
            <p>
              Dashed teacher marks are shared live but excluded from every
              learner attempt. Choose Preview as student to submit the learner
              layer.
            </p>
          </section>
        )}
        {room.attempts
          .filter((attempt) => "mode" in attempt && attempt.mode === "ai")
          .map((attempt) =>
            "mode" in attempt && attempt.mode === "ai" ? (
              <AnalysisCard
                analysis={room.analyses.find(
                  (analysis) => analysis.attemptId === attempt.id,
                )}
                attempt={attempt}
                key={attempt.id}
                onLaunch={launchAiRun}
                room={roomLocation!}
              />
            ) : null,
          )}
        {room.simulationRuns.map((run) => {
          const attempt = room.attempts.find(
            (candidate) => candidate.id === run.attemptId,
          );
          if (
            attempt !== undefined &&
            "mode" in attempt &&
            attempt.mode === "ai" &&
            !readyAiRuns.has(attempt.id)
          ) {
            return null;
          }
          return (
            <Suspense
              fallback={
                <section className="simulation-card" role="status">
                  Preparing the physics scene…
                </section>
              }
              key={run.id}
            >
              <BridgeSimulation
                run={run}
                sourceCanvasSeq={attempt?.sourceCanvasSeq ?? 0}
              />
            </Suspense>
          );
        })}
      </div>

      <p className="command-error" role="alert">
        {commandError}
      </p>
      <footer className="room-footer">
        <p>
          Do not include names or personal information. Review every AI
          interpretation.
        </p>
      </footer>
    </main>
  );
}
