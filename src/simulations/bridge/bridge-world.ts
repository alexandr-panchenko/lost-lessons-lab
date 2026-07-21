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

const DEPLOYMENT_STEPS = 210;
const CORRECT_LOCK_STEPS = 54;
const WRONG_DRIVE_START_STEPS = 320;
const CORRECT_DRIVE_START_STEPS = DEPLOYMENT_STEPS + CORRECT_LOCK_STEPS;
const AFTERMATH_STEPS = 280;
const CORRECT_PAYOFF_STEPS = 150;
const BRIDGE_SEGMENT_TARGET_METERS = 0.68;
const WATER_POINT_COUNT = 41;

export type BridgeWorldStatus = "running" | "crossed" | "recovered";
export type BridgeVisualPhase =
  | "deploying"
  | "locking"
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
  boatCollisionStep: number | null;
  boatStayedUpright: boolean;
  bridgeBreakStep: number | null;
  brokenBridgeJoints: number;
  cableSnapStep: number | null;
  canopyPiecesBroken: number;
  deckPeelStep: number | null;
  deckReleaseStep: number | null;
  detachedBridgeSegments: number;
  detachedVehiclePart: boolean;
  finalBoatAngle: number;
  finalVehicleAngle: number;
  frontWheelExitedDeck: boolean;
  intermediateObjectBreakStep: number | null;
  intermediateObjectBroken: boolean;
  majorBodiesWithinCamera: boolean;
  maxBoatAbsAngle: number;
  maxBodyAngularSpeed: number;
  maxBodyLinearSpeed: number;
  maxBridgeAbsAngle: number;
  maxBridgeJointForce: number;
  maxVehicleAbsAngle: number;
  maxVehicleAngularSpeed: number;
  maxVehicleForwardVelocityAfterRelease: number;
  maxWaterDisplacement: number;
  noRunawayVelocity: boolean;
  sagStartStep: number | null;
  selectedPanelDetached: boolean;
  successStep: number | null;
  vehicleBecameInverted: boolean;
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
  boat: Body;
  boatCanopy: Body[];
  boatCargo: Body[];
  bridgeJoints: Array<DistanceJoint | RevoluteJoint | WeldJoint>;
  bridgeLengthMeters: number;
  bridgeSegments: Body[];
  bumper: Body | null;
  chassis: Body;
  destroy: () => void;
  getSnapshot: () => BridgeWorldSnapshot;
  metrics: BridgeWorldMetrics;
  pontoons: Body[];
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
  let idleStep = 0;

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
    idleStep += 1;
    velocities[9] = (velocities[9] ?? 0) + Math.sin(idleStep * 0.031) * 0.00045;
    velocities[31] =
      (velocities[31] ?? 0) + Math.sin(idleStep * 0.026 + 1.8) * 0.00038;
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
  const waterSurface = createWaterSurface(BRIDGE_WATER_SURFACE_Y);

  const leftGround = world.createBody({ position: Vec2(-4, -0.5) });
  leftGround.createFixture(Box(4, 0.56), { friction: 1.15 });
  const rightGround = world.createBody({
    position: Vec2(BRIDGE_GAP_METERS + 4, -0.5),
  });
  rightGround.createFixture(Box(4, 0.56), { friction: 1.15 });
  const riverBed = world.createBody({
    position: Vec2(BRIDGE_GAP_METERS / 2, BRIDGE_WATER_SURFACE_Y - 1.75),
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
  const deckHinges: RevoluteJoint[] = [];
  const supportJoints: DistanceJoint[] = [];

  // Successful runs use a smooth, invisible collision rail. The visible
  // modular panels remain real Planck bodies, but their seams cannot launch or
  // trap the vehicle.
  if (isCorrect) {
    const collisionRail = world.createBody({
      position: Vec2(BRIDGE_GAP_METERS / 2, 0),
    });
    collisionRail.createFixture(Box(BRIDGE_GAP_METERS / 2, 0.075), {
      friction: 1.25,
      restitution: 0,
    });
  }

  for (let index = 0; index < segmentCount; index += 1) {
    const segment = world.createDynamicBody({
      allowSleep: false,
      angularDamping: isCorrect ? 4.2 : 1.15,
      linearDamping: isCorrect ? 1.8 : 0.28,
      position: Vec2(segmentLength * (index + 0.5), 0.11),
    });
    segment.createFixture(Box(segmentLength * 0.475, 0.105), {
      density: isCorrect ? 0.78 : 1.05,
      filterGroupIndex: -2,
      friction: 1.15,
      isSensor: isCorrect,
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
    const deckJoint = isCorrect
      ? requireJoint(
          world.createJoint(
            new WeldJoint(
              { dampingRatio: 0.92, frequencyHz: 0 },
              bridgeSegments[index - 1]!,
              bridgeSegments[index]!,
              Vec2(segmentLength * index, 0.11),
            ),
          ),
        )
      : requireJoint(
          world.createJoint(
            new RevoluteJoint(
              { enableLimit: true, lowerAngle: -0.075, upperAngle: 0.075 },
              bridgeSegments[index - 1]!,
              bridgeSegments[index]!,
              Vec2(segmentLength * index, 0.11),
            ),
          ),
        );
    bridgeJoints.push(deckJoint);
    deckJoints.push(deckJoint);
    if (!isCorrect) deckHinges.push(deckJoint as RevoluteJoint);
  }
  const supportTowerAnchor = Vec2(-0.08, 1.62);
  for (let index = 1; index < bridgeSegments.length; index += 1) {
    const segment = bridgeSegments[index]!;
    const supportJoint = requireJoint(
      world.createJoint(
        new DistanceJoint(
          {
            dampingRatio: isCorrect ? 0.92 : 0.76,
            frequencyHz: isCorrect ? 5.2 : 2.8,
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
        new WeldJoint(
          { dampingRatio: 0.92, frequencyHz: 0 },
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
    angularDamping: isCorrect ? 5.8 : 0.78,
    bullet: true,
    position: Vec2(-1.65, 0.66),
  });
  chassis.createFixture(Box(0.64, 0.18, Vec2(0, -0.08), 0), {
    density: 2.2,
    friction: 0.55,
  });
  // A light cab shape keeps the physical center of mass low.
  chassis.createFixture(Box(0.28, 0.16, Vec2(0.2, 0.2), 0), {
    density: 0.16,
    friction: 0.3,
  });
  chassis.setBullet(true);

  const rearWheel = world.createDynamicBody({
    allowSleep: false,
    bullet: true,
    position: Vec2(-2.03, 0.31),
  });
  rearWheel.createFixture(Circle(0.235), {
    density: 1.15,
    friction: isCorrect ? 1.45 : 1.8,
    restitution: 0.02,
  });
  const frontWheel = world.createDynamicBody({
    allowSleep: false,
    bullet: true,
    position: Vec2(-1.23, 0.31),
  });
  frontWheel.createFixture(Circle(0.235), {
    density: 1.15,
    friction: isCorrect ? 1.45 : 1.8,
    restitution: 0.02,
  });

  const wheelJointOptions = {
    dampingRatio: isCorrect ? 0.94 : 0.82,
    enableMotor: false,
    frequencyHz: isCorrect ? 7.6 : 5.8,
    maxMotorTorque: isCorrect ? 11 : 16,
    motorSpeed: isCorrect ? -6.1 : -8.2,
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

  const boat = world.createDynamicBody({
    allowSleep: false,
    angularDamping: 5,
    fixedRotation: true,
    linearDamping: 1.4,
    position: Vec2(isCorrect ? 3.9 : 4.9, BRIDGE_WATER_SURFACE_Y + 0.24),
  });
  boat.createFixture(Box(1.08, 0.19), {
    density: 1.1,
    filterGroupIndex: -5,
    friction: 0.45,
    restitution: 0.02,
  });
  const boatCanopy: Body[] = [];
  const boatCargo: Body[] = [];
  const boatBreakJoints: WeldJoint[] = [];
  const boatX = boat.getPosition().x;
  for (const [x, y, halfWidth, halfHeight] of [
    [boatX - 0.58, BRIDGE_WATER_SURFACE_Y + 0.68, 0.07, 0.43],
    [boatX + 0.58, BRIDGE_WATER_SURFACE_Y + 0.68, 0.07, 0.43],
    [boatX, BRIDGE_WATER_SURFACE_Y + 1.08, 0.66, 0.07],
  ] as const) {
    const piece = world.createDynamicBody({
      angularDamping: 1.1,
      position: Vec2(x, y),
    });
    piece.createFixture(Box(halfWidth, halfHeight), {
      density: 0.2,
      filterGroupIndex: -5,
      restitution: 0.05,
    });
    boatCanopy.push(piece);
    boatBreakJoints.push(
      requireJoint(
        world.createJoint(
          new WeldJoint(
            { dampingRatio: 0.75, frequencyHz: 0 },
            boat,
            piece,
            piece.getPosition(),
          ),
        ),
      ),
    );
  }
  for (const offset of [-0.32, 0.32]) {
    const crate = world.createDynamicBody({
      angularDamping: 0.7,
      position: Vec2(boatX + offset, BRIDGE_WATER_SURFACE_Y + 0.56),
    });
    crate.createFixture(Box(0.22, 0.22), {
      density: 0.32,
      filterGroupIndex: -5,
      friction: 0.6,
      restitution: 0.08,
    });
    boatCargo.push(crate);
    boatBreakJoints.push(
      requireJoint(
        world.createJoint(
          new WeldJoint(
            { dampingRatio: 0.7, frequencyHz: 0 },
            boat,
            crate,
            crate.getPosition(),
          ),
        ),
      ),
    );
  }

  const pontoons: Body[] = [];
  let bumper: Body | null = null;
  let bumperJoint: WeldJoint | null = null;
  if (!isCorrect) {
    bumper = world.createDynamicBody({
      angularDamping: 0.5,
      position: Vec2(-0.91, 0.57),
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
    boatCollisionStep: null,
    boatStayedUpright: true,
    bridgeBreakStep: null,
    brokenBridgeJoints: 0,
    cableSnapStep: null,
    canopyPiecesBroken: 0,
    deckPeelStep: null,
    deckReleaseStep: null,
    detachedBridgeSegments: 0,
    detachedVehiclePart: false,
    finalBoatAngle: 0,
    finalVehicleAngle: 0,
    frontWheelExitedDeck: false,
    intermediateObjectBreakStep: null,
    intermediateObjectBroken: false,
    majorBodiesWithinCamera: true,
    maxBoatAbsAngle: 0,
    maxBodyAngularSpeed: 0,
    maxBodyLinearSpeed: 0,
    maxBridgeAbsAngle: 0,
    maxBridgeJointForce: 0,
    maxVehicleAbsAngle: 0,
    maxVehicleAngularSpeed: 0,
    maxVehicleForwardVelocityAfterRelease: 0,
    maxWaterDisplacement: 0,
    noRunawayVelocity: true,
    sagStartStep: null,
    selectedPanelDetached: false,
    successStep: null,
    vehicleBecameInverted: false,
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
    deckHinges.at(-1)?.setLimits(-0.34, 0.08);
  }

  function advanceStagedFailure(): void {
    if (metrics.cableSnapStep === null) return;
    const age = stepCount - metrics.cableSnapStep;
    if (age >= 12 && metrics.deckPeelStep === null) {
      metrics.deckPeelStep = stepCount;
      destroyJoint(supportJoints.at(-2), true);
      deckHinges.at(-1)?.setLimits(-0.92, 0.08);
      deckHinges.at(-2)?.setLimits(-0.55, 0.08);
    }
    if (age >= 24 && metrics.deckReleaseStep === null) {
      metrics.deckReleaseStep = stepCount;
      destroyJoint(supportJoints.at(-3), true);
      deckHinges.at(-2)?.setLimits(-1.1, 0.08);
      deckHinges.at(-3)?.setLimits(-0.72, 0.08);
      for (const joint of wheelJoints) joint.enableMotor(false);
      const velocity = chassis.getLinearVelocity();
      chassis.setLinearVelocity(Vec2(Math.max(2.65, velocity.x), velocity.y));
      chassis.setAngularVelocity(-2.65);
    }
    if (age >= 60 && !metrics.selectedPanelDetached) {
      destroyJoint(deckJoints.at(-1), true);
      metrics.selectedPanelDetached = true;
      metrics.detachedBridgeSegments = 1;
    }
  }

  function breakIntermediateObject(): void {
    if (metrics.intermediateObjectBroken) return;
    metrics.intermediateObjectBroken = true;
    metrics.intermediateObjectBreakStep = stepCount;
    metrics.boatCollisionStep = stepCount;
    for (const joint of boatBreakJoints) destroyJoint(joint, false);
    const vehicleVelocity = chassis.getLinearVelocity();
    [...boatCanopy, ...boatCargo].forEach((piece, index) => {
      piece.setLinearVelocity(
        Vec2(
          Math.max(0.4, vehicleVelocity.x * 0.38) + (index - 2) * 0.16,
          vehicleVelocity.y * 0.18 + 0.7 + (index % 2) * 0.24,
        ),
      );
      piece.setAngularVelocity(
        (index % 2 === 0 ? -1 : 1) * (1.2 + index * 0.18),
      );
    });
    metrics.canopyPiecesBroken = boatBreakJoints.length;
    chassis.applyAngularImpulse(-0.42, true);
    if (bumperJoint !== null && bumper !== null) {
      destroyJoint(bumperJoint, false);
      bumper.setLinearVelocity(
        Vec2(vehicleVelocity.x + 0.55, vehicleVelocity.y + 0.28),
      );
      bumper.setAngularVelocity(2.8);
      metrics.detachedVehiclePart = true;
    }
  }

  function deployPontoons(): void {
    if (pontoons.length > 0) return;
    for (const localX of [-0.56, 0.56]) {
      const position = chassis.getWorldPoint(Vec2(localX, -0.18));
      const pontoon = world.createDynamicBody({
        angularDamping: 2.8,
        linearDamping: 2.2,
        position,
      });
      pontoon.createFixture(Box(0.32, 0.11), {
        density: 0.24,
        filterGroupIndex: -4,
        restitution: 0,
      });
      requireJoint(
        world.createJoint(
          new WeldJoint(
            { dampingRatio: 0.9, frequencyHz: 0 },
            chassis,
            pontoon,
            position,
          ),
        ),
      );
      pontoons.push(pontoon);
    }
  }

  function getSnapshot(): BridgeWorldSnapshot {
    let phase: BridgeVisualPhase;
    if (status === "crossed" || metrics.successStep !== null) phase = "crossed";
    else if (metrics.waterImpactStep !== null) {
      phase = stepCount - metrics.waterImpactStep < 60 ? "splash" : "aftermath";
    } else if (metrics.cableSnapStep !== null) {
      const age = stepCount - metrics.cableSnapStep;
      if (age < 12) phase = "snapping";
      else if (age < 24) phase = "peeling";
      else if (
        metrics.intermediateObjectBreakStep !== null &&
        stepCount - metrics.intermediateObjectBreakStep < 28
      )
        phase = "collision";
      else phase = "falling";
    } else if (stepCount < DEPLOYMENT_STEPS) phase = "deploying";
    else if (isCorrect && stepCount < CORRECT_DRIVE_START_STEPS)
      phase = "locking";
    else if (!isCorrect && metrics.sagStartStep !== null) phase = "sagging";
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
    const driveStart = isCorrect
      ? CORRECT_DRIVE_START_STEPS
      : WRONG_DRIVE_START_STEPS;
    if (stepCount === driveStart) {
      for (const joint of wheelJoints) joint.enableMotor(true);
    }

    // A restrained balance controller keeps the successful delivery upright
    // without scripting its translation or wheel motion.
    if (isCorrect && stepCount >= driveStart) {
      chassis.applyTorque(
        -chassis.getAngle() * 13 - chassis.getAngularVelocity() * 3.8,
        true,
      );
    }

    const boatTargetX = isCorrect ? 5.15 : 4.9;
    const boatError = boatTargetX - boat.getPosition().x;
    const localBoatWater = waterSurface.getHeightAt(boat.getPosition().x);
    const boatVerticalError = localBoatWater + 0.12 - boat.getPosition().y;
    boat.applyForceToCenter(
      Vec2(
        boatError * 1.35 - boat.getLinearVelocity().x * 1.1,
        boat.getMass() *
          (9.8 + boatVerticalError * 11 - boat.getLinearVelocity().y * 4.2),
      ),
      true,
    );

    waterSurface.step();
    applyWaterForces(chassis, pontoons.length > 0 ? 1.5 : 1.04, waterSurface);
    applyWaterForces(
      rearWheel,
      pontoons.length > 0 ? 1.25 : 0.82,
      waterSurface,
    );
    applyWaterForces(
      frontWheel,
      pontoons.length > 0 ? 1.25 : 0.82,
      waterSurface,
    );
    if (bumper !== null) applyWaterForces(bumper, 1.2, waterSurface);
    for (const segment of bridgeSegments)
      applyWaterForces(segment, 0.76, waterSurface);
    for (const piece of [...boatCanopy, ...boatCargo])
      applyWaterForces(piece, 1.22, waterSurface);
    for (const pontoon of pontoons)
      applyWaterForces(pontoon, 3.4, waterSurface);

    world.step(BRIDGE_FIXED_STEP_SECONDS, 10, 5);

    const boatSurfaceAfterStep = waterSurface.getHeightAt(boat.getPosition().x);
    const boatVelocity = boat.getLinearVelocity();
    const boatTargetVelocityY = Math.max(
      -1.25,
      Math.min(
        1.25,
        boatVelocity.y +
          (boatSurfaceAfterStep + 0.12 - boat.getPosition().y) * 0.42,
      ),
    );
    boat.setLinearVelocity(
      Vec2(
        Math.max(-0.55, Math.min(0.55, boatVelocity.x)),
        boatTargetVelocityY,
      ),
    );

    // Clamp only pathological energy; ordinary translation and rotation remain
    // the result of Planck contacts, gravity, joints, motors, and authored forces.
    for (let body = world.getBodyList(); body; body = body.getNext()) {
      if (!body.isDynamic()) continue;
      const velocity = body.getLinearVelocity();
      const speed = velocity.length();
      const maxLinear = body === chassis ? 8.5 : 9.5;
      if (speed > maxLinear) {
        body.setLinearVelocity(Vec2.mul(maxLinear / speed, velocity));
      }
      const angularLimit = body === chassis ? (isCorrect ? 1.8 : 3.8) : 5.2;
      if (Math.abs(body.getAngularVelocity()) > angularLimit) {
        body.setAngularVelocity(
          Math.sign(body.getAngularVelocity()) * angularLimit,
        );
      }
    }

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
    if (!isCorrect && stepCount > driveStart) {
      if (
        metrics.sagStartStep === null &&
        chassis.getPosition().x > bridgeLengthMeters - 1.42
      ) {
        metrics.sagStartStep = stepCount;
        for (const joint of wheelJoints) joint.setMotorSpeed(-2.4);
      }
      if (
        metrics.sagStartStep !== null &&
        stepCount - metrics.sagStartStep >= 46
      ) {
        startCableFailure();
        for (const joint of wheelJoints) joint.setMotorSpeed(-4.8);
      }
    }
    advanceStagedFailure();

    if (
      metrics.deckReleaseStep !== null &&
      stepCount - metrics.deckReleaseStep >= 8 &&
      !metrics.intermediateObjectBroken
    ) {
      const canopyCenter = boatCanopy[2]?.getPosition() ?? boat.getPosition();
      const distance = Vec2.distance(canopyCenter, chassis.getPosition());
      if (
        distance < 1.35 ||
        (chassis.getPosition().x > 4.2 && chassis.getPosition().y < -0.82)
      )
        breakIntermediateObject();
    }

    const clampedVehicleAngularSpeed = Math.max(
      -3.8,
      Math.min(3.8, chassis.getAngularVelocity()),
    );
    chassis.setAngularVelocity(clampedVehicleAngularSpeed);

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
    metrics.maxVehicleAngularSpeed = Math.max(
      metrics.maxVehicleAngularSpeed,
      Math.abs(chassis.getAngularVelocity()),
    );
    metrics.vehicleBecameInverted ||=
      isCorrect && Math.cos(chassis.getAngle()) < 0;
    metrics.maxBoatAbsAngle = Math.max(
      metrics.maxBoatAbsAngle,
      Math.abs(boat.getAngle()),
    );
    metrics.boatStayedUpright &&= Math.abs(boat.getAngle()) < 0.2;
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
      deployPontoons();
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

    const majorBodies = [
      chassis,
      rearWheel,
      frontWheel,
      boat,
      ...bridgeSegments,
      ...boatCanopy,
      ...boatCargo,
      ...pontoons,
      ...(bumper === null ? [] : [bumper]),
    ];
    for (const body of majorBodies) {
      const position = body.getPosition();
      const linearSpeed = body.getLinearVelocity().length();
      const angularSpeed = Math.abs(body.getAngularVelocity());
      metrics.maxBodyLinearSpeed = Math.max(
        metrics.maxBodyLinearSpeed,
        linearSpeed,
      );
      metrics.maxBodyAngularSpeed = Math.max(
        metrics.maxBodyAngularSpeed,
        angularSpeed,
      );
      metrics.noRunawayVelocity &&=
        Number.isFinite(linearSpeed) &&
        Number.isFinite(angularSpeed) &&
        linearSpeed <= 10 &&
        angularSpeed <= 5.3;
      metrics.majorBodiesWithinCamera &&=
        position.x >= -3.2 &&
        position.x <= 12.2 &&
        position.y >= -5.3 &&
        position.y <= 3.1;
    }
    metrics.finalVehicleAngle = chassis.getAngle();
    metrics.finalBoatAngle = boat.getAngle();

    if (
      isCorrect &&
      metrics.successStep === null &&
      chassis.getPosition().x >= BRIDGE_GAP_METERS + 1.05
    ) {
      metrics.successStep = stepCount;
      for (const joint of wheelJoints) joint.enableMotor(false);
      chassis.setLinearDamping(5.5);
      rearWheel.setLinearDamping(5.5);
      frontWheel.setLinearDamping(5.5);
    }
    if (
      isCorrect &&
      metrics.successStep !== null &&
      stepCount - metrics.successStep >= CORRECT_PAYOFF_STEPS
    ) {
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
    get bodyCount() {
      return world.getBodyCount();
    },
    boat,
    boatCanopy,
    boatCargo,
    bridgeJoints,
    bridgeLengthMeters,
    bridgeSegments,
    bumper,
    chassis,
    destroy,
    getSnapshot,
    metrics,
    pontoons,
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
