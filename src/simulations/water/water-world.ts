import { Box, Circle, Vec2, World, type Body } from "planck";

import type { WaterOutcome } from "../../shared/domain/water";

export const WATER_FIXED_STEP_SECONDS = 1 / 60;
export const WATER_MAX_STEPS = 360;
export const WATER_MAX_DROPLETS = 20;

export type WaterWorldStatus = "running" | "settled";

export type WaterWorld = {
  bodyCount: number;
  destroy: () => void;
  droplets: Body[];
  step: () => WaterWorldStatus;
  world: World;
};

export function createWaterWorld(outcome: WaterOutcome): WaterWorld {
  const world = new World(Vec2(0, -9.8));
  const floor = world.createBody({ position: Vec2(0, -0.2) });
  floor.createFixture(Box(20, 0.2), { friction: 0.4 });
  const leftWall = world.createBody({ position: Vec2(-2.2, 1.8) });
  leftWall.createFixture(Box(0.15, 2), { friction: 0.2 });
  const rightWall = world.createBody({ position: Vec2(2.2, 1.8) });
  rightWall.createFixture(Box(0.15, 2), { friction: 0.2 });

  const overflowRatio = Math.max(0, outcome.fillRatio - 1);
  const dropletCount = Math.min(
    WATER_MAX_DROPLETS,
    Math.ceil(overflowRatio * WATER_MAX_DROPLETS),
  );
  const droplets = Array.from({ length: dropletCount }, (_, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const droplet = world.createDynamicBody({
      allowSleep: true,
      bullet: true,
      position: Vec2(side * (2.45 + (index % 4) * 0.18), 4.1 + index * 0.08),
    });
    droplet.createFixture(Circle(0.11), {
      density: 0.5,
      friction: 0.1,
      restitution: 0.15,
    });
    droplet.setBullet(true);
    return droplet;
  });
  let steps = 0;
  function destroy(): void {
    for (let body = world.getBodyList(); body;) {
      const next = body.getNext();
      world.destroyBody(body);
      body = next;
    }
    droplets.length = 0;
  }
  function step(): WaterWorldStatus {
    world.step(WATER_FIXED_STEP_SECONDS, 8, 3);
    steps += 1;
    return steps >= 240 || droplets.every((body) => !body.isAwake())
      ? "settled"
      : "running";
  }
  return { bodyCount: world.getBodyCount(), destroy, droplets, step, world };
}

export function runWaterWorldToResult(outcome: WaterOutcome): {
  bodyCount: number;
  dropletCount: number;
  finite: boolean;
  maxAbsPosition: number;
  status: "settled";
  steps: number;
} {
  const simulation = createWaterWorld(outcome);
  let status: WaterWorldStatus = "running";
  let steps = 0;
  let finite = true;
  let maxAbsPosition = 0;
  while (status === "running" && steps < WATER_MAX_STEPS) {
    status = simulation.step();
    steps += 1;
    for (
      let body = simulation.world.getBodyList();
      body;
      body = body.getNext()
    ) {
      const position = body.getPosition();
      finite &&= Number.isFinite(position.x) && Number.isFinite(position.y);
      maxAbsPosition = Math.max(
        maxAbsPosition,
        Math.abs(position.x),
        Math.abs(position.y),
      );
    }
  }
  if (status !== "settled") throw new Error("Water world did not settle");
  const result = {
    bodyCount: simulation.bodyCount,
    dropletCount: simulation.droplets.length,
    finite,
    maxAbsPosition,
    status,
    steps,
  };
  simulation.destroy();
  return result;
}
