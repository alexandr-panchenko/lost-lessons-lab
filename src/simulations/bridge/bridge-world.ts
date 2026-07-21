import { Box, Circle, Vec2, World, type Body } from "planck";

import type { BridgeOutcome } from "../../shared/domain/bridge";

export const BRIDGE_FIXED_STEP_SECONDS = 1 / 60;
export const BRIDGE_MAX_STEPS = 720;
export const BRIDGE_GAP_METERS = 9;

export type BridgeWorldStatus = "running" | "crossed" | "recovered";

export type BridgeWorld = {
  bodyCount: number;
  bridgeLengthMeters: number;
  step: () => BridgeWorldStatus;
  vehicle: Body;
  world: World;
};

export function createBridgeWorld(outcome: BridgeOutcome): BridgeWorld {
  const world = new World(Vec2(0, -9.8));
  const bridgeLengthMeters = outcome.submittedInputs.deployedLengthMeters;

  const leftGround = world.createBody({ position: Vec2(-5, -0.5) });
  leftGround.createFixture(Box(5, 0.5), { friction: 0.8 });

  const rightGround = world.createBody({
    position: Vec2(BRIDGE_GAP_METERS + 5, -0.5),
  });
  rightGround.createFixture(Box(5, 0.5), { friction: 0.8 });

  const bridge = world.createBody({
    position: Vec2(bridgeLengthMeters / 2, -0.08),
  });
  bridge.createFixture(Box(bridgeLengthMeters / 2, 0.08), {
    friction: 0.9,
  });

  const vehicle = world.createDynamicBody({
    allowSleep: false,
    bullet: true,
    fixedRotation: true,
    position: Vec2(-1.5, 0.45),
  });
  vehicle.createFixture(Box(0.42, 0.22), {
    density: 1.2,
    friction: 0.6,
  });
  vehicle.createFixture(Circle(Vec2(0, -0.22), 0.16), {
    density: 0.6,
    friction: 1,
  });
  vehicle.setBullet(true);

  function step(): BridgeWorldStatus {
    const position = vehicle.getPosition();
    const velocity = vehicle.getLinearVelocity();
    if (position.y > -0.6) {
      vehicle.setLinearVelocity(Vec2(3.1, velocity.y));
    }
    world.step(BRIDGE_FIXED_STEP_SECONDS, 8, 3);
    const next = vehicle.getPosition();
    if (next.x >= BRIDGE_GAP_METERS + 1) return "crossed";
    if (next.y <= -2.2) return "recovered";
    return "running";
  }

  return {
    bodyCount: world.getBodyCount(),
    bridgeLengthMeters,
    step,
    vehicle,
    world,
  };
}

export function runBridgeWorldToResult(outcome: BridgeOutcome): {
  bodyCount: number;
  finite: boolean;
  maxAbsPosition: number;
  status: Exclude<BridgeWorldStatus, "running">;
  steps: number;
} {
  const simulation = createBridgeWorld(outcome);
  let status: BridgeWorldStatus = "running";
  let steps = 0;
  let finite = true;
  let maxAbsPosition = 0;

  while (status === "running" && steps < BRIDGE_MAX_STEPS) {
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
  if (status === "running") throw new Error("Bridge world did not settle");
  return {
    bodyCount: simulation.bodyCount,
    finite,
    maxAbsPosition,
    status,
    steps,
  };
}
