import "pixi.js/unsafe-eval";

import { Application, Graphics } from "pixi.js";
import { useEffect, useRef, useState } from "react";

import type { SimulationRun } from "../../shared/protocol";
import {
  SPEED_FIXED_STEP_SECONDS,
  SPEED_MAX_STEPS,
  createSpeedWorld,
  type SpeedWorldStatus,
} from "../../simulations/speed/speed-world";
import {
  chooseRenderQuality,
  shouldForceRendererFailure,
} from "../../simulations/core/render-quality";

type SpeedRun = Extract<SimulationRun, { templateId: "speed" }>;

export function SpeedSimulation({
  run,
  sourceCanvasSeq,
}: {
  run: SpeedRun;
  sourceCanvasSeq: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const speedRef = useRef<1 | 2>(1);
  const skipRef = useRef<(() => void) | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [muted, setMuted] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [status, setStatus] = useState<SpeedWorldStatus>("running");
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
    const simulation = createSpeedWorld(run.outcome);
    let priorTime = performance.now();
    let accumulator = 0;
    let steps = 0;
    let terminal: SpeedWorldStatus = "running";
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const renderScene = () => {
      const width = app.renderer.width;
      const height = app.renderer.height;
      const startX = width * 0.08;
      const trackWidth = width * 0.82;
      const trackY = height * 0.68;
      const stationRatio =
        run.outcome.correctInputs.distanceMeters /
        run.outcome.explanationData.bumperDistanceMeters;
      const stationX = startX + trackWidth * stationRatio;
      const bumperX = startX + trackWidth;
      const shuttleX =
        startX +
        trackWidth *
          Math.min(simulation.shuttle.getPosition().x / simulation.bumperX, 1);
      scene.clear();
      scene.rect(0, 0, width, height).fill({ color: 0xeaf3fb });
      scene.rect(startX, trackY, trackWidth, 12).fill({ color: 0x53677d });
      scene.rect(stationX - 7, trackY - 95, 14, 95).fill({ color: 0x42a47a });
      scene.circle(stationX, trackY - 105, 12).fill({ color: 0xf4c75a });
      scene
        .roundRect(bumperX - 12, trackY - 75, 24, 75, 8)
        .fill({ color: 0xe87965 });
      scene
        .roundRect(shuttleX - 32, trackY - 46, 64, 36, 12)
        .fill({ color: 0x204f80 });
      scene.circle(shuttleX - 20, trackY - 6, 10).fill({ color: 0x17365d });
      scene.circle(shuttleX + 20, trackY - 6, 10).fill({ color: 0x17365d });
      if (terminal === "collided") {
        for (let ray = 0; ray < 6; ray += 1) {
          const angle = (Math.PI * 2 * ray) / 6;
          scene
            .moveTo(bumperX, trackY - 82)
            .lineTo(
              bumperX + Math.cos(angle) * 28,
              trackY - 82 + Math.sin(angle) * 28,
            )
            .stroke({ color: 0xf4a642, width: 4 });
        }
      }
      app.render();
    };
    const advance = () => {
      while (terminal === "running" && steps < SPEED_MAX_STEPS) {
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
          backgroundColor: 0xeaf3fb,
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
              accumulator >= SPEED_FIXED_STEP_SECONDS &&
              frameSteps < 8 &&
              terminal === "running"
            ) {
              terminal = simulation.step();
              accumulator -= SPEED_FIXED_STEP_SECONDS;
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
        setStatus("arrived");
      }
    };
    void initialize();
    return () => {
      cancelled = true;
      skipRef.current = null;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      simulation.destroy();
      if (initialized) app.destroy({ removeView: true }, { children: true });
    };
  }, [generation, quality, run]);

  const title =
    run.outcome.resultClass === "speed_correct"
      ? "Shuttle arrived on target"
      : run.outcome.resultClass === "speed_collision"
        ? "Soft bumper boop"
        : run.outcome.resultClass === "speed_overshoot"
          ? "Shuttle passed the station"
          : "Shuttle stopped short";
  const transcript =
    run.outcome.resultClass === "speed_correct"
      ? `${run.inputs.distanceMeters} meters carries the shuttle exactly to its station.`
      : run.outcome.resultClass === "speed_collision"
        ? `${run.inputs.distanceMeters} meters reaches the soft bumper at ${run.outcome.explanationData.bumperDistanceMeters} meters, producing a harmless comic collision.`
        : run.outcome.resultClass === "speed_overshoot"
          ? `${run.inputs.distanceMeters} meters passes the intended ${run.outcome.correctInputs.distanceMeters} meter station but stops before the bumper.`
          : `${run.inputs.distanceMeters} meters stops before the intended ${run.outcome.correctInputs.distanceMeters} meter station.`;

  return (
    <article className="simulation-card" aria-labelledby={`run-${run.id}`}>
      <div className="simulation-card__heading">
        <div>
          <p className="feed-card__label">Deterministic motion run</p>
          <h2 id={`run-${run.id}`}>{title}</h2>
        </div>
        <strong className="result-pill">{run.inputs.distanceMeters} m</strong>
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
          Domain check: expected {run.outcome.correctInputs.distanceMeters} m;
          submitted {run.inputs.distanceMeters} m. Physics visualizes this
          classification—it does not grade the answer.
        </p>
        <p>
          Immutable attempt cutoff: student canvas operation {sourceCanvasSeq}.
        </p>
      </div>
    </article>
  );
}
