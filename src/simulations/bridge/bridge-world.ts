import {
  Box,
  Circle,
  DistanceJoint,
  RevoluteJoint,
  Vec2,
  WeldJoint,
  WheelJoint,
  World,
  type Body,
} from "planck";

import type { BridgeOutcome } from "../../shared/domain/bridge";

export const BRIDGE_FIXED_STEP_SECONDS = 1 / 60;
export const BRIDGE_MAX_STEPS = 1080;
export const BRIDGE_GAP_METERS = 9;
export const BRIDGE_WATER_SURFACE_Y = -2.35;

const DEPLOYMENT_STEPS = 150;
const DRIVE_START_STEPS = 180;
const AFTERMATH_STEPS = 435;
const BRIDGE_SEGMENT_TARGET_METERS = 0.68;

export type BridgeWorldStatus = "running" | "crossed" | "recovered";
export type BridgeVisualPhase =
  | "deploying"
  | "driving"
  | "failing"
  | "falling"
  | "splash"
  | "aftermath"
  | "crossed";

export type BridgeWorldMetrics = {
  bridgeBreakStep: number | null;
  brokenBridgeJoints: number;
  frontWheelExitedDeck: boolean;
  maxBridgeAbsAngle: number;
  maxBridgeJointForce: number;
  maxVehicleAbsAngle: number;
  vehicleEnteredWater: boolean;
  waterImpactX: number | null;
  waterImpactStep: number | null;
};

export type BridgeWorldSnapshot = {
  deploymentProgress: number;
  phase: BridgeVisualPhase;
  stepCount: number;
};

export type BridgeWorld = {
  bodyCount: number;
  bridgeJoints: Array<DistanceJoint | RevoluteJoint | WeldJoint>;
  bridgeLengthMeters: number;
  bridgeSegments: Body[];
  chassis: Body;
  destroy: () => void;
  getSnapshot: () => BridgeWorldSnapshot;
  metrics: BridgeWorldMetrics;
  step: () => BridgeWorldStatus;
  vehicle: Body;
  wheelJoints: [WheelJoint, WheelJoint];
  wheels: [Body, Body];
  world: World;
  supportJoints: DistanceJoint[];
};

function applyWaterForces(body: Body, lift: number): void {
  const depth = Math.min(
    1.5,
    Math.max(0, BRIDGE_WATER_SURFACE_Y - body.getPosition().y),
  );
  if (depth === 0) return;
  body.setLinearDamping(2.6);
  body.setAngularDamping(2.1);
  body.applyForceToCenter(Vec2(0, body.getMass() * 11.5 * depth * lift), true);
}

function requireJoint<T>(joint: T | null): T {
  if (joint === null) throw new Error("Planck rejected a bridge joint");
  return joint;
}

export function createBridgeWorld(outcome: BridgeOutcome): BridgeWorld {
  const world = new World(Vec2(0, -9.8));
  const bridgeLengthMeters = outcome.submittedInputs.deployedLengthMeters;
  const isCorrect = outcome.isMathematicallyCorrect;

  const leftGround = world.createBody({ position: Vec2(-4, -0.55) });
  leftGround.createFixture(Box(4, 0.55), { friction: 1.1 });

  const rightGround = world.createBody({
    position: Vec2(BRIDGE_GAP_METERS + 4, -0.55),
  });
  rightGround.createFixture(Box(4, 0.55), { friction: 1.1 });

  const riverBed = world.createBody({
    position: Vec2(BRIDGE_GAP_METERS / 2, -3.82),
  });
  riverBed.createFixture(Box(BRIDGE_GAP_METERS / 2, 0.25), {
    friction: 0.65,
    restitution: 0.05,
  });

  const segmentCount = Math.max(
    4,
    Math.ceil(bridgeLengthMeters / BRIDGE_SEGMENT_TARGET_METERS),
  );
  const segmentLength = bridgeLengthMeters / segmentCount;
  const bridgeSegments: Body[] = [];
  const bridgeJoints: Array<DistanceJoint | RevoluteJoint | WeldJoint> = [];
  const deckJoints: Array<RevoluteJoint | WeldJoint> = [];
  const supportJoints: DistanceJoint[] = [];

  for (let index = 0; index < segmentCount; index += 1) {
    const segment = world.createDynamicBody({
      allowSleep: false,
      angularDamping: 0.22,
      position: Vec2(segmentLength * (index + 0.5), 0.11),
    });
    segment.createFixture(Box(segmentLength * 0.475, 0.105), {
      density: 0.62,
      filterGroupIndex: -2,
      friction: 1.15,
      restitution: 0.02,
    });
    bridgeSegments.push(segment);
  }

  const leftAnchorJoint = requireJoint(
    world.createJoint(
      new RevoluteJoint(
        {
          enableLimit: true,
          lowerAngle: -0.02,
          upperAngle: 0.02,
        },
        leftGround,
        bridgeSegments[0]!,
        Vec2(0, 0.11),
      ),
    ),
  );
  bridgeJoints.push(leftAnchorJoint);
  deckJoints.push(leftAnchorJoint);
  for (let index = 1; index < bridgeSegments.length; index += 1) {
    const deckJoint = requireJoint(
      world.createJoint(
        new WeldJoint(
          {
            dampingRatio: 0.8,
            frequencyHz: 0,
          },
          bridgeSegments[index - 1]!,
          bridgeSegments[index]!,
          Vec2(segmentLength * index, 0.11),
        ),
      ),
    );
    bridgeJoints.push(deckJoint);
    deckJoints.push(deckJoint);
  }
  const supportTowerAnchor = Vec2(-0.08, 1.62);
  for (let index = 1; index < bridgeSegments.length; index += 1) {
    const segment = bridgeSegments[index]!;
    const supportJoint = requireJoint(
      world.createJoint(
        new DistanceJoint(
          {
            dampingRatio: 0.68,
            frequencyHz: 3.6,
          },
          leftGround,
          segment,
          supportTowerAnchor,
          segment.getPosition(),
        ),
      ),
    );
    supportJoints.push(supportJoint);
    bridgeJoints.push(supportJoint);
  }
  if (isCorrect) {
    const rightAnchorJoint = requireJoint(
      world.createJoint(
        new RevoluteJoint(
          {
            enableLimit: true,
            lowerAngle: -0.02,
            upperAngle: 0.02,
          },
          bridgeSegments.at(-1)!,
          rightGround,
          Vec2(BRIDGE_GAP_METERS, 0.11),
        ),
      ),
    );
    bridgeJoints.push(rightAnchorJoint);
    deckJoints.push(rightAnchorJoint);
  }

  const chassis = world.createDynamicBody({
    allowSleep: false,
    angularDamping: 0.12,
    bullet: true,
    position: Vec2(-1.65, 0.64),
  });
  chassis.createFixture(Box(0.62, 0.2), {
    density: 1.65,
    friction: 0.45,
  });
  chassis.createFixture(Box(0.3, 0.18, Vec2(0.2, 0.31), 0), {
    density: 0.8,
    friction: 0.35,
  });
  chassis.setBullet(true);

  const rearWheel = world.createDynamicBody({
    allowSleep: false,
    bullet: true,
    position: Vec2(-2.03, 0.3),
  });
  rearWheel.createFixture(Circle(0.235), {
    density: 1.15,
    friction: 2.2,
    restitution: 0.06,
  });
  rearWheel.setBullet(true);

  const frontWheel = world.createDynamicBody({
    allowSleep: false,
    bullet: true,
    position: Vec2(-1.23, 0.3),
  });
  frontWheel.createFixture(Circle(0.235), {
    density: 1.15,
    friction: 2.2,
    restitution: 0.06,
  });
  frontWheel.setBullet(true);

  const wheelJointOptions = {
    dampingRatio: 0.78,
    enableMotor: false,
    frequencyHz: 5.4,
    maxMotorTorque: 18,
    motorSpeed: -9.2,
  } as const;
  const rearJoint = requireJoint(
    world.createJoint(
      new WheelJoint(
        wheelJointOptions,
        chassis,
        rearWheel,
        rearWheel.getPosition(),
        Vec2(0, 1),
      ),
    ),
  );
  const frontJoint = requireJoint(
    world.createJoint(
      new WheelJoint(
        wheelJointOptions,
        chassis,
        frontWheel,
        frontWheel.getPosition(),
        Vec2(0, 1),
      ),
    ),
  );
  const wheelJoints: [WheelJoint, WheelJoint] = [rearJoint, frontJoint];
  const wheels: [Body, Body] = [rearWheel, frontWheel];

  const metrics: BridgeWorldMetrics = {
    bridgeBreakStep: null,
    brokenBridgeJoints: 0,
    frontWheelExitedDeck: false,
    maxBridgeAbsAngle: 0,
    maxBridgeJointForce: 0,
    maxVehicleAbsAngle: 0,
    vehicleEnteredWater: false,
    waterImpactX: null,
    waterImpactStep: null,
  };
  const destroyedBridgeJoints = new Set<
    DistanceJoint | RevoluteJoint | WeldJoint
  >();
  let stepCount = 0;
  let status: BridgeWorldStatus = "running";

  function breakUnsupportedEnd(): void {
    if (metrics.bridgeBreakStep !== null || bridgeSegments.length < 4) return;
    metrics.bridgeBreakStep = stepCount;
    const failingJoints = [
      deckJoints[Math.max(1, bridgeSegments.length - 3)],
      deckJoints[Math.max(2, bridgeSegments.length - 2)],
      supportJoints.at(-2),
      supportJoints.at(-1),
    ];
    for (const joint of failingJoints) {
      if (joint === undefined || destroyedBridgeJoints.has(joint)) continue;
      world.destroyJoint(joint);
      destroyedBridgeJoints.add(joint);
      metrics.brokenBridgeJoints += 1;
    }
    const penultimate = bridgeSegments.at(-2)!;
    const last = bridgeSegments.at(-1)!;
    penultimate.applyAngularImpulse(0.72, true);
    last.applyLinearImpulse(Vec2(0.2, -0.04), last.getWorldCenter(), true);
    last.applyAngularImpulse(-0.68, true);
    chassis.applyAngularImpulse(-0.92, true);
  }

  function getSnapshot(): BridgeWorldSnapshot {
    let phase: BridgeVisualPhase;
    if (status === "crossed") phase = "crossed";
    else if (metrics.waterImpactStep !== null) {
      phase = stepCount - metrics.waterImpactStep < 52 ? "splash" : "aftermath";
    } else if (metrics.bridgeBreakStep !== null) {
      phase = chassis.getPosition().y > -0.55 ? "failing" : "falling";
    } else if (stepCount < DEPLOYMENT_STEPS) phase = "deploying";
    else phase = "driving";
    return {
      deploymentProgress: Math.min(1, stepCount / DEPLOYMENT_STEPS),
      phase,
      stepCount,
    };
  }

  function step(): BridgeWorldStatus {
    if (status !== "running") return status;
    stepCount += 1;
    if (stepCount === DRIVE_START_STEPS) {
      for (const joint of wheelJoints) joint.enableMotor(true);
    }

    applyWaterForces(chassis, 1.05);
    applyWaterForces(rearWheel, 0.82);
    applyWaterForces(frontWheel, 0.82);
    for (const segment of bridgeSegments) applyWaterForces(segment, 0.72);

    world.step(BRIDGE_FIXED_STEP_SECONDS, 10, 5);

    for (const joint of bridgeJoints) {
      if (destroyedBridgeJoints.has(joint)) continue;
      metrics.maxBridgeJointForce = Math.max(
        metrics.maxBridgeJointForce,
        joint.getReactionForce(1 / BRIDGE_FIXED_STEP_SECONDS).length(),
      );
    }

    const frontWheelX = frontWheel.getPosition().x;
    if (!isCorrect && frontWheelX > bridgeLengthMeters + 0.04) {
      metrics.frontWheelExitedDeck = true;
    }
    if (
      !isCorrect &&
      stepCount > DRIVE_START_STEPS &&
      chassis.getPosition().x > bridgeLengthMeters - 1 &&
      frontWheelX > bridgeLengthMeters - 0.7
    ) {
      breakUnsupportedEnd();
    }

    metrics.maxVehicleAbsAngle = Math.max(
      metrics.maxVehicleAbsAngle,
      Math.abs(chassis.getAngle()),
    );
    for (const segment of bridgeSegments) {
      metrics.maxBridgeAbsAngle = Math.max(
        metrics.maxBridgeAbsAngle,
        Math.abs(segment.getAngle()),
      );
    }

    const lowestVehicleY = Math.min(
      chassis.getPosition().y - 0.2,
      rearWheel.getPosition().y - 0.235,
      frontWheel.getPosition().y - 0.235,
    );
    if (
      !isCorrect &&
      metrics.waterImpactStep === null &&
      lowestVehicleY <= BRIDGE_WATER_SURFACE_Y
    ) {
      metrics.vehicleEnteredWater = true;
      metrics.waterImpactX = chassis.getPosition().x;
      metrics.waterImpactStep = stepCount;
      for (const joint of wheelJoints) joint.enableMotor(false);
    }

    if (isCorrect && chassis.getPosition().x >= BRIDGE_GAP_METERS + 1) {
      status = "crossed";
    } else if (
      metrics.waterImpactStep !== null &&
      stepCount - metrics.waterImpactStep >= AFTERMATH_STEPS
    ) {
      status = "recovered";
    }
    return status;
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
    bridgeJoints,
    bridgeLengthMeters,
    bridgeSegments,
    chassis,
    destroy,
    getSnapshot,
    metrics,
    step,
    vehicle: chassis,
    wheelJoints,
    wheels,
    world,
    supportJoints,
  };
}

export function runBridgeWorldToResult(outcome: BridgeOutcome): {
  bodyCount: number;
  finite: boolean;
  jointCount: number;
  maxAbsPosition: number;
  metrics: BridgeWorldMetrics;
  status: Exclude<BridgeWorldStatus, "running">;
  steps: number;
} {
  const simulation = createBridgeWorld(outcome);
  let status: BridgeWorldStatus = "running";
  let steps = 0;
  let finite = true;
  let maxAbsPosition = 0;
  const jointCount = simulation.world.getJointCount();

  while (status === "running" && steps < BRIDGE_MAX_STEPS) {
    status = simulation.step();
    steps += 1;
    for (
      let body = simulation.world.getBodyList();
      body;
      body = body.getNext()
    ) {
      const position = body.getPosition();
      finite &&=
        Number.isFinite(position.x) &&
        Number.isFinite(position.y) &&
        Number.isFinite(body.getAngle());
      maxAbsPosition = Math.max(
        maxAbsPosition,
        Math.abs(position.x),
        Math.abs(position.y),
      );
    }
  }
  if (status === "running") throw new Error("Bridge world did not settle");
  const result = {
    bodyCount: simulation.bodyCount,
    finite,
    jointCount,
    maxAbsPosition,
    metrics: { ...simulation.metrics },
    status,
    steps,
  };
  simulation.destroy();
  return result;
}
