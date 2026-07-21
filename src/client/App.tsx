import {
  Fragment,
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
import { AchievementCard } from "./feed/AchievementCard";
import { LearningFeed } from "./feed/LearningFeed";
import {
  fetchRoomBootstrap,
  readRoomLocation,
  resetRoom,
  roomSocketUrl,
  submitAnalysisAttempt,
  type RoomLocation,
} from "./room/room-client";
import { ManualBridgePanel } from "./simulation/ManualBridgePanel";
import type { CanvasOperation } from "../shared/canvas";
import type { BridgeSimulationInputs } from "../shared/domain/bridge";
import type { AnalysisRecord } from "../shared/analysis-types";
import {
  preparedBridgeCorrection,
  preparedBridgeHandwriting,
} from "../shared/judge-handwriting";
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

function roomViewStorageKey(roomId: string): string {
  return `lost-lessons-room-views:${roomId}`;
}

function rememberRoomViews(
  roomId: string,
  views: { student: RoomLocation; teacher: RoomLocation },
): void {
  sessionStorage.setItem(roomViewStorageKey(roomId), JSON.stringify(views));
}

function restoreRoomViews(roomId: string): {
  student: RoomLocation;
  teacher: RoomLocation;
} | null {
  const value = sessionStorage.getItem(roomViewStorageKey(roomId));
  if (value === null) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("student" in parsed) ||
      !("teacher" in parsed)
    )
      return null;
    const student = parsed.student;
    const teacher = parsed.teacher;
    if (
      typeof student !== "object" ||
      student === null ||
      typeof teacher !== "object" ||
      teacher === null ||
      !("roomId" in student) ||
      !("token" in student) ||
      !("roomId" in teacher) ||
      !("token" in teacher) ||
      student.roomId !== roomId ||
      teacher.roomId !== roomId ||
      typeof student.token !== "string" ||
      typeof teacher.token !== "string"
    )
      return null;
    return {
      student: { roomId, token: student.token },
      teacher: { roomId, token: teacher.token },
    };
  } catch {
    return null;
  }
}
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
  const [copyStatus, setCopyStatus] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [submittingAnalysis, setSubmittingAnalysis] = useState(false);
  const [retryAnalysisUpload, setRetryAnalysisUpload] = useState(false);
  const [manualFallbackVisible, setManualFallbackVisible] = useState(false);
  const [readyAiRuns, setReadyAiRuns] = useState<Set<string>>(() => new Set());
  const [resetting, setResetting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const pendingCommands = useRef(new Map<string, SocketAuthenticatedMessage>());
  const lastSeenSeq = useRef(0);
  const clientId = useRef(crypto.randomUUID());
  const viewLocations = useRef<{
    student?: RoomLocation;
    teacher?: RoomLocation;
  }>({});
  const focusStudentTask = useRef(false);
  const launchAiRun = useCallback((attemptId: string) => {
    setReadyAiRuns((current) => new Set(current).add(attemptId));
    let remainingFrames = 30;
    const scrollWhenMounted = () => {
      const target = document.querySelector<HTMLElement>(
        `[data-attempt-run="${attemptId}"]`,
      );
      if (target !== null) {
        target.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
          block: "center",
        });
        return;
      }
      remainingFrames -= 1;
      if (remainingFrames > 0) window.requestAnimationFrame(scrollWhenMounted);
    };
    window.requestAnimationFrame(scrollWhenMounted);
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const nextLocation = readRoomLocation(window.location);
      const knownRoomId =
        viewLocations.current.teacher?.roomId ??
        viewLocations.current.student?.roomId;
      if (nextLocation?.roomId !== knownRoomId) {
        viewLocations.current = {};
      }
      setRoom(null);
      setError(null);
      setCommandError("");
      setConnection("connecting");
      pendingCommands.current.clear();
      setPendingCount(0);
      setSubmittingAnalysis(false);
      setRetryAnalysisUpload(false);
      setManualFallbackVisible(false);
      setReadyAiRuns(new Set());
      lastSeenSeq.current = 0;
      setRoomLocation(nextLocation);
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
        setRoom((current) => ({
          ...message.payload,
          ...(message.payload.studentCapability === undefined &&
          current?.studentCapability !== undefined
            ? { studentCapability: current.studentCapability }
            : {}),
        }));
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
                achievements: mergeById(
                  current.achievements,
                  message.payload.achievements,
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
                achievements: mergeById(current.achievements, [
                  message.payload.achievement,
                ]),
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
                achievements: mergeById(current.achievements, [
                  message.payload.achievement,
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
        if (bootstrap.role === "teacher") {
          viewLocations.current.teacher = roomLocation;
          if (bootstrap.studentCapability !== undefined) {
            viewLocations.current.student = {
              roomId: bootstrap.roomId,
              token: bootstrap.studentCapability,
            };
            rememberRoomViews(bootstrap.roomId, {
              student: viewLocations.current.student,
              teacher: roomLocation,
            });
          }
          if (
            bootstrap.fixtureId === "judge-v1" &&
            bootstrap.studentCapability !== undefined &&
            new URLSearchParams(window.location.search).get("entry") === "judge"
          ) {
            const next = {
              roomId: bootstrap.roomId,
              token: bootstrap.studentCapability,
            };
            window.history.replaceState(
              null,
              "",
              `/r/${bootstrap.roomId}#${new URLSearchParams({ token: next.token })}`,
            );
            setRoomLocation(next);
            return;
          }
        } else {
          viewLocations.current.student = roomLocation;
          const storedViews = restoreRoomViews(bootstrap.roomId);
          if (storedViews !== null) viewLocations.current = storedViews;
        }
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

  useEffect(() => {
    if (room?.role !== "student" || !focusStudentTask.current) return;
    focusStudentTask.current = false;
    const frame = window.requestAnimationFrame(() => {
      const feed = document.querySelector<HTMLElement>("#learning-feed");
      feed?.focus({ preventScroll: true });
      feed?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [room?.role, room?.roomId]);

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
  const studentPerspective = room.role === "student";
  const activeLayer = studentPerspective ? "student" : "teacher";
  const studentLink =
    isTeacher && room.studentCapability !== undefined
      ? `${window.location.origin}/r/${room.roomId}#token=${room.studentCapability}`
      : null;
  const canSwitchViews =
    viewLocations.current.teacher?.roomId === room.roomId &&
    viewLocations.current.student?.roomId === room.roomId;
  const latestStudentSeq = room.canvasOperations.reduce(
    (latest, record) =>
      record.layer === "student" ? Math.max(latest, record.seq) : latest,
    0,
  );
  const analysisActive = room.attempts.some(
    (attempt) =>
      "mode" in attempt &&
      attempt.mode === "ai" &&
      attempt.status !== "complete" &&
      attempt.status !== "failed",
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

  function switchRoomView(role: "student" | "teacher"): void {
    const nextLocation = viewLocations.current[role];
    if (
      nextLocation === undefined ||
      nextLocation.token === roomLocation?.token
    )
      return;
    focusStudentTask.current = role === "student";
    const token = new URLSearchParams({ token: nextLocation.token });
    window.location.hash = token.toString();
  }

  function sendCanvasOperation(operation: CanvasOperation): void {
    const requestId = crypto.randomUUID();
    queueCommand(operation.clientOperationId, {
      clientId: clientId.current,
      payload: {
        operation,
        previewAsStudent: false,
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
        previewAsStudent: false,
        sourceCanvasSeq: latestStudentSeq,
        templateId: "bridge",
      },
      requestId: crypto.randomUUID(),
      type: "attempt.manual-capture",
      v: 1,
    });
  }

  function tryBridgeAgain(): void {
    setRetrying(true);
    requestAnimationFrame(() => {
      document.querySelector(".canvas-card")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
      });
    });
  }

  function loadBridgeSample(variant: "correct" | "wrong"): void {
    const prefix = `${variant}-${crypto.randomUUID()}`;
    const operations =
      variant === "correct"
        ? preparedBridgeCorrection(prefix)
        : preparedBridgeHandwriting("wrong", prefix);
    for (const operation of operations) sendCanvasOperation(operation);
  }

  async function submitHandwritingAttempt(): Promise<void> {
    if (roomLocation === null || room === null || pendingCount > 0) return;
    setCommandError("");
    setSubmittingAnalysis(true);
    setRetryAnalysisUpload(false);
    setManualFallbackVisible(false);
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
        previewAsStudent: false,
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
      setRetryAnalysisUpload(false);
    } catch (reason) {
      setSubmittingAnalysis(false);
      const code = reason instanceof Error ? reason.message : "analysis_failed";
      setManualFallbackVisible(
        !code.includes("canvas") && !code.includes("student layer"),
      );
      const manualControls = "bridge";
      setRetryAnalysisUpload(
        code !== "ai_disabled" &&
          code !== "ai_rate_limited" &&
          code !== "rate_limited" &&
          !code.includes("canvas") &&
          !code.includes("student layer"),
      );
      setCommandError(
        code === "ai_disabled"
          ? `I couldn't read the handwriting this time. Your work is saved; enter your ${manualControls} measurement below.`
          : code === "ai_rate_limited" || code === "rate_limited"
            ? `The AI limit was reached. Use the manual ${manualControls} controls below.`
            : code.includes("canvas") || code.includes("student layer")
              ? code
              : `The handwriting could not be submitted safely. Your drawing is intact; use the manual ${manualControls} controls below.`,
      );
    }
  }

  async function resetCurrentTask(): Promise<void> {
    if (roomLocation === null || room === null || resetting) return;
    const roomBeforeReset = room;
    setResetting(true);
    setCommandError("");
    // Unmount private attempt images before the Worker removes their R2
    // objects. If reset fails, the complete prior room is restored below.
    setRoom({
      ...roomBeforeReset,
      achievements: [],
      analyses: [],
      attempts: [],
      canvasOperations: [],
      simulationRuns: [],
    });
    try {
      const reset = await resetRoom(roomLocation);
      setRoom(reset);
      setReadyAiRuns(new Set());
      setSubmittingAnalysis(false);
      setRetryAnalysisUpload(false);
      setManualFallbackVisible(false);
      pendingCommands.current.clear();
      setPendingCount(0);
      lastSeenSeq.current = reset.roomSeq;
    } catch (reason) {
      setRoom(roomBeforeReset);
      setCommandError(
        reason instanceof Error && reason.message === "attempt_in_progress"
          ? "Wait for the current analysis to finish before resetting."
          : "The task could not be reset. Your current room is unchanged.",
      );
    } finally {
      setResetting(false);
    }
  }

  const canvasWorkspace = (
    <CanvasWorkspace
      activeLayer={activeLayer}
      connected={connection === "connected"}
      {...(studentPerspective
        ? {
            onLoadDemoSample: () =>
              loadBridgeSample(
                retrying ||
                  room.simulationRuns.some(
                    (run) =>
                      run.templateId === "bridge" &&
                      !run.outcome.isMathematicallyCorrect,
                  )
                  ? "correct"
                  : "wrong",
              ),
          }
        : {})}
      demoSampleLabel={
        retrying ||
        room.simulationRuns.some(
          (run) =>
            run.templateId === "bridge" && !run.outcome.isMathematicallyCorrect,
        )
          ? "Load correct sample"
          : "Load sample mistake"
      }
      onOperation={sendCanvasOperation}
      preparedSample={false}
      {...(studentPerspective
        ? {
            primaryAction: {
              disabled:
                connection !== "connected" ||
                analysisActive ||
                pendingCount > 0 ||
                submittingAnalysis,
              label: submittingAnalysis
                ? "Preparing student work…"
                : retryAnalysisUpload
                  ? "Retry upload"
                  : "Run my solution",
              onClick: () => void submitHandwritingAttempt(),
            },
          }
        : {})}
      records={room.canvasOperations}
      roomSeq={room.roomSeq}
    />
  );

  return (
    <main className="room-page">
      <a
        className="skip-link"
        href="#learning-feed"
        onClick={(event) => {
          event.preventDefault();
          const feed = document.querySelector<HTMLElement>("#learning-feed");
          feed?.focus({ preventScroll: true });
          feed?.scrollIntoView({ block: "start" });
        }}
      >
        Skip to the learning feed
      </a>
      <header className="room-header">
        <a className="brand" href="/">
          Lost Lessons Lab
        </a>
        <div className="room-header__controls">
          {canSwitchViews && (
            <div className="view-switcher" aria-label="Room view">
              <span>View</span>
              <button
                aria-label="Teacher setup"
                aria-pressed={isTeacher}
                onClick={() => switchRoomView("teacher")}
                type="button"
              >
                Teacher setup
              </button>
              <button
                aria-label="Student lesson"
                aria-pressed={studentPerspective}
                onClick={() => switchRoomView("student")}
                type="button"
              >
                Student lesson
              </button>
            </div>
          )}
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
              className="secondary-button"
              disabled={
                resetting ||
                pendingCount > 0 ||
                room.attempts.some(
                  (attempt) =>
                    "mode" in attempt &&
                    attempt.mode === "ai" &&
                    attempt.status !== "complete" &&
                    attempt.status !== "failed",
                )
              }
              onClick={() => void resetCurrentTask()}
              type="button"
            >
              {resetting ? "Resetting…" : "Reset current task"}
            </button>
          )}
        </div>
      </header>

      <section className="room-intro" aria-labelledby="room-title">
        <p className="room-intro__role">
          {studentPerspective ? "Student lesson" : "Teacher setup"}
        </p>
        <h1 id="room-title">Your math controls the bridge.</h1>
        <p>Write your solution, then watch what it builds.</p>
        <p className="room-intro__next">
          <strong>Teacher goal:</strong> help the learner see a fraction as
          equal parts, then test their own measurement in the world.
        </p>
      </section>

      <div
        className="feed"
        id="learning-feed"
        aria-label="Learning room feed"
        role="region"
        tabIndex={-1}
      >
        <LearningFeed
          events={room.events}
          studentPerspective={studentPerspective}
        />
        {!retrying && canvasWorkspace}
        {!studentPerspective && (
          <section className="teacher-note-card">
            <strong>Teacher annotation mode</strong>
            <p>
              Dashed teacher marks are shared live but excluded from every
              learner attempt. Choose Student lesson to enter the real learner
              workspace in this tab.
            </p>
          </section>
        )}
        {studentPerspective && pendingCount > 0 && (
          <p className="inline-status" role="status">
            Saving the latest stroke before capture…
          </p>
        )}
        {studentPerspective && commandError !== "" && (
          <p className="command-error" role="alert">
            {commandError}
          </p>
        )}
        {studentPerspective &&
          (manualFallbackVisible ||
            room.analyses.some(
              (analysis) => analysis.failureCategory !== null,
            )) && (
            <ManualBridgePanel
              disabled={connection !== "connected"}
              onSubmit={submitManualAttempt}
              pendingOperations={pendingCount}
            />
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
                studentPerspective={studentPerspective}
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
          const achievement = room.achievements.find(
            (award) => award.attemptId === run.attemptId,
          );
          return (
            <Fragment key={run.id}>
              <Suspense
                fallback={
                  <section className="simulation-card" role="status">
                    Preparing the physics scene…
                  </section>
                }
              >
                {run.templateId === "bridge" && (
                  <BridgeSimulation
                    onTryAgain={tryBridgeAgain}
                    run={run}
                    studentPerspective={studentPerspective}
                  />
                )}
              </Suspense>
              {achievement !== undefined && (
                <AchievementCard award={achievement} />
              )}
            </Fragment>
          );
        })}
        {retrying && canvasWorkspace}
      </div>

      {isTeacher && studentLink !== null && (
        <section className="invite-card" aria-labelledby="invite-title">
          <div>
            <p className="feed-card__label">Separate learner access</p>
            <h2 id="invite-title">Invite the student</h2>
            <p>
              For real collaboration, share this learner capability. The judge
              path above does not require copying it.
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

      {!studentPerspective && (
        <p className="command-error" role="alert">
          {commandError}
        </p>
      )}
      <footer className="room-footer">
        <p>
          Do not include names or personal information. Review every AI
          interpretation.
        </p>
      </footer>
    </main>
  );
}
