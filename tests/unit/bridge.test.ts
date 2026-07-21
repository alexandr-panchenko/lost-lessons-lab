import { describe, expect, it } from "vitest";

import {
  classifyBridgeInput,
  deriveBridgeLength,
  HERO_BRIDGE_PARAMETERS,
} from "../../src/shared/domain/bridge";
import {
  createBridgeWorld,
  runBridgeWorldToResult,
} from "../../src/simulations/bridge/bridge-world";

describe("deterministic bridge domain", () => {
  it("derives the frozen hero answer", () => {
    expect(deriveBridgeLength(HERO_BRIDGE_PARAMETERS)).toBe(9);
  });

  it("classifies 4.08 m independently of physics", () => {
    const outcome = classifyBridgeInput(HERO_BRIDGE_PARAMETERS, {
      deployedLengthMeters: 4.08,
      fractionAsDecimal: 0.34,
    });
    expect(outcome).toMatchObject({
      isMathematicallyCorrect: false,
      resultClass: "bridge_far_too_short",
    });
    expect(outcome.correctInputs.deployedLengthMeters).toBe(9);
  });

  it("classifies 9 m as correct", () => {
    expect(
      classifyBridgeInput(HERO_BRIDGE_PARAMETERS, {
        deployedLengthMeters: 9,
        fractionAsDecimal: 0.75,
      }),
    ).toMatchObject({
      isMathematicallyCorrect: true,
      resultClass: "bridge_correct",
    });
  });

  it.each([0, -1, 25, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid deployed length %s",
    (deployedLengthMeters) => {
      expect(() =>
        classifyBridgeInput(HERO_BRIDGE_PARAMETERS, { deployedLengthMeters }),
      ).toThrow();
    },
  );

  it.each([
    { expected: "recovered", length: 4.08 },
    { expected: "crossed", length: 9 },
  ] as const)(
    "runs $length m through a bounded fixed-step world",
    ({ expected, length }) => {
      const outcome = classifyBridgeInput(HERO_BRIDGE_PARAMETERS, {
        deployedLengthMeters: length,
      });
      const result = runBridgeWorldToResult(outcome);
      expect(result.status).toBe(expected);
      expect(result.finite).toBe(true);
      expect(result.bodyCount).toBeGreaterThanOrEqual(10);
      expect(result.bodyCount).toBeLessThanOrEqual(30);
      expect(result.jointCount).toBeGreaterThanOrEqual(10);
      expect(result.jointCount).toBeLessThanOrEqual(36);
      expect(result.maxAbsPosition).toBeLessThan(30);
      expect(result.steps).toBeLessThanOrEqual(1080);
    },
  );

  it("produces the broad semantic events of the 4.08 m catastrophe", () => {
    const result = runBridgeWorldToResult(
      classifyBridgeInput(HERO_BRIDGE_PARAMETERS, {
        deployedLengthMeters: 4.08,
      }),
    );
    expect(result.status).toBe("recovered");
    expect(result.steps * (1 / 60)).toBeGreaterThanOrEqual(14);
    expect(result.steps * (1 / 60)).toBeLessThanOrEqual(20);
    expect(result.metrics.maxBridgeJointForce).toBeGreaterThan(20);
    expect(result.metrics.brokenBridgeJoints).toBe(4);
    expect(result.metrics.bridgeBreakStep).not.toBeNull();
    expect(result.metrics.frontWheelExitedDeck).toBe(true);
    expect(result.metrics.maxBridgeAbsAngle).toBeGreaterThan(0.55);
    expect(result.metrics.maxVehicleAbsAngle).toBeGreaterThan(2.7);
    expect(result.metrics.maxVehicleAbsAngle).toBeLessThan(7);
    expect(result.metrics.maxVehicleAngularSpeed).toBeLessThanOrEqual(3.8);
    expect(
      result.metrics.maxVehicleForwardVelocityAfterRelease,
    ).toBeGreaterThan(2);
    expect(result.metrics.intermediateObjectBroken).toBe(true);
    expect(result.metrics.canopyPiecesBroken).toBe(5);
    expect(result.metrics.boatStayedUpright).toBe(true);
    expect(result.metrics.maxBoatAbsAngle).toBeLessThan(0.2);
    expect(result.metrics.detachedVehiclePart).toBe(true);
    expect(result.metrics.selectedPanelDetached).toBe(true);
    expect(result.metrics.detachedBridgeSegments).toBe(1);
    expect(result.metrics.vehicleEnteredWater).toBe(true);
    expect(result.metrics.waterImpactX).not.toBeNull();
    expect(result.metrics.waterImpactStep).not.toBeNull();
    expect(result.metrics.sagStartStep!).toBeLessThan(
      result.metrics.cableSnapStep!,
    );
    expect(result.metrics.bridgeBreakStep!).toBeLessThan(
      result.metrics.waterImpactStep!,
    );
    expect(result.metrics.cableSnapStep).toBeLessThan(
      result.metrics.deckPeelStep!,
    );
    expect(result.metrics.deckPeelStep).toBeLessThan(
      result.metrics.deckReleaseStep!,
    );
    expect(result.metrics.intermediateObjectBreakStep).toBeLessThan(
      result.metrics.waterImpactStep!,
    );
    expect(result.metrics.deckReleaseStep).toBeLessThan(
      result.metrics.intermediateObjectBreakStep!,
    );
    expect(result.metrics.waterImpactX).toBeGreaterThan(3.5);
    expect(result.metrics.waterImpactX).toBeLessThan(6.5);
    expect(result.metrics.maxBodyLinearSpeed).toBeLessThan(9.6);
    expect(result.metrics.maxBodyAngularSpeed).toBeLessThanOrEqual(5.2);
    expect(result.metrics.noRunawayVelocity).toBe(true);
    expect(result.metrics.majorBodiesWithinCamera).toBe(true);
    expect(result.metrics.maxWaterDisplacement).toBeGreaterThan(0.25);
    expect(result.metrics.waterWaveReachedLeft).toBe(true);
    expect(result.metrics.waterWaveReachedRight).toBe(true);
  });

  it("replays the same semantic catastrophe without exact-coordinate assertions", () => {
    const outcome = classifyBridgeInput(HERO_BRIDGE_PARAMETERS, {
      deployedLengthMeters: 4.08,
    });
    const first = runBridgeWorldToResult(outcome);
    const replay = runBridgeWorldToResult(outcome);
    expect(replay.status).toBe(first.status);
    expect(replay.metrics).toMatchObject({
      brokenBridgeJoints: first.metrics.brokenBridgeJoints,
      frontWheelExitedDeck: true,
      vehicleEnteredWater: true,
    });
    expect(replay.metrics.maxVehicleAbsAngle).toBeGreaterThan(2.7);
    expect(replay.metrics).toMatchObject({
      detachedVehiclePart: true,
      intermediateObjectBroken: true,
      waterWaveReachedLeft: true,
      waterWaveReachedRight: true,
    });
  });

  it("keeps all ten consecutive correct crossings upright and intact", () => {
    const outcome = classifyBridgeInput(HERO_BRIDGE_PARAMETERS, {
      deployedLengthMeters: 9,
    });
    for (let run = 0; run < 10; run += 1) {
      const result = runBridgeWorldToResult(outcome);
      expect(result.status).toBe("crossed");
      expect(result.finite).toBe(true);
      expect(result.metrics.successStep).not.toBeNull();
      expect(result.metrics.vehicleBecameInverted).toBe(false);
      expect(Math.abs(result.metrics.finalVehicleAngle)).toBeLessThan(0.08);
      expect(result.metrics.maxVehicleAbsAngle).toBeLessThan(0.12);
      expect(result.metrics.brokenBridgeJoints).toBe(0);
      expect(result.metrics.detachedBridgeSegments).toBe(0);
      expect(result.metrics.selectedPanelDetached).toBe(false);
      expect(result.metrics.boatStayedUpright).toBe(true);
      expect(result.metrics.maxBoatAbsAngle).toBeLessThan(0.08);
      expect(result.metrics.majorBodiesWithinCamera).toBe(true);
      expect(result.metrics.noRunawayVelocity).toBe(true);
      expect(result.maxAbsPosition).toBeLessThan(30);
    }
  });

  it("keeps all ten consecutive wrong runs ordered, centered, and bounded", () => {
    const outcome = classifyBridgeInput(HERO_BRIDGE_PARAMETERS, {
      deployedLengthMeters: 4.08,
    });
    for (let run = 0; run < 10; run += 1) {
      const result = runBridgeWorldToResult(outcome);
      expect(result.status).toBe("recovered");
      expect(result.finite).toBe(true);
      expect(result.metrics.sagStartStep).toBeLessThan(
        result.metrics.cableSnapStep!,
      );
      expect(result.metrics.cableSnapStep).toBeLessThan(
        result.metrics.deckPeelStep!,
      );
      expect(result.metrics.deckPeelStep).toBeLessThan(
        result.metrics.deckReleaseStep!,
      );
      expect(result.metrics.deckReleaseStep).toBeLessThan(
        result.metrics.boatCollisionStep!,
      );
      expect(result.metrics.boatCollisionStep).toBeLessThan(
        result.metrics.waterImpactStep!,
      );
      expect(result.metrics.maxVehicleAbsAngle).toBeGreaterThan(2.7);
      expect(result.metrics.maxVehicleAbsAngle).toBeLessThan(7);
      expect(result.metrics.detachedBridgeSegments).toBe(1);
      expect(result.metrics.canopyPiecesBroken).toBe(5);
      expect(result.metrics.vehicleEnteredWater).toBe(true);
      expect(result.metrics.waterImpactX).toBeGreaterThan(3.5);
      expect(result.metrics.waterImpactX).toBeLessThan(6.5);
      expect(result.metrics.boatStayedUpright).toBe(true);
      expect(result.metrics.majorBodiesWithinCamera).toBe(true);
      expect(result.metrics.noRunawayVelocity).toBe(true);
    }
  });

  it("reconstructs Reset and Replay worlds without inherited state", () => {
    const outcome = classifyBridgeInput(HERO_BRIDGE_PARAMETERS, {
      deployedLengthMeters: 4.08,
    });
    const used = createBridgeWorld(outcome);
    for (let step = 0; step < 650; step += 1) used.step();
    expect(used.metrics.waterImpactStep).not.toBeNull();
    expect(used.pontoons).toHaveLength(2);

    const clean = createBridgeWorld(outcome);
    expect(clean.getSnapshot()).toMatchObject({
      deploymentProgress: 0,
      phase: "deploying",
      stepCount: 0,
    });
    expect(clean.metrics.waterImpactStep).toBeNull();
    expect(clean.metrics.brokenBridgeJoints).toBe(0);
    expect(clean.metrics.intermediateObjectBroken).toBe(false);
    expect(clean.pontoons).toHaveLength(0);
    expect(clean.chassis.getPosition().x).toBeCloseTo(-1.65, 6);

    used.destroy();
    clean.destroy();
    expect(used.world.getBodyCount()).toBe(0);
    expect(clean.world.getBodyCount()).toBe(0);
  });

  it("tears down the bridge world explicitly", () => {
    const simulation = createBridgeWorld(
      classifyBridgeInput(HERO_BRIDGE_PARAMETERS, {
        deployedLengthMeters: 4.08,
      }),
    );
    expect(simulation.world.getBodyCount()).toBeGreaterThan(0);
    simulation.destroy();
    expect(simulation.world.getBodyCount()).toBe(0);
  });
});
