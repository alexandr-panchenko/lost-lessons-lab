import { Box, Vec2, World, type Body } from "planck";

import type { SpeedOutcome } from "../../shared/domain/speed";

export const SPEED_FIXED_STEP_SECONDS = 1 / 60;
export const SPEED_MAX_STEPS = 360;
const BUMPER_X = 10;

export type SpeedWorldStatus = "running" | "arrived" | "collided";

export type SpeedWorld = {
  bodyCount: number;
  bumperX: number;
  collided: () => boolean;
  destroy: () => void;
  shuttle: Body;
  step: () => SpeedWorldStatus;
  targetX: number;
  world: World;
};

export function createSpeedWorld(outcome: SpeedOutcome): SpeedWorld {
  const world = new World(Vec2(0, 0));
  const track = world.createBody({ position: Vec2(5, -0.55) });
  track.createFixture(Box(7, 0.12), { friction: 0.6 });
  const bumper = world.createBody({ position: Vec2(BUMPER_X, 0) });
  bumper.createFixture(Box(0.16, 1), { restitution: 0.05 });
  const shuttle = world.createDynamicBody({
    allowSleep: false,
    bullet: true,
    fixedRotation: true,
    position: Vec2(0, 0),
  });
  shuttle.createFixture(Box(0.38, 0.28), {
    density: 1,
    friction: 0.3,
    restitution: 0.05,
  });
  shuttle.setBullet(true);
  const targetX = outcome.travelRatio * BUMPER_X;
  const travelSpeed = Math.max(6, Math.min(120, targetX / 1.25));
  shuttle.setLinearVelocity(Vec2(travelSpeed, 0));
  let didCollide = false;
  world.on("begin-contact", (contact) => {
    const bodyA = contact.getFixtureA().getBody();
    const bodyB = contact.getFixtureB().getBody();
    if (
      (bodyA === shuttle && bodyB === bumper) ||
      (bodyB === shuttle && bodyA === bumper)
    ) {
      didCollide = true;
    }
  });

  function step(): SpeedWorldStatus {
    world.step(SPEED_FIXED_STEP_SECONDS, 8, 3);
    if (didCollide) return "collided";
    if (targetX < BUMPER_X && shuttle.getPosition().x >= targetX) {
      shuttle.setTransform(Vec2(targetX, 0), 0);
      shuttle.setLinearVelocity(Vec2(0, 0));
      shuttle.setAwake(false);
      return "arrived";
    }
    return "running";
  }
  function destroy(): void {
    for (let body = world.getBodyList(); body;) {
      const next = body.getNext();
      world.destroyBody(body);
      body = next;
    }
  }
  return {
    bodyCount: world.getBodyCount(),
    bumperX: BUMPER_X,
    collided: () => didCollide,
    destroy,
    shuttle,
    step,
    targetX,
    world,
  };
}

export function runSpeedWorldToResult(outcome: SpeedOutcome): {
  bodyCount: number;
  collided: boolean;
  finite: boolean;
  shuttleX: number;
  status: Exclude<SpeedWorldStatus, "running">;
  steps: number;
} {
  const simulation = createSpeedWorld(outcome);
  let status: SpeedWorldStatus = "running";
  let steps = 0;
  while (status === "running" && steps < SPEED_MAX_STEPS) {
    status = simulation.step();
    steps += 1;
  }
  if (status === "running") throw new Error("Speed world did not terminate");
  const shuttlePosition = simulation.shuttle.getPosition();
  const result = {
    bodyCount: simulation.bodyCount,
    collided: simulation.collided(),
    finite:
      Number.isFinite(shuttlePosition.x) && Number.isFinite(shuttlePosition.y),
    shuttleX: shuttlePosition.x,
    status,
    steps,
  };
  simulation.destroy();
  return result;
}
