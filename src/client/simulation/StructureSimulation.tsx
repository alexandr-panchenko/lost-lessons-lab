import "pixi.js/unsafe-eval";

import { Application, Graphics } from "pixi.js";
import { useEffect, useRef, useState } from "react";

import type { SimulationRun } from "../../shared/protocol";
import {
  STRUCTURE_FIXED_STEP_SECONDS,
  STRUCTURE_MAX_STEPS,
  createStructureWorld,
  type StructureWorldStatus,
} from "../../simulations/structure/structure-world";

type StructureRun = Extract<SimulationRun, { templateId: "structure" }>;

export function StructureSimulation({
  run,
  sourceCanvasSeq,
}: {
  run: StructureRun;
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
  const [status, setStatus] = useState<StructureWorldStatus>("running");
  const [rendererError, setRendererError] = useState(false);
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
    const simulation = createStructureWorld(run.outcome);
    let priorTime = performance.now();
    let accumulator = 0;
    let steps = 0;
    let terminal: StructureWorldStatus = "running";
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const renderScene = () => {
      const width = app.renderer.width;
      const height = app.renderer.height;
      const groundY = height * 0.84;
      scene.clear();
      scene.rect(0, 0, width, height).fill({ color: 0xf3efe6 });
      scene.rect(0, groundY, width, height - groundY).fill({ color: 0x8e775d });
      if (run.outcome.resultClass !== "structure_collapse") {
        const bend = run.outcome.resultClass === "structure_strained" ? 14 : 0;
        scene
          .moveTo(width * 0.2, height * 0.45)
          .quadraticCurveTo(
            width * 0.5,
            height * 0.45 + bend,
            width * 0.8,
            height * 0.45,
          )
          .stroke({ color: 0x355f72, width: 22 });
        scene
          .rect(width * 0.25, height * 0.46, 20, groundY - height * 0.46)
          .fill({ color: 0x355f72 });
        scene
          .rect(width * 0.75 - 20, height * 0.46, 20, groundY - height * 0.46)
          .fill({ color: 0x355f72 });
        const crates = Math.min(run.inputs.itemCount ?? 12, 12);
        for (let index = 0; index < crates; index += 1) {
          const column = index % 6;
          const row = Math.floor(index / 6);
          scene
            .rect(width * 0.3 + column * 45, height * 0.39 - row * 38, 35, 32)
            .fill({ color: 0xd98b3e });
        }
      } else {
        for (const fragment of simulation.fragments) {
          const position = fragment.getPosition();
          const x = width / 2 + position.x * (width * 0.09);
          const y = groundY - position.y * (height * 0.14);
          scene.rect(x - 12, y - 7, 24, 14).fill({ color: 0x355f72 });
        }
      }
      app.render();
    };
    const advance = () => {
      while (terminal === "running" && steps < STRUCTURE_MAX_STEPS) {
        terminal = simulation.step();
        steps += 1;
      }
      if (terminal !== "running") setStatus(terminal);
      renderScene();
    };
    skipRef.current = advance;
    const initialize = async () => {
      try {
        await app.init({
          antialias: true,
          backgroundColor: 0xf3efe6,
          height: 360,
          preference: "webgl",
          resolution: Math.min(window.devicePixelRatio || 1, 2),
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
              accumulator >= STRUCTURE_FIXED_STEP_SECONDS &&
              frameSteps < 8 &&
              terminal === "running"
            ) {
              terminal = simulation.step();
              accumulator -= STRUCTURE_FIXED_STEP_SECONDS;
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
  }, [generation, run]);

  const title =
    run.outcome.resultClass === "structure_stable"
      ? "Platform load balanced"
      : run.outcome.resultClass === "structure_collapse"
        ? "Breakaway platform collapse"
        : run.outcome.resultClass === "structure_strained"
          ? "Platform visibly strained"
          : "Platform load undercounted";
  const transcript =
    run.outcome.resultClass === "structure_stable"
      ? `${run.inputs.totalLoadKg} kilograms is the intended platform load, so the structure remains stable.`
      : run.outcome.resultClass === "structure_collapse"
        ? `${run.inputs.totalLoadKg} kilograms exceeds the ${run.outcome.explanationData.collapseThresholdKg} kilogram breakaway threshold, replacing the platform with a bounded prepared fragment set.`
        : run.outcome.resultClass === "structure_strained"
          ? `${run.inputs.totalLoadKg} kilograms is above the intended ${run.outcome.correctInputs.totalLoadKg} kilograms, so the platform strains without collapsing.`
          : `${run.inputs.totalLoadKg} kilograms is below the intended ${run.outcome.correctInputs.totalLoadKg} kilogram load.`;
  return (
    <article className="simulation-card" aria-labelledby={`run-${run.id}`}>
      <div className="simulation-card__heading">
        <div>
          <p className="feed-card__label">Deterministic structure run</p>
          <h2 id={`run-${run.id}`}>{title}</h2>
        </div>
        <strong className="result-pill">{run.inputs.totalLoadKg} kg</strong>
      </div>
      <div className="simulation-stage" ref={hostRef}>
        {rendererError && (
          <p className="renderer-fallback">
            The visual renderer is unavailable. The verified result remains
            below.
          </p>
        )}
      </div>
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
            setGeneration((value) => value + 1);
          }}
          type="button"
        >
          Replay
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
          Domain check: expected {run.outcome.correctInputs.totalLoadKg} kg;
          submitted {run.inputs.totalLoadKg} kg. Fragments visualize this
          classification—they never grade the answer.
        </p>
        <p>
          Immutable attempt cutoff: student canvas operation {sourceCanvasSeq}.
        </p>
      </div>
    </article>
  );
}
