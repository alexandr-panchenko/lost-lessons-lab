import { Box, Vec2, World, type Body } from "planck";

import type { StructureOutcome } from "../../shared/domain/structure";

export const STRUCTURE_FIXED_STEP_SECONDS = 1 / 60;
export const STRUCTURE_MAX_STEPS = 360;
export const STRUCTURE_MAX_FRAGMENTS = 12;

export type StructureWorldStatus = "running" | "settled";

export type StructureWorld = {
  bodyCount: number;
  destroy: () => void;
  fragments: Body[];
  step: () => StructureWorldStatus;
  world: World;
};

export function createStructureWorld(
  outcome: StructureOutcome,
): StructureWorld {
  const world = new World(Vec2(0, -9.8));
  const ground = world.createBody({ position: Vec2(0, -0.2) });
  ground.createFixture(Box(12, 0.2), { friction: 0.7 });
  const fragments: Body[] = [];
  if (outcome.resultClass === "structure_collapse") {
    for (let index = 0; index < STRUCTURE_MAX_FRAGMENTS; index += 1) {
      const fragment = world.createDynamicBody({
        allowSleep: true,
        position: Vec2(-2.75 + index * 0.5, 2.2 + (index % 3) * 0.18),
      });
      fragment.createFixture(Box(0.22, 0.13), {
        density: 0.8,
        friction: 0.6,
        restitution: 0.08,
      });
      fragment.setLinearVelocity(
        Vec2((index - 5.5) * 0.18, 0.5 + (index % 2) * 0.25),
      );
      fragment.setAngularVelocity(
        (index % 2 === 0 ? -1 : 1) * (0.8 + index * 0.08),
      );
      fragments.push(fragment);
    }
  } else {
    const platform = world.createBody({ position: Vec2(0, 2.1) });
    platform.createFixture(Box(3.2, 0.18), { friction: 0.8 });
  }
  let steps = 0;
  function step(): StructureWorldStatus {
    world.step(STRUCTURE_FIXED_STEP_SECONDS, 8, 3);
    steps += 1;
    return steps >= 300 || fragments.every((body) => !body.isAwake())
      ? "settled"
      : "running";
  }
  function destroy(): void {
    for (let body = world.getBodyList(); body;) {
      const next = body.getNext();
      world.destroyBody(body);
      body = next;
    }
    fragments.length = 0;
  }
  return { bodyCount: world.getBodyCount(), destroy, fragments, step, world };
}

export function runStructureWorldToResult(outcome: StructureOutcome): {
  bodyCount: number;
  finite: boolean;
  fragmentCount: number;
  maxAbsPosition: number;
  status: "settled";
  steps: number;
} {
  const simulation = createStructureWorld(outcome);
  let status: StructureWorldStatus = "running";
  let steps = 0;
  let finite = true;
  let maxAbsPosition = 0;
  while (status === "running" && steps < STRUCTURE_MAX_STEPS) {
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
  if (status !== "settled") throw new Error("Structure world did not settle");
  const result = {
    bodyCount: simulation.bodyCount,
    finite,
    fragmentCount: simulation.fragments.length,
    maxAbsPosition,
    status,
    steps,
  };
  simulation.destroy();
  return result;
}
