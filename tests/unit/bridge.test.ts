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
      expect(result.bodyCount).toBeLessThanOrEqual(5);
      expect(result.maxAbsPosition).toBeLessThan(30);
      expect(result.steps).toBeLessThanOrEqual(720);
    },
  );

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
