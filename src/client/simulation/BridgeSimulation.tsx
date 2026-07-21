import "pixi.js/unsafe-eval";

import type { Body } from "planck";
import { Application, Graphics } from "pixi.js";
import { useEffect, useRef, useState } from "react";

import type { SimulationRun } from "../../shared/protocol";
import {
  BRIDGE_FIXED_STEP_SECONDS,
  BRIDGE_GAP_METERS,
  BRIDGE_MAX_STEPS,
  createBridgeWorld,
  type BridgeVisualPhase,
  type BridgeWorldStatus,
} from "../../simulations/bridge/bridge-world";
import {
  chooseRenderQuality,
  shouldForceRendererFailure,
} from "../../simulations/core/render-quality";
import { useSimulationSound } from "../accessibility/useSimulationSound";
import { LearnerBridgeFeedback } from "../feed/LearnerBridgeFeedback";

type BridgeSimulationProps = {
  onTryAgain: () => void;
  run: Extract<SimulationRun, { templateId: "bridge" }>;
  studentPerspective: boolean;
};

type ScreenPoint = { x: number; y: number };

export function BridgeSimulation({
  onTryAgain,
  run,
  studentPerspective,
}: BridgeSimulationProps) {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const speedRef = useRef<1 | 2>(1);
  const skipRef = useRef<(() => void) | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [generation, setGeneration] = useState(0);
  const [status, setStatus] = useState<BridgeWorldStatus>("running");
  const [visualPhase, setVisualPhase] =
    useState<BridgeVisualPhase>("deploying");
  const [phaseHistory, setPhaseHistory] = useState<BridgeVisualPhase[]>([
    "deploying",
  ]);
  const [rendererError, setRendererError] = useState(false);
  const { muted, playEffect, toggleSound } = useSimulationSound({
    complete: status !== "running",
    successful: run.outcome.isMathematicallyCorrect,
  });
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
    const host = canvasHostRef.current;
    if (host === null) return;
    let cancelled = false;
    let frame = 0;
    let initialized = false;
    let resizeObserver: ResizeObserver | null = null;
    const app = new Application();
    const farScene = new Graphics();
    const waterScene = new Graphics();
    const terrainScene = new Graphics();
    const scene = new Graphics();
    let drawingTarget = scene;
    let staticLayersReady = false;
    const simulation = createBridgeWorld(run.outcome);
    let priorTime = performance.now();
    let accumulator = 0;
    let steps = 0;
    let terminal: BridgeWorldStatus = "running";
    let priorPhase: BridgeVisualPhase = "deploying";
    const wrongSceneRenderScale = run.outcome.isMathematicallyCorrect
      ? 1
      : 0.78;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const announcePhase = (phase: BridgeVisualPhase) => {
      if (phase === priorPhase) return;
      priorPhase = phase;
      setVisualPhase(phase);
      setPhaseHistory((current) =>
        current.at(-1) === phase ? current : [...current, phase],
      );
      if (phase === "snapping") playEffect("bridge-break");
      if (phase === "falling") playEffect("suspension");
      if (phase === "splash") playEffect("splash");
    };

    const renderScene = () => {
      const width = app.screen.width;
      const height = app.screen.height;
      const snapshot = simulation.getSnapshot();
      const chassisPosition = simulation.chassis.getPosition();
      const deployedSegments = Math.max(
        1,
        Math.ceil(
          snapshot.deploymentProgress * simulation.bridgeSegments.length,
        ),
      );
      const brokenAge =
        simulation.metrics.bridgeBreakStep === null
          ? -1
          : (snapshot.stepCount - simulation.metrics.bridgeBreakStep) / 60;
      const impactAge =
        simulation.metrics.waterImpactStep === null
          ? -1
          : (snapshot.stepCount - simulation.metrics.waterImpactStep) / 60;
      const actionPhase = [
        "sagging",
        "snapping",
        "peeling",
        "falling",
        "collision",
        "splash",
        "aftermath",
      ].includes(snapshot.phase);
      const baseScale = Math.min(width / 14.2, height / 8.8);
      const scale = baseScale;
      const cameraX = 4.5;
      const cameraY = -0.1;
      let shake = 0;
      if (!reducedMotion) {
        if (brokenAge >= 0 && brokenAge < 0.58)
          shake += (1 - brokenAge / 0.58) * 7;
        if (impactAge >= 0 && impactAge < 0.62)
          shake += (1 - impactAge / 0.62) * 12;
      }
      const shakeX = Math.sin(snapshot.stepCount * 1.73) * shake;
      const shakeY = Math.cos(snapshot.stepCount * 1.29) * shake * 0.55;
      const project = (x: number, y: number): ScreenPoint => ({
        x: width / 2 + (x - cameraX) * scale,
        y: height * 0.39 - (y - cameraY) * scale,
      });
      const bodyPoint = (body: Body, x: number, y: number): ScreenPoint => {
        const position = body.getPosition();
        const angle = body.getAngle();
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        return project(
          position.x + x * cosine - y * sine,
          position.y + x * sine + y * cosine,
        );
      };
      const polygon = (
        points: ScreenPoint[],
        fill: number,
        stroke = 0x17365d,
        strokeWidth = 2,
        alpha = 1,
      ) => {
        drawingTarget
          .poly(points.flatMap((point) => [point.x, point.y]))
          .fill({ alpha, color: fill })
          .stroke({ alpha, color: stroke, width: strokeWidth });
      };
      const line = (
        start: ScreenPoint,
        end: ScreenPoint,
        color: number,
        lineWidth: number,
        alpha = 1,
      ) => {
        drawingTarget
          .moveTo(start.x, start.y)
          .lineTo(end.x, end.y)
          .stroke({ alpha, color, width: lineWidth });
      };

      scene.clear();
      waterScene.clear();
      const followX = actionPhase
        ? -Math.max(-0.2, Math.min(0.9, (chassisPosition.x - 4.2) * 0.16)) *
          scale
        : 0;
      const fallDepth = Math.max(0, -0.6 - chassisPosition.y);
      const followY = actionPhase
        ? -Math.min(1.4, fallDepth * 0.46) * scale
        : 0;
      scene.position.set(followX + shakeX, followY + shakeY);
      waterScene.position.set(followX * 0.5 + shakeX, followY * 0.45 + shakeY);
      terrainScene.position.set(
        followX * 0.82 + shakeX,
        followY * 0.8 + shakeY,
      );
      farScene.position.set(
        followX * 0.18 + shakeX * 0.2,
        followY * 0.12 + shakeY * 0.2,
      );

      if (!staticLayersReady) {
        farScene.clear();
        terrainScene.clear();
        drawingTarget = farScene;
        drawingTarget.rect(0, 0, width, height).fill({ color: 0xaedee8 });

        // Sky depth: sun, clouds, and two terrain layers.
        drawingTarget
          .circle(width * 0.84, height * 0.14, Math.max(30, width * 0.038))
          .fill({ color: 0xffd166, alpha: 0.95 })
          .circle(width * 0.84, height * 0.14, Math.max(40, width * 0.05))
          .stroke({ color: 0xffe4a0, width: 8, alpha: 0.45 });
        for (const cloud of [
          [0.14, 0.16, 1],
          [0.57, 0.1, 0.72],
        ] as const) {
          const [x, y, size] = cloud;
          drawingTarget
            .circle(width * x, height * y, 18 * size)
            .circle(width * x + 20 * size, height * y - 6, 24 * size)
            .circle(width * x + 43 * size, height * y + 1, 17 * size)
            .roundRect(width * x - 10, height * y, 66 * size, 18 * size, 9)
            .fill({ color: 0xf9fcf4, alpha: 0.86 });
        }
        polygon(
          [
            project(-4, 1.1),
            project(-1.2, 3.2),
            project(1.4, 1.15),
            project(4.1, 3.05),
            project(6.6, 1.05),
            project(9.3, 2.85),
            project(13.5, 1.1),
          ],
          0x79a985,
          0x79a985,
          0,
          0.52,
        );
        polygon(
          [
            project(-4, 0.75),
            project(-1.4, 2.1),
            project(1.1, 0.72),
            project(4.8, 2.25),
            project(7.4, 0.68),
            project(10.2, 2),
            project(13.5, 0.7),
          ],
          0x567c68,
          0x567c68,
          0,
          0.48,
        );
      }

      drawingTarget = waterScene;

      // The filled river follows a spring-coupled 41-point physical heightfield.
      const riverSurface = simulation.waterSurface.displacements.map(
        (_, index) => {
          const x = index * simulation.waterSurface.spacing;
          return project(x, simulation.waterSurface.getHeightAt(x));
        },
      );
      const firstRiverPoint = riverSurface[0]!;
      drawingTarget.moveTo(firstRiverPoint.x, firstRiverPoint.y);
      for (const point of riverSurface.slice(1)) {
        drawingTarget.lineTo(point.x, point.y);
      }
      drawingTarget
        .lineTo(project(BRIDGE_GAP_METERS, -5.4).x, project(0, -5.4).y)
        .lineTo(project(0, -5.4).x, project(0, -5.4).y)
        .closePath()
        .fill({ color: 0x2389a8 })
        .stroke({ color: 0x9be9ef, width: 5, alpha: 0.9 });
      const foamStride = quality.lowDetail ? 5 : 3;
      for (
        let index = foamStride;
        index < riverSurface.length - foamStride;
        index += foamStride
      ) {
        const point = riverSurface[index]!;
        const displacement = Math.abs(
          simulation.waterSurface.displacements[index] ?? 0,
        );
        drawingTarget
          .circle(point.x, point.y + 1, 2.5 + displacement * 12)
          .fill({
            color: 0xdffbff,
            alpha: 0.45 + Math.min(0.42, displacement * 2),
          });
      }
      for (let band = 0; band < 2; band += 1) {
        const y = simulation.waterSurface.baselineY - 0.28 - band * 0.34;
        for (let x = 0.25 + (band % 2) * 0.3; x < 8.7; x += 1.9) {
          const wave = Math.sin(snapshot.stepCount * 0.045 + x + band) * 0.12;
          line(
            project(
              x + wave,
              y +
                simulation.waterSurface.getHeightAt(x) -
                simulation.waterSurface.baselineY,
            ),
            project(
              x + 0.7 + wave,
              y +
                0.025 +
                simulation.waterSurface.getHeightAt(x + 0.7) -
                simulation.waterSurface.baselineY,
            ),
            0x8ee4e8,
            3,
            0.7,
          );
        }
      }

      const towerTop = project(-0.08, 1.62);
      const bankBottom = -5.4;
      if (!staticLayersReady) {
        drawingTarget = terrainScene;

        // Canyon banks, cliff strata, boulders, vegetation, and work-site props.
        polygon(
          [
            project(-4, 1.15),
            project(0, 1.02),
            project(0.04, -0.1),
            project(-0.28, -0.48),
            project(-0.2, bankBottom),
            project(-4, bankBottom),
          ],
          0xb9683f,
          0x4d3543,
          4,
        );
        polygon(
          [
            project(9, 1.03),
            project(13.5, 1.15),
            project(13.5, bankBottom),
            project(9.18, bankBottom),
            project(9.26, -0.5),
            project(8.96, -0.08),
          ],
          0xb9683f,
          0x4d3543,
          4,
        );
        for (const rock of [
          [-0.35, -0.55, 0.22],
          [-0.15, -1.25, 0.16],
          [9.22, -0.72, 0.21],
          [9.15, -1.55, 0.14],
          [-1.2, 0.96, 0.18],
          [10.1, 1.03, 0.22],
        ] as const) {
          const point = project(rock[0], rock[1]);
          drawingTarget
            .circle(point.x, point.y, rock[2] * scale)
            .fill({ color: 0xd79257 })
            .stroke({ color: 0x603d42, width: 3 });
        }
        for (const treeX of [-2.7, -2.15, 10.6, 11.4]) {
          const trunkTop = project(treeX, 1.55);
          const trunkBottom = project(treeX, 0.95);
          line(trunkTop, trunkBottom, 0x61402f, 7);
          const crown = project(treeX, 1.75);
          drawingTarget
            .circle(crown.x, crown.y, 0.34 * scale)
            .fill({ color: treeX < 0 ? 0x2d7656 : 0x3b815d })
            .stroke({ color: 0x244d43, width: 3 });
        }

        // Left-bank deployment tower makes the cantilever support explicit.
        const towerLeft = project(-0.32, 0.02);
        const towerRight = project(0.08, 0.02);
        line(towerLeft, towerTop, 0x263a5a, 8);
        line(towerRight, towerTop, 0x263a5a, 8);
        line(project(-0.26, 0.45), project(0.02, 0.9), 0xf0b94d, 5);
        line(project(0.02, 0.45), project(-0.22, 0.9), 0xf0b94d, 5);
        farScene.cacheAsTexture({
          antialias: quality.antialias,
          resolution: 1,
        });
        terrainScene.cacheAsTexture({
          antialias: quality.antialias,
          resolution: 1,
        });
        staticLayersReady = true;
      }

      drawingTarget = scene;
      simulation.bridgeSegments.forEach((segment, index) => {
        if (index >= deployedSegments) return;
        const supportBroken =
          (simulation.metrics.cableSnapStep !== null &&
            index === simulation.bridgeSegments.length - 1) ||
          (simulation.metrics.deckPeelStep !== null &&
            index >= simulation.bridgeSegments.length - 2) ||
          (simulation.metrics.deckReleaseStep !== null &&
            index >= simulation.bridgeSegments.length - 3);
        if (index > 0 && !supportBroken) {
          line(towerTop, bodyPoint(segment, 0, 0.02), 0x6c5748, 2.5, 0.86);
        }
      });
      if (
        simulation.metrics.cableSnapStep !== null &&
        brokenAge >= 0 &&
        brokenAge < 0.85
      ) {
        const recoil = Math.sin(Math.min(1, brokenAge / 0.55) * Math.PI);
        const end = bodyPoint(simulation.bridgeSegments.at(-1)!, 0, 0.02);
        const midpoint = {
          x: (towerTop.x + end.x) / 2 - recoil * 20,
          y: (towerTop.y + end.y) / 2 - recoil * 26,
        };
        drawingTarget
          .moveTo(towerTop.x, towerTop.y)
          .quadraticCurveTo(midpoint.x, midpoint.y, end.x - 12, end.y - 10)
          .stroke({ color: 0x6c5748, width: 3 });
      }

      // The receiving bracket remains visible across the unfilled gap. Its
      // shape—not a measurement line—makes the short bridge self-explanatory.
      const bracketActive =
        snapshot.phase === "locking" || snapshot.phase === "crossed";
      polygon(
        [
          project(8.87, 0.34),
          project(9.17, 0.34),
          project(9.17, -0.12),
          project(9.03, -0.12),
          project(9.03, 0.16),
          project(8.87, 0.16),
        ],
        bracketActive ? 0xf6c453 : 0x355f73,
        0x263a5a,
        4,
      );
      if (bracketActive) {
        const lockPulse = project(9.02, 0.44);
        scene
          .circle(
            lockPulse.x,
            lockPulse.y,
            (0.08 + Math.sin(snapshot.stepCount * 0.12) * 0.018) * scale,
          )
          .fill({ color: 0xfff27a, alpha: 0.9 })
          .stroke({ color: 0xe65d3f, width: 2 });
      }

      // Articulated deck: every rendered panel follows its Planck body.
      const segmentHalf =
        simulation.bridgeLengthMeters / simulation.bridgeSegments.length / 2;
      simulation.bridgeSegments.forEach((segment, index) => {
        if (index >= deployedSegments) return;
        const shadow = [
          bodyPoint(segment, -segmentHalf * 0.94, -0.15),
          bodyPoint(segment, segmentHalf * 0.94, -0.15),
          bodyPoint(segment, segmentHalf * 0.94, -0.28),
          bodyPoint(segment, -segmentHalf * 0.94, -0.28),
        ].map((point) => ({ x: point.x + 3, y: point.y + 5 }));
        polygon(shadow, 0x3d2f3a, 0x3d2f3a, 0, 0.34);
        polygon(
          [
            bodyPoint(segment, -segmentHalf * 0.94, 0.11),
            bodyPoint(segment, segmentHalf * 0.94, 0.11),
            bodyPoint(segment, segmentHalf * 0.94, -0.11),
            bodyPoint(segment, -segmentHalf * 0.94, -0.11),
          ],
          index % 2 === 0 ? 0xe8a04a : 0xd9853d,
          0x4b3541,
          3,
        );
        line(
          bodyPoint(segment, -segmentHalf * 0.78, -0.12),
          bodyPoint(segment, segmentHalf * 0.78, -0.12),
          0x704331,
          4,
        );
        for (const boltX of [-segmentHalf * 0.68, segmentHalf * 0.68]) {
          const bolt = bodyPoint(segment, boltX, 0.02);
          scene
            .circle(bolt.x, bolt.y, Math.max(2, scale * 0.035))
            .fill({ color: 0xffe0a3 })
            .stroke({ color: 0x4b3541, width: 1.5 });
        }
      });

      // Recognizable maintenance boat: stable hull, cabin, mast, and a small
      // lightweight canopy/cargo system that can break without capsizing it.
      polygon(
        [
          bodyPoint(simulation.boat, -1.16, 0.18),
          bodyPoint(simulation.boat, 1.16, 0.18),
          bodyPoint(simulation.boat, 0.82, -0.28),
          bodyPoint(simulation.boat, -0.78, -0.28),
        ],
        0xf0b94d,
        0x263a5a,
        4,
      );
      polygon(
        [
          bodyPoint(simulation.boat, -0.34, 0.2),
          bodyPoint(simulation.boat, 0.34, 0.2),
          bodyPoint(simulation.boat, 0.25, 0.55),
          bodyPoint(simulation.boat, -0.22, 0.55),
        ],
        0xe65d3f,
        0x263a5a,
        3,
      );
      line(
        bodyPoint(simulation.boat, -0.66, -0.04),
        bodyPoint(simulation.boat, 0.86, -0.04),
        0xffffff,
        3,
        0.86,
      );
      line(
        bodyPoint(simulation.boat, -0.08, 0.55),
        bodyPoint(simulation.boat, -0.08, 0.88),
        0x263a5a,
        3,
      );
      const mastLight = bodyPoint(simulation.boat, -0.08, 0.92);
      scene
        .circle(mastLight.x, mastLight.y, 0.07 * scale)
        .fill({ color: 0xfff27a })
        .stroke({ color: 0x263a5a, width: 2 });
      simulation.boatCanopy.forEach((piece, index) => {
        const horizontal = index === 2;
        polygon(
          [
            bodyPoint(
              piece,
              horizontal ? -0.66 : -0.07,
              horizontal ? 0.07 : 0.43,
            ),
            bodyPoint(
              piece,
              horizontal ? 0.66 : 0.07,
              horizontal ? 0.07 : 0.43,
            ),
            bodyPoint(
              piece,
              horizontal ? 0.66 : 0.07,
              horizontal ? -0.07 : -0.43,
            ),
            bodyPoint(
              piece,
              horizontal ? -0.66 : -0.07,
              horizontal ? -0.07 : -0.43,
            ),
          ],
          0x355f73,
          0x263a5a,
          3,
        );
      });
      simulation.boatCargo.forEach((crate, index) => {
        polygon(
          [
            bodyPoint(crate, -0.22, 0.22),
            bodyPoint(crate, 0.22, 0.22),
            bodyPoint(crate, 0.22, -0.22),
            bodyPoint(crate, -0.22, -0.22),
          ],
          index % 2 === 0 ? 0xe65d3f : 0xd9853d,
          0x263a5a,
          3,
        );
        line(
          bodyPoint(crate, -0.15, 0.15),
          bodyPoint(crate, 0.15, -0.15),
          0xffe0a3,
          2,
        );
      });

      // Suspension links, chassis, cab, driver, and independently rotating wheels.
      const rearMount = bodyPoint(simulation.chassis, -0.39, -0.05);
      const frontMount = bodyPoint(simulation.chassis, 0.39, -0.05);
      const rearWheelPoint = project(
        simulation.wheels[0].getPosition().x,
        simulation.wheels[0].getPosition().y,
      );
      const frontWheelPoint = project(
        simulation.wheels[1].getPosition().x,
        simulation.wheels[1].getPosition().y,
      );
      line(rearMount, rearWheelPoint, 0xf0b94d, 5);
      line(frontMount, frontWheelPoint, 0xf0b94d, 5);
      polygon(
        [
          bodyPoint(simulation.chassis, -0.7, -0.19),
          bodyPoint(simulation.chassis, 0.72, -0.19),
          bodyPoint(simulation.chassis, 0.64, 0.2),
          bodyPoint(simulation.chassis, -0.58, 0.23),
        ],
        0xe65d3f,
        0x263a5a,
        4,
      );
      polygon(
        [
          bodyPoint(simulation.chassis, -0.02, 0.2),
          bodyPoint(simulation.chassis, 0.58, 0.2),
          bodyPoint(simulation.chassis, 0.42, 0.58),
          bodyPoint(simulation.chassis, 0.09, 0.58),
        ],
        0xf47b4f,
        0x263a5a,
        4,
      );
      polygon(
        [
          bodyPoint(simulation.chassis, 0.12, 0.27),
          bodyPoint(simulation.chassis, 0.49, 0.27),
          bodyPoint(simulation.chassis, 0.39, 0.51),
          bodyPoint(simulation.chassis, 0.17, 0.51),
        ],
        0xbce7ed,
        0x263a5a,
        2,
      );
      if (snapshot.phase !== "splash" && snapshot.phase !== "aftermath") {
        const driver = bodyPoint(simulation.chassis, 0.23, 0.58);
        scene
          .circle(driver.x, driver.y, 0.12 * scale)
          .fill({ color: 0xf6c453 })
          .stroke({ color: 0x263a5a, width: 3 });
        line(
          bodyPoint(simulation.chassis, 0.13, 0.67),
          bodyPoint(simulation.chassis, 0.36, 0.67),
          0xffffff,
          4,
        );
      }
      for (const wheel of simulation.wheels) {
        const wheelPosition = project(
          wheel.getPosition().x,
          wheel.getPosition().y,
        );
        const radius = 0.235 * scale;
        scene
          .circle(wheelPosition.x, wheelPosition.y, radius)
          .fill({ color: 0x263a5a })
          .stroke({ color: 0x111d30, width: 3 })
          .circle(wheelPosition.x, wheelPosition.y, radius * 0.48)
          .fill({ color: 0xf0b94d })
          .stroke({ color: 0xffdf85, width: 2 });
        for (let spoke = 0; spoke < 4; spoke += 1) {
          const angle = wheel.getAngle() + (spoke / 4) * Math.PI * 2;
          line(
            wheelPosition,
            {
              x: wheelPosition.x + Math.cos(angle) * radius * 0.72,
              y: wheelPosition.y - Math.sin(angle) * radius * 0.72,
            },
            0xf9f3df,
            2,
          );
        }
      }
      if (simulation.bumper !== null) {
        polygon(
          [
            bodyPoint(simulation.bumper, -0.15, 0.07),
            bodyPoint(simulation.bumper, 0.15, 0.07),
            bodyPoint(simulation.bumper, 0.15, -0.07),
            bodyPoint(simulation.bumper, -0.15, -0.07),
          ],
          0xf0b94d,
          0x263a5a,
          2,
        );
      }
      for (const pontoon of simulation.pontoons) {
        polygon(
          [
            bodyPoint(pontoon, -0.32, 0.11),
            bodyPoint(pontoon, 0.32, 0.11),
            bodyPoint(pontoon, 0.32, -0.11),
            bodyPoint(pontoon, -0.32, -0.11),
          ],
          0xff8a47,
          0xffffff,
          4,
        );
      }

      // Dust at structural failure. Count drops for reduced motion/mobile.
      if (brokenAge >= 0 && brokenAge < 1.45) {
        const dustCount = quality.lowDetail ? 6 : 14;
        const origin = project(simulation.bridgeLengthMeters - 0.82, -0.02);
        for (let index = 0; index < dustCount; index += 1) {
          const direction = -1 + (index / Math.max(1, dustCount - 1)) * 2;
          const life = Math.max(0, 1 - brokenAge / 1.45);
          const x = origin.x + direction * brokenAge * scale * 0.72;
          const y =
            origin.y -
            (0.7 + (index % 4) * 0.18) * brokenAge * scale +
            brokenAge * brokenAge * scale * 0.48;
          scene.circle(x, y, (3 + (index % 3) * 2) * life).fill({
            color: index % 2 === 0 ? 0xd9b27b : 0x8e6b54,
            alpha: life,
          });
        }
      }

      // Large splash, ballistic spray, and spreading ripples at the physical impact point.
      const impactX = simulation.metrics.waterImpactX ?? chassisPosition.x;
      if (impactAge >= 0) {
        const impactWaterY = simulation.waterSurface.getHeightAt(impactX);
        const impact = project(impactX, impactWaterY);
        if (impactAge < 2.15) {
          const fan = Math.sin(
            Math.min(1, Math.max(0, impactAge / 1.35)) * Math.PI,
          );
          if (fan > 0.02) {
            polygon(
              [
                project(impactX - 0.34, impactWaterY),
                project(impactX - 0.76 - fan * 0.5, impactWaterY + fan * 1.65),
                project(impactX - 0.02, impactWaterY + 0.14),
              ],
              0xcff9ff,
              0x8ee4ee,
              2,
              0.78,
            );
            polygon(
              [
                project(impactX + 0.3, impactWaterY),
                project(impactX + 0.82 + fan * 0.55, impactWaterY + fan * 1.85),
                project(impactX + 0.02, impactWaterY + 0.12),
              ],
              0xe4fcff,
              0x8ee4ee,
              2,
              0.82,
            );
          }
          const dropletCount = quality.lowDetail ? 8 : 18;
          for (let index = 0; index < dropletCount; index += 1) {
            const side = index % 2 === 0 ? -1 : 1;
            const horizontal = (0.55 + (index % 11) * 0.075) * side;
            const vertical = 4.4 + (index % 9) * 0.4;
            const x = impactX + horizontal * impactAge;
            const y =
              impactWaterY + vertical * impactAge - 3.4 * impactAge * impactAge;
            const point = project(x, y);
            const life = Math.max(0, 1 - impactAge / 2.15);
            scene.circle(point.x, point.y, 2.5 + (index % 4)).fill({
              color: index % 3 === 0 ? 0xe4fbff : 0x76d6e6,
              alpha: life,
            });
          }
          scene
            .ellipse(
              impact.x,
              impact.y - Math.max(0, 42 - impactAge * 26),
              Math.max(8, 74 - impactAge * 18),
              Math.max(5, 94 - impactAge * 34),
            )
            .fill({
              color: 0xdffbff,
              alpha: Math.max(0, 0.72 - impactAge * 0.25),
            });
        }
        for (let ripple = 0; ripple < 4; ripple += 1) {
          const age = Math.max(0, impactAge - ripple * 0.22);
          if (age <= 0) continue;
          const radius = Math.min(
            scale * 2.5,
            age * scale * (0.9 + ripple * 0.12),
          );
          scene
            .ellipse(impact.x, impact.y + ripple * 4, radius, radius * 0.18)
            .stroke({
              color: ripple % 2 === 0 ? 0xe8ffff : 0x9be9ef,
              width: Math.max(2, 6 - age),
              alpha: Math.max(0.12, 0.8 - age * 0.12),
            });
        }
      }

      // Comic safety beat: the physical orange pontoons raise the vehicle while
      // the driver appears in a clearly readable flotation collar.
      if (snapshot.phase === "splash" || snapshot.phase === "aftermath") {
        const rescueX = impactX + 0.22;
        const rescue = project(
          rescueX,
          simulation.waterSurface.getHeightAt(rescueX) +
            0.33 +
            Math.sin(snapshot.stepCount * 0.085) * 0.035,
        );
        scene
          .circle(rescue.x, rescue.y + 2, 0.14 * scale)
          .fill({ color: 0xf6c453 })
          .stroke({ color: 0x263a5a, width: 3 });
        line(
          { x: rescue.x - 0.14 * scale, y: rescue.y - 0.08 * scale },
          { x: rescue.x + 0.14 * scale, y: rescue.y - 0.08 * scale },
          0xffffff,
          4,
        );
        scene
          .ellipse(
            rescue.x,
            rescue.y + 0.16 * scale,
            0.25 * scale,
            0.11 * scale,
          )
          .stroke({ color: 0xff7b3d, width: 9 })
          .stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
        if (impactAge > 1.1) {
          line(
            { x: rescue.x + 0.2 * scale, y: rescue.y - 0.08 * scale },
            { x: rescue.x + 0.38 * scale, y: rescue.y - 0.22 * scale },
            0xf6c453,
            4,
          );
          line(
            { x: rescue.x + 0.32 * scale, y: rescue.y - 0.27 * scale },
            { x: rescue.x + 0.42 * scale, y: rescue.y - 0.38 * scale },
            0xffffff,
            3,
          );
        }
      }

      // Right-bank spotter and safety sign add scale and a comic witness.
      const spotter = project(10.15, 1.34);
      scene
        .circle(spotter.x, spotter.y, 0.12 * scale)
        .fill({ color: 0xf6c453 })
        .stroke({ color: 0x263a5a, width: 3 });
      line(project(10.15, 1.22), project(10.15, 0.83), 0x174e70, 7);
      line(project(10.15, 1.08), project(9.88, 1.25), 0x174e70, 5);
      line(project(10.15, 1.08), project(10.43, 1.3), 0x174e70, 5);
      polygon(
        [project(9.52, 1.06), project(9.8, 1.55), project(10.08, 1.06)],
        0xf6c453,
        0x263a5a,
        3,
      );
      if (simulation.metrics.successStep !== null) {
        const beacon = project(9.72, 1.76);
        scene
          .circle(
            beacon.x,
            beacon.y,
            (0.14 + Math.sin(snapshot.stepCount * 0.1) * 0.025) * scale,
          )
          .fill({ color: 0xfff27a, alpha: 0.92 })
          .stroke({ color: 0xe65d3f, width: 5 });
        line(project(10.15, 1.08), project(9.86, 1.45), 0x174e70, 5);
        line(project(10.15, 1.08), project(10.45, 1.43), 0x174e70, 5);
      }

      app.render();
    };

    const advance = () => {
      while (terminal === "running" && steps < BRIDGE_MAX_STEPS) {
        terminal = simulation.step();
        steps += 1;
      }
      const snapshot = simulation.getSnapshot();
      announcePhase(snapshot.phase);
      if (terminal !== "running") setStatus(terminal);
      renderScene();
    };
    skipRef.current = advance;

    const initialize = async () => {
      try {
        if (shouldForceRendererFailure(window))
          throw new Error("Injected renderer failure");
        const stageHeight = host.clientWidth < 700 ? 500 : 620;
        const renderWidth = Math.max(
          320,
          Math.round(host.clientWidth * wrongSceneRenderScale),
        );
        const renderHeight = Math.round(stageHeight * wrongSceneRenderScale);
        await app.init({
          antialias: run.outcome.isMathematicallyCorrect && quality.antialias,
          autoStart: false,
          backgroundColor: 0xaedee8,
          height: renderHeight,
          preference: "webgl",
          resolution: quality.resolution,
          width: renderWidth,
        });
        initialized = true;
        if (cancelled) {
          app.destroy({ removeView: true }, { children: true });
          return;
        }
        app.stage.addChild(farScene, waterScene, terrainScene, scene);
        host.replaceChildren(app.canvas);
        app.canvas.setAttribute("aria-hidden", "true");
        app.canvas.className = "simulation-canvas simulation-canvas--bridge";
        resizeObserver = new ResizeObserver(() => {
          const nextHeight = host.clientWidth < 700 ? 500 : 620;
          app.renderer.resize(
            Math.max(320, Math.round(host.clientWidth * wrongSceneRenderScale)),
            Math.round(nextHeight * wrongSceneRenderScale),
          );
          farScene.cacheAsTexture(false);
          terrainScene.cacheAsTexture(false);
          staticLayersReady = false;
          renderScene();
        });
        resizeObserver.observe(host);

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
            const snapshot = simulation.getSnapshot();
            announcePhase(snapshot.phase);
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
      if (initialized) app.destroy({ removeView: true }, { children: true });
    };
  }, [generation, playEffect, quality, run]);

  const expectedStatus = run.outcome.isMathematicallyCorrect
    ? "crossed"
    : "recovered";
  const outcomeTitle =
    expectedStatus === "crossed"
      ? "Safe crossing"
      : status === "running"
        ? "Bridge test in progress"
        : "Bridge test complete";
  const transcript =
    expectedStatus === "crossed"
      ? `The ${run.inputs.deployedLengthMeters} meter bridge spans the 9 meter ravine. The rescue vehicle crosses safely.`
      : `It was built from your answer: ${run.inputs.deployedLengthMeters} m. It sagged, lost a support cable, and sent the vehicle through the maintenance boat canopy into the river. Emergency pontoons brought the driver safely back to the surface.`;

  return (
    <article
      className="simulation-card"
      aria-labelledby={`run-${run.id}`}
      data-attempt-run={run.attemptId}
    >
      <div className="simulation-card__heading">
        <div>
          <p className="feed-card__label">Your bridge test</p>
          <h2 id={`run-${run.id}`}>{outcomeTitle}</h2>
        </div>
        <strong className={`result-pill result-pill--${expectedStatus}`}>
          {run.inputs.deployedLengthMeters} m
        </strong>
      </div>
      <div
        className="simulation-stage simulation-stage--bridge"
        data-simulation-events={phaseHistory.join(",")}
        data-simulation-phase={visualPhase}
      >
        <div className="simulation-stage__canvas-host" ref={canvasHostRef} />
        {!rendererError && (
          <div className="bridge-meter" aria-hidden="true">
            <strong>
              Built from your answer: {run.inputs.deployedLengthMeters} m
            </strong>
          </div>
        )}
        {rendererError && (
          <p className="renderer-fallback">
            The visual renderer is unavailable. Your result remains below.
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
            setVisualPhase("deploying");
            setPhaseHistory(["deploying"]);
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
          aria-label={muted ? "Turn sound on" : "Mute sound"}
          aria-pressed={!muted}
          className="tool-button"
          onClick={toggleSound}
          type="button"
        >
          {muted ? "Sound muted" : "Sound on"}
        </button>
      </div>
      {status !== "running" && (
        <div className="simulation-transcript" aria-live="polite">
          <strong>Result ready</strong>
          <p>{transcript}</p>
          {run.outcome.isMathematicallyCorrect && (
            <p>
              Each quarter is 3 meters. Three quarters is 9 meters.
              Equivalently, 3/4 is 0.75.
            </p>
          )}
        </div>
      )}
      {studentPerspective &&
        !run.outcome.isMathematicallyCorrect &&
        status !== "running" && (
          <LearnerBridgeFeedback onTryAgain={onTryAgain} />
        )}
      {!studentPerspective &&
        !run.outcome.isMathematicallyCorrect &&
        status !== "running" && (
          <section className="teacher-diagnosis">
            <strong>
              Likely misconception: the learner treated the numerator and
              denominator as decimal digits.
            </strong>
          </section>
        )}
    </article>
  );
}
