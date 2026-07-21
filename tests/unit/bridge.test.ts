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
      expect(result.bodyCount).toBeLessThanOrEqual(24);
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
    expect(result.steps * (1 / 60)).toBeGreaterThanOrEqual(12);
    expect(result.steps * (1 / 60)).toBeLessThanOrEqual(20);
    expect(result.metrics.maxBridgeJointForce).toBeGreaterThan(20);
    expect(result.metrics.brokenBridgeJoints).toBeGreaterThanOrEqual(3);
    expect(result.metrics.bridgeBreakStep).not.toBeNull();
    expect(result.metrics.frontWheelExitedDeck).toBe(true);
    expect(result.metrics.maxBridgeAbsAngle).toBeGreaterThan(0.55);
    expect(result.metrics.maxVehicleAbsAngle).toBeGreaterThan(1.2);
    expect(result.metrics.vehicleEnteredWater).toBe(true);
    expect(result.metrics.waterImpactX).not.toBeNull();
    expect(result.metrics.waterImpactStep).not.toBeNull();
    expect(result.metrics.bridgeBreakStep!).toBeLessThan(
      result.metrics.waterImpactStep!,
    );
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
    expect(replay.metrics.maxVehicleAbsAngle).toBeGreaterThan(1.2);
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
