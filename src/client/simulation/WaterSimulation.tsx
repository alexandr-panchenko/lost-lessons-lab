import "pixi.js/unsafe-eval";

import { Application, Graphics } from "pixi.js";
import { useEffect, useRef, useState } from "react";

import type { SimulationRun } from "../../shared/protocol";
import {
  WATER_FIXED_STEP_SECONDS,
  WATER_MAX_STEPS,
  createWaterWorld,
  type WaterWorldStatus,
} from "../../simulations/water/water-world";
import {
  chooseRenderQuality,
  shouldForceRendererFailure,
} from "../../simulations/core/render-quality";

type WaterRun = Extract<SimulationRun, { templateId: "water" }>;

export function WaterSimulation({
  run,
  sourceCanvasSeq,
}: {
  run: WaterRun;
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
  const [status, setStatus] = useState<WaterWorldStatus>("running");
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
    const simulation = createWaterWorld(run.outcome);
    let priorTime = performance.now();
    let accumulator = 0;
    let steps = 0;
    let terminal: WaterWorldStatus = "running";
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const renderScene = () => {
      const width = app.renderer.width;
      const height = app.renderer.height;
      const tankX = width * 0.23;
      const tankWidth = width * 0.54;
      const tankTop = height * 0.12;
      const tankBottom = height * 0.86;
      const tankHeight = tankBottom - tankTop;
      const visibleRatio = Math.min(run.outcome.fillRatio, 1);
      const waterHeight = tankHeight * visibleRatio;
      scene.clear();
      scene.rect(0, 0, width, height).fill({ color: 0xe8f7fb });
      scene
        .rect(tankX, tankBottom - waterHeight, tankWidth, waterHeight)
        .fill({ color: 0x4bb7d8, alpha: 0.78 });
      scene
        .moveTo(tankX, tankTop)
        .lineTo(tankX, tankBottom)
        .lineTo(tankX + tankWidth, tankBottom)
        .lineTo(tankX + tankWidth, tankTop)
        .stroke({ color: 0x183b5b, width: 8 });
      for (const [index, droplet] of simulation.droplets.entries()) {
        if (quality.lowDetail && index % 2 === 1) continue;
        const position = droplet.getPosition();
        const x = width / 2 + position.x * (width * 0.12);
        const y = tankBottom - position.y * (height * 0.16);
        scene.circle(x, y, 7).fill({ color: 0x298caf, alpha: 0.85 });
      }
      if (run.outcome.resultClass === "water_overflow") {
        scene
          .moveTo(tankX - 20, tankTop + 4)
          .bezierCurveTo(
            tankX + tankWidth * 0.25,
            tankTop - 20,
            tankX + tankWidth * 0.75,
            tankTop + 20,
            tankX + tankWidth + 20,
            tankTop + 4,
          )
          .stroke({ color: 0x4bb7d8, width: 12, alpha: 0.7 });
      }
      app.render();
    };

    const advance = () => {
      while (terminal === "running" && steps < WATER_MAX_STEPS) {
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
          backgroundColor: 0xe8f7fb,
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
              accumulator >= WATER_FIXED_STEP_SECONDS &&
              frameSteps < 8 &&
              terminal === "running"
            ) {
              terminal = simulation.step();
              accumulator -= WATER_FIXED_STEP_SECONDS;
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
        setStatus("settled");
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
    run.outcome.resultClass === "water_correct"
      ? "Water level on target"
      : run.outcome.resultClass === "water_overflow"
        ? "Tank overflow"
        : run.outcome.resultClass === "water_overfill"
          ? "Water level too high"
          : "Tank underfilled";
  const transcript =
    run.outcome.resultClass === "water_correct"
      ? `${run.inputs.volumeLiters} liters fills the tank to the intended level.`
      : run.outcome.resultClass === "water_overflow"
        ? `${run.inputs.volumeLiters} liters exceeds the ${run.outcome.explanationData.capacityLiters} liter capacity, producing a bounded splash.`
        : run.outcome.resultClass === "water_overfill"
          ? `${run.inputs.volumeLiters} liters is above the intended ${run.outcome.correctInputs.volumeLiters} liters but remains inside the tank.`
          : `${run.inputs.volumeLiters} liters leaves the level below the intended ${run.outcome.correctInputs.volumeLiters} liters.`;

  return (
    <article className="simulation-card" aria-labelledby={`run-${run.id}`}>
      <div className="simulation-card__heading">
        <div>
          <p className="feed-card__label">Deterministic water run</p>
          <h2 id={`run-${run.id}`}>{title}</h2>
        </div>
        <strong className="result-pill">{run.inputs.volumeLiters} L</strong>
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
        <p className="renderer-fallback">
          Low-detail rendering is active. Physics bodies and the verified result
          are unchanged.
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
          Domain check: expected {run.outcome.correctInputs.volumeLiters} L;
          submitted {run.inputs.volumeLiters} L. Physics visualizes this
          classification—it does not grade the answer.
        </p>
        <p>
          Immutable attempt cutoff: student canvas operation {sourceCanvasSeq}.
        </p>
      </div>
    </article>
  );
}
