import "pixi.js/unsafe-eval";

import { Application, Graphics } from "pixi.js";
import { useEffect, useRef, useState } from "react";

import type { SimulationRun } from "../../shared/protocol";
import {
  BRIDGE_FIXED_STEP_SECONDS,
  BRIDGE_GAP_METERS,
  BRIDGE_MAX_STEPS,
  createBridgeWorld,
  type BridgeWorldStatus,
} from "../../simulations/bridge/bridge-world";
import {
  chooseRenderQuality,
  shouldForceRendererFailure,
} from "../../simulations/core/render-quality";

type BridgeSimulationProps = {
  run: Extract<SimulationRun, { templateId: "bridge" }>;
  sourceCanvasSeq: number;
};

export function BridgeSimulation({
  run,
  sourceCanvasSeq,
}: BridgeSimulationProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const speedRef = useRef<1 | 2>(1);
  const skipRef = useRef<(() => void) | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [muted, setMuted] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [status, setStatus] = useState<BridgeWorldStatus>("running");
  const [rendererError, setRendererError] = useState(false);
  const [quality] = useState(() =>
    chooseRenderQuality({
      devicePixelRatio: window.devicePixelRatio,
      hardwareConcurrency: navigator.hardwareConcurrency,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches,
    }),
  );

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;
    let cancelled = false;
    let frame = 0;
    let initialized = false;
    let resizeObserver: ResizeObserver | null = null;
    const app = new Application();
    const scene = new Graphics();
    const simulation = createBridgeWorld(run.outcome);
    let priorTime = performance.now();
    let accumulator = 0;
    let steps = 0;
    let terminal: BridgeWorldStatus = "running";
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const renderScene = () => {
      const width = app.renderer.width;
      const height = app.renderer.height;
      const worldX = (value: number) => ((value + 3) / 16) * width;
      const worldY = (value: number) => height - ((value + 3.5) / 7) * height;
      const vehicle = simulation.vehicle.getPosition();
      scene.clear();
      scene
        .rect(0, 0, width, height)
        .fill({ color: 0xccebf1 })
        .rect(0, worldY(0), worldX(0), height - worldY(0))
        .fill({ color: 0x6a9b62 })
        .rect(
          worldX(BRIDGE_GAP_METERS),
          worldY(0),
          width - worldX(BRIDGE_GAP_METERS),
          height - worldY(0),
        )
        .fill({ color: 0x6a9b62 })
        .rect(
          worldX(0),
          worldY(0.08),
          worldX(simulation.bridgeLengthMeters) - worldX(0),
          Math.max(8, height * 0.025),
        )
        .fill({ color: 0xd88b43 })
        .rect(worldX(vehicle.x) - 18, worldY(vehicle.y) - 12, 36, 20)
        .fill({ color: 0x263a5a })
        .circle(worldX(vehicle.x) - 11, worldY(vehicle.y) + 9, 6)
        .circle(worldX(vehicle.x) + 11, worldY(vehicle.y) + 9, 6)
        .fill({ color: 0xf6c453 });
      if (terminal === "recovered") {
        scene
          .circle(worldX(vehicle.x), worldY(-2.5), 28)
          .fill({ color: 0xf6c453, alpha: 0.35 });
      }
      app.render();
    };

    const advance = () => {
      while (terminal === "running" && steps < BRIDGE_MAX_STEPS) {
        terminal = simulation.step();
        steps += 1;
      }
      if (terminal !== "running") setStatus(terminal);
      renderScene();
    };
    skipRef.current = advance;

    const initialize = async () => {
      try {
        if (shouldForceRendererFailure(window))
          throw new Error("Injected renderer failure");
        await app.init({
          antialias: quality.antialias,
          backgroundColor: 0xccebf1,
          height: 360,
          preference: "webgl",
          resolution: quality.resolution,
          width: Math.max(320, host.clientWidth),
        });
        initialized = true;
        if (cancelled) {
          app.destroy({ removeView: true }, { children: true });
          return;
        }
        app.stage.addChild(scene);
        host.replaceChildren(app.canvas);
        app.canvas.setAttribute("aria-hidden", "true");
        app.canvas.className = "simulation-canvas";
        resizeObserver = new ResizeObserver(() => {
          app.renderer.resize(Math.max(320, host.clientWidth), 360);
          renderScene();
        });
        resizeObserver.observe(host);

        if (reducedMotion) {
          advance();
          return;
        }

        const animate = (time: number) => {
          if (cancelled) return;
          const delta = Math.min((time - priorTime) / 1000, 0.1);
          priorTime = time;
          if (!pausedRef.current && terminal === "running") {
            accumulator += delta * speedRef.current;
            let frameSteps = 0;
            while (
              accumulator >= BRIDGE_FIXED_STEP_SECONDS &&
              frameSteps < 8 &&
              terminal === "running"
            ) {
              terminal = simulation.step();
              accumulator -= BRIDGE_FIXED_STEP_SECONDS;
              steps += 1;
              frameSteps += 1;
            }
            if (terminal !== "running") setStatus(terminal);
          }
          renderScene();
          if (terminal === "running") frame = requestAnimationFrame(animate);
        };
        renderScene();
        frame = requestAnimationFrame(animate);
      } catch {
        setRendererError(true);
        setStatus(
          run.outcome.isMathematicallyCorrect ? "crossed" : "recovered",
        );
      }
    };
    void initialize();

    return () => {
      cancelled = true;
      skipRef.current = null;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      simulation.destroy();
      if (initialized) {
        app.destroy({ removeView: true }, { children: true });
      }
    };
  }, [generation, quality, run]);

  const expectedStatus = run.outcome.isMathematicallyCorrect
    ? "crossed"
    : "recovered";
  const outcomeTitle =
    expectedStatus === "crossed" ? "Safe crossing" : "Bridge too short";
  const transcript =
    expectedStatus === "crossed"
      ? `The ${run.inputs.deployedLengthMeters} meter bridge spans the 9 meter ravine. The rescue vehicle crosses safely.`
      : `The ${run.inputs.deployedLengthMeters} meter bridge ends before the 9 meter ravine is crossed. The rescue vehicle drops into the safe recovery zone.`;

  return (
    <article className="simulation-card" aria-labelledby={`run-${run.id}`}>
      <div className="simulation-card__heading">
        <div>
          <p className="feed-card__label">Deterministic bridge run</p>
          <h2 id={`run-${run.id}`}>{outcomeTitle}</h2>
        </div>
        <strong className={`result-pill result-pill--${expectedStatus}`}>
          {run.inputs.deployedLengthMeters} m
        </strong>
      </div>
      <div className="simulation-stage" ref={hostRef}>
        {rendererError && (
          <p className="renderer-fallback">
            The visual renderer is unavailable. The verified result remains
            below.
          </p>
        )}
      </div>
      {quality.lowDetail && !rendererError && (
        <p className="renderer-fallback renderer-fallback--notice">
          Low-detail rendering is active. The physics and verified result are
          unchanged.
        </p>
      )}
      <div className="simulation-controls" aria-label="Simulation controls">
        <button
          className="tool-button"
          disabled={status !== "running"}
          onClick={() => setPaused((value) => !value)}
          type="button"
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          className="tool-button"
          onClick={() => {
            setStatus("running");
            setPaused(false);
            setRendererError(false);
            setGeneration((value) => value + 1);
          }}
          type="button"
        >
          {rendererError ? "Retry simulation" : "Replay"}
        </button>
        <button
          aria-pressed={speed === 2}
          className="tool-button"
          onClick={() => setSpeed((value) => (value === 1 ? 2 : 1))}
          type="button"
        >
          {speed === 1 ? "2× speed" : "1× speed"}
        </button>
        <button
          className="tool-button"
          disabled={status !== "running"}
          onClick={() => skipRef.current?.()}
          type="button"
        >
          Skip to result
        </button>
        <button
          aria-pressed={muted}
          className="tool-button"
          onClick={() => setMuted((value) => !value)}
          type="button"
        >
          {muted ? "Sound muted" : "Mute sound"}
        </button>
      </div>
      <div className="simulation-transcript" aria-live="polite">
        <strong>
          {status === "running" ? "Simulation running…" : "Result confirmed"}
        </strong>
        <p>{transcript}</p>
        <p>
          Domain check: expected{" "}
          {run.outcome.correctInputs.deployedLengthMeters} m; submitted{" "}
          {run.inputs.deployedLengthMeters} m. Physics visualizes this
          classification—it does not grade the answer.
        </p>
        <p>
          Immutable attempt cutoff: student canvas operation {sourceCanvasSeq}.
        </p>
      </div>
    </article>
  );
}
