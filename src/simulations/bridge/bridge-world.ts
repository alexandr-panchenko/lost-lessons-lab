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
export const BRIDGE_MAX_STEPS = 1200;
export const BRIDGE_GAP_METERS = 9;
export const BRIDGE_WATER_SURFACE_Y = -3.25;

const CORRECT_WATER_SURFACE_Y = -2.35;
const DEPLOYMENT_STEPS = 150;
const DRIVE_START_STEPS = 180;
const AFTERMATH_STEPS = 465;
const BRIDGE_SEGMENT_TARGET_METERS = 0.68;
const WATER_POINT_COUNT = 41;

export type BridgeWorldStatus = "running" | "crossed" | "recovered";
export type BridgeVisualPhase =
  | "deploying"
  | "driving"
  | "sagging"
  | "snapping"
  | "peeling"
  | "falling"
  | "collision"
  | "splash"
  | "aftermath"
  | "crossed";

export type BridgeWorldMetrics = {
  bridgeBreakStep: number | null;
  brokenBridgeJoints: number;
  cableSnapStep: number | null;
  deckPeelStep: number | null;
  deckReleaseStep: number | null;
  detachedVehiclePart: boolean;
  frontWheelExitedDeck: boolean;
  intermediateObjectBreakStep: number | null;
  intermediateObjectBroken: boolean;
  maxBridgeAbsAngle: number;
  maxBridgeJointForce: number;
  maxVehicleAbsAngle: number;
  maxVehicleForwardVelocityAfterRelease: number;
  maxWaterDisplacement: number;
  vehicleEnteredWater: boolean;
  waterImpactX: number | null;
  waterImpactStep: number | null;
  waterWaveReachedLeft: boolean;
  waterWaveReachedRight: boolean;
};

export type BridgeWaterSurface = {
  baselineY: number;
  displacements: number[];
  getHeightAt: (x: number) => number;
  pointCount: number;
  spacing: number;
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
  bumper: Body | null;
  chassis: Body;
  destroy: () => void;
  getSnapshot: () => BridgeWorldSnapshot;
  metrics: BridgeWorldMetrics;
  signPieces: Body[];
  step: () => BridgeWorldStatus;
  supportJoints: DistanceJoint[];
  vehicle: Body;
  waterSurface: BridgeWaterSurface;
  wheelJoints: [WheelJoint, WheelJoint];
  wheels: [Body, Body];
  world: World;
};

function requireJoint<T>(joint: T | null): T {
  if (joint === null) throw new Error("Planck rejected a bridge joint");
  return joint;
}

function createWaterSurface(baselineY: number): BridgeWaterSurface & {
  disturb: (x: number, velocity: number) => void;
  step: () => void;
} {
  const spacing = BRIDGE_GAP_METERS / (WATER_POINT_COUNT - 1);
  const displacements = Array.from<number>({ length: WATER_POINT_COUNT }).fill(
    0,
  );
  const velocities = Array.from<number>({ length: WATER_POINT_COUNT }).fill(0);

  function getHeightAt(x: number): number {
    const clamped = Math.max(0, Math.min(BRIDGE_GAP_METERS, x));
    const position = clamped / spacing;
    const left = Math.min(WATER_POINT_COUNT - 2, Math.floor(position));
    const blend = position - left;
    return (
      baselineY +
      displacements[left]! * (1 - blend) +
      displacements[left + 1]! * blend
    );
  }

  function disturb(x: number, velocity: number): void {
    const center = Math.round(
      (Math.max(0, Math.min(BRIDGE_GAP_METERS, x)) / BRIDGE_GAP_METERS) *
        (WATER_POINT_COUNT - 1),
    );
    for (let offset = -2; offset <= 2; offset += 1) {
      const index = center + offset;
      if (index <= 0 || index >= WATER_POINT_COUNT - 1) continue;
      velocities[index] =
        (velocities[index] ?? 0) + velocity * (1 - Math.abs(offset) * 0.18);
    }
  }

  function step(): void {
    const accelerations = displacements.map((height, index) => {
      const left = displacements[Math.max(0, index - 1)] ?? 0;
      const right =
        displacements[Math.min(WATER_POINT_COUNT - 1, index + 1)] ?? 0;
      return (
        -19 * height +
        68 * (left + right - 2 * height) -
        2.55 * (velocities[index] ?? 0)
      );
    });
    for (let index = 1; index < WATER_POINT_COUNT - 1; index += 1) {
      velocities[index] =
        (velocities[index] ?? 0) +
        (accelerations[index] ?? 0) * BRIDGE_FIXED_STEP_SECONDS;
      displacements[index] =
        (displacements[index] ?? 0) +
        (velocities[index] ?? 0) * BRIDGE_FIXED_STEP_SECONDS;
    }
    // Fixed banks reflect a small, decaying portion of each arriving wave.
    velocities[1] = (velocities[1] ?? 0) - (displacements[1] ?? 0) * 0.08;
    velocities[WATER_POINT_COUNT - 2] =
      (velocities[WATER_POINT_COUNT - 2] ?? 0) -
      (displacements[WATER_POINT_COUNT - 2] ?? 0) * 0.08;
    displacements[0] = 0;
    displacements[WATER_POINT_COUNT - 1] = 0;
  }

  return {
    baselineY,
    displacements,
    disturb,
    getHeightAt,
    pointCount: WATER_POINT_COUNT,
    spacing,
    step,
  };
}

function applyWaterForces(
  body: Body,
  lift: number,
  surface: BridgeWaterSurface,
): void {
  const localSurface = surface.getHeightAt(body.getPosition().x);
  const depth = Math.min(1.7, Math.max(0, localSurface - body.getPosition().y));
  if (depth === 0) return;
  body.setLinearDamping(2.5);
  body.setAngularDamping(2);
  body.applyForceToCenter(Vec2(0, body.getMass() * 11.8 * depth * lift), true);
}

export function createBridgeWorld(outcome: BridgeOutcome): BridgeWorld {
  const world = new World(Vec2(0, -9.8));
  const bridgeLengthMeters = outcome.submittedInputs.deployedLengthMeters;
  const isCorrect = outcome.isMathematicallyCorrect;
  const waterSurface = createWaterSurface(
    isCorrect ? CORRECT_WATER_SURFACE_Y : BRIDGE_WATER_SURFACE_Y,
  );

  const leftGround = world.createBody({ position: Vec2(-4, -0.55) });
  leftGround.createFixture(Box(4, 0.55), { friction: 1.1 });
  const rightGround = world.createBody({
    position: Vec2(BRIDGE_GAP_METERS + 4, -0.55),
  });
  rightGround.createFixture(Box(4, 0.55), { friction: 1.1 });
  const riverBed = world.createBody({
    position: Vec2(
      BRIDGE_GAP_METERS / 2,
      (isCorrect ? CORRECT_WATER_SURFACE_Y : BRIDGE_WATER_SURFACE_Y) - 1.75,
    ),
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
      angularDamping: 0.2,
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
        { enableLimit: true, lowerAngle: -0.02, upperAngle: 0.02 },
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
          { dampingRatio: 0.8, frequencyHz: 0 },
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
          { dampingRatio: 0.68, frequencyHz: 3.6 },
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
          { enableLimit: true, lowerAngle: -0.02, upperAngle: 0.02 },
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
    angularDamping: 0.08,
    bullet: true,
    position: Vec2(-1.65, 0.64),
  });
  chassis.createFixture(Box(0.62, 0.2), { density: 1.65, friction: 0.45 });
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

  const signPieces: Body[] = [];
  const signJoints: Array<DistanceJoint | WeldJoint> = [];
  let bumper: Body | null = null;
  let bumperJoint: WeldJoint | null = null;
  if (!isCorrect) {
    const signLeft = world.createDynamicBody({
      angularDamping: 0.05,
      position: Vec2(4.35, -1.42),
    });
    signLeft.createFixture(Box(0.34, 0.23), {
      density: 0.18,
      restitution: 0.22,
    });
    const signRight = world.createDynamicBody({
      angularDamping: 0.05,
      position: Vec2(5.03, -1.42),
    });
    signRight.createFixture(Box(0.34, 0.23), {
      density: 0.18,
      restitution: 0.22,
    });
    signPieces.push(signLeft, signRight);
    signJoints.push(
      requireJoint(
        world.createJoint(
          new DistanceJoint(
            { dampingRatio: 0.2, frequencyHz: 1.8 },
            leftGround,
            signLeft,
            Vec2(4.7, 0.45),
            Vec2(4.15, -1.42),
          ),
        ),
      ),
      requireJoint(
        world.createJoint(
          new WeldJoint(
            { dampingRatio: 0.1, frequencyHz: 0 },
            signLeft,
            signRight,
            Vec2(4.69, -1.42),
          ),
        ),
      ),
    );
    bumper = world.createDynamicBody({
      angularDamping: 0.08,
      position: Vec2(-0.91, 0.58),
    });
    bumper.createFixture(Box(0.13, 0.08), {
      density: 0.25,
      restitution: 0.18,
    });
    bumperJoint = requireJoint(
      world.createJoint(
        new WeldJoint(
          { dampingRatio: 0.2, frequencyHz: 0 },
          chassis,
          bumper,
          bumper.getPosition(),
        ),
      ),
    );
  }

  const metrics: BridgeWorldMetrics = {
    bridgeBreakStep: null,
    brokenBridgeJoints: 0,
    cableSnapStep: null,
    deckPeelStep: null,
    deckReleaseStep: null,
    detachedVehiclePart: false,
    frontWheelExitedDeck: false,
    intermediateObjectBreakStep: null,
    intermediateObjectBroken: false,
    maxBridgeAbsAngle: 0,
    maxBridgeJointForce: 0,
    maxVehicleAbsAngle: 0,
    maxVehicleForwardVelocityAfterRelease: 0,
    maxWaterDisplacement: 0,
    vehicleEnteredWater: false,
    waterImpactX: null,
    waterImpactStep: null,
    waterWaveReachedLeft: false,
    waterWaveReachedRight: false,
  };
  const destroyedJoints = new Set<DistanceJoint | RevoluteJoint | WeldJoint>();
  let stepCount = 0;
  let status: BridgeWorldStatus = "running";

  function destroyJoint(
    joint: DistanceJoint | RevoluteJoint | WeldJoint | null | undefined,
    bridgeJoint: boolean,
  ): void {
    if (joint === null || joint === undefined || destroyedJoints.has(joint))
      return;
    world.destroyJoint(joint);
    destroyedJoints.add(joint);
    if (bridgeJoint) metrics.brokenBridgeJoints += 1;
  }

  function startCableFailure(): void {
    if (metrics.cableSnapStep !== null) return;
    metrics.bridgeBreakStep = stepCount;
    metrics.cableSnapStep = stepCount;
    destroyJoint(supportJoints.at(-1), true);
    bridgeSegments.at(-1)?.applyAngularImpulse(-0.16, true);
  }

  function advanceStagedFailure(): void {
    if (metrics.cableSnapStep === null) return;
    const age = stepCount - metrics.cableSnapStep;
    if (age >= 22 && metrics.deckPeelStep === null) {
      metrics.deckPeelStep = stepCount;
      destroyJoint(supportJoints.at(-2), true);
      destroyJoint(deckJoints.at(-1), true);
      bridgeSegments
        .at(-1)
        ?.applyLinearImpulse(
          Vec2(0.34, -0.16),
          bridgeSegments.at(-1)!.getWorldCenter(),
          true,
        );
      bridgeSegments.at(-1)?.applyAngularImpulse(-0.82, true);
    }
    if (age >= 48 && metrics.deckReleaseStep === null) {
      metrics.deckReleaseStep = stepCount;
      destroyJoint(deckJoints.at(-2), true);
      destroyJoint(supportJoints.at(-3), true);
      const penultimate = bridgeSegments.at(-2);
      penultimate?.applyLinearImpulse(
        Vec2(0.5, -0.12),
        penultimate.getWorldCenter(),
        true,
      );
      penultimate?.applyAngularImpulse(-0.75, true);
      chassis.applyLinearImpulse(
        Vec2(2.1, 0.45),
        chassis.getWorldCenter(),
        true,
      );
      chassis.applyAngularImpulse(-3.2, true);
    }
  }

  function breakIntermediateObject(): void {
    if (metrics.intermediateObjectBroken || signPieces.length < 2) return;
    metrics.intermediateObjectBroken = true;
    metrics.intermediateObjectBreakStep = stepCount;
    for (const joint of signJoints) destroyJoint(joint, false);
    signPieces[0]!.applyLinearImpulse(
      Vec2(-0.45, 0.18),
      signPieces[0]!.getWorldCenter(),
      true,
    );
    signPieces[1]!.applyLinearImpulse(
      Vec2(0.65, -0.08),
      signPieces[1]!.getWorldCenter(),
      true,
    );
    if (bumperJoint !== null && bumper !== null) {
      destroyJoint(bumperJoint, false);
      const vehicleVelocity = chassis.getLinearVelocity();
      bumper.setLinearVelocity(
        Vec2(vehicleVelocity.x + 1.1, vehicleVelocity.y + 0.45),
      );
      bumper.setAngularVelocity(5.2);
      metrics.detachedVehiclePart = true;
    }
  }

  function getSnapshot(): BridgeWorldSnapshot {
    let phase: BridgeVisualPhase;
    if (status === "crossed") phase = "crossed";
    else if (metrics.waterImpactStep !== null) {
      phase = stepCount - metrics.waterImpactStep < 60 ? "splash" : "aftermath";
    } else if (metrics.cableSnapStep !== null) {
      const age = stepCount - metrics.cableSnapStep;
      if (age < 22) phase = "sagging";
      else if (age < 32) phase = "snapping";
      else if (age < 38) phase = "peeling";
      else if (
        metrics.intermediateObjectBreakStep !== null &&
        stepCount - metrics.intermediateObjectBreakStep < 16
      )
        phase = "collision";
      else phase = "falling";
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

    waterSurface.step();
    applyWaterForces(chassis, 1.04, waterSurface);
    applyWaterForces(rearWheel, 0.82, waterSurface);
    applyWaterForces(frontWheel, 0.82, waterSurface);
    if (bumper !== null) applyWaterForces(bumper, 1.2, waterSurface);
    for (const segment of bridgeSegments)
      applyWaterForces(segment, 0.76, waterSurface);
    for (const piece of signPieces) applyWaterForces(piece, 1.18, waterSurface);

    world.step(BRIDGE_FIXED_STEP_SECONDS, 10, 5);

    for (const joint of bridgeJoints) {
      if (destroyedJoints.has(joint)) continue;
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
      frontWheelX > bridgeLengthMeters - 0.72
    ) {
      startCableFailure();
    }
    advanceStagedFailure();

    if (metrics.deckPeelStep !== null && !metrics.intermediateObjectBroken) {
      const nearestSignDistance = Math.min(
        ...signPieces.map((piece) =>
          Vec2.distance(piece.getPosition(), chassis.getPosition()),
        ),
      );
      if (nearestSignDistance < 1.25) breakIntermediateObject();
    }

    if (metrics.deckReleaseStep !== null) {
      metrics.maxVehicleForwardVelocityAfterRelease = Math.max(
        metrics.maxVehicleForwardVelocityAfterRelease,
        chassis.getLinearVelocity().x,
      );
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

    const localWater = waterSurface.getHeightAt(chassis.getPosition().x);
    const lowestVehicleY = Math.min(
      chassis.getPosition().y - 0.2,
      rearWheel.getPosition().y - 0.235,
      frontWheel.getPosition().y - 0.235,
    );
    if (
      !isCorrect &&
      metrics.waterImpactStep === null &&
      lowestVehicleY <= localWater
    ) {
      metrics.vehicleEnteredWater = true;
      metrics.waterImpactX = chassis.getPosition().x;
      metrics.waterImpactStep = stepCount;
      waterSurface.disturb(chassis.getPosition().x, -8.8);
      for (const joint of wheelJoints) joint.enableMotor(false);
    }

    metrics.maxWaterDisplacement = Math.max(
      metrics.maxWaterDisplacement,
      ...waterSurface.displacements.map(Math.abs),
    );
    if (metrics.waterImpactX !== null) {
      const impactIndex = Math.round(
        (metrics.waterImpactX / BRIDGE_GAP_METERS) *
          (waterSurface.pointCount - 1),
      );
      const leftIndex = Math.max(2, impactIndex - 10);
      const rightIndex = Math.min(
        waterSurface.pointCount - 3,
        impactIndex + 10,
      );
      metrics.waterWaveReachedLeft ||=
        Math.abs(waterSurface.displacements[leftIndex] ?? 0) > 0.012;
      metrics.waterWaveReachedRight ||=
        Math.abs(waterSurface.displacements[rightIndex] ?? 0) > 0.012;
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
    bumper,
    chassis,
    destroy,
    getSnapshot,
    metrics,
    signPieces,
    step,
    supportJoints,
    vehicle: chassis,
    waterSurface,
    wheelJoints,
    wheels,
    world,
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
