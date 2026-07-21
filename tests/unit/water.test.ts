import { describe, expect, it } from "vitest";

import { WATER_FIXTURE_PACKS } from "../../fixtures/water/packs";
import {
  classifyWaterInput,
  deriveWaterVolume,
  WaterTaskParametersSchema,
} from "../../src/shared/domain/water";
import { validateWaterAnalysis } from "../../src/shared/validation/water-analysis";
import {
  WATER_MAX_DROPLETS,
  createWaterWorld,
  runWaterWorldToResult,
} from "../../src/simulations/water/water-world";
import { waterAchievement } from "../../src/worker/domain/water-achievements";

const fixture = WATER_FIXTURE_PACKS[0];

function analysis(volumeLiters: number) {
  return {
    confidence: 0.95,
    finalAnswers: [{ name: "volumeLiters", unit: "L", value: volumeLiters }],
    firstError: null,
    scenarioInputs: {
      flowRateLitersPerMinute: 3,
      timeMinutes: 5,
      volumeLiters,
    },
    schemaVersion: "solution-analysis.v1",
    steps: [
      {
        normalizedExpression: `3 * 5 = ${volumeLiters}`,
        regionId: "line-1",
        status: volumeLiters === 15 ? "valid" : "suspected_error",
        text: `3 × 5 = ${volumeLiters} L`,
      },
    ],
    studentFacingExplanation: "Multiply the liters per minute by the minutes.",
    transcription: `3 L/min × 5 min = ${volumeLiters} L`,
    verdict: volumeLiters === 15 ? "correct" : "incorrect",
  } as const;
}

describe("water and volume family", () => {
  it("keeps all three curated packs valid and bounded", () => {
    expect(WATER_FIXTURE_PACKS).toHaveLength(3);
    for (const pack of WATER_FIXTURE_PACKS) {
      expect(WaterTaskParametersSchema.parse(pack.parameters)).toEqual(
        pack.parameters,
      );
      expect(deriveWaterVolume(pack.parameters)).toBeLessThanOrEqual(
        pack.parameters.capacityLiters,
      );
    }
  });

  it("classifies underfill, correct level, and overflow deterministically", () => {
    expect(
      classifyWaterInput(fixture.parameters, { volumeLiters: 8 }).resultClass,
    ).toBe("water_underfill");
    expect(
      classifyWaterInput(fixture.parameters, { volumeLiters: 15 }).resultClass,
    ).toBe("water_correct");
    expect(
      classifyWaterInput(fixture.parameters, { volumeLiters: 18 }).resultClass,
    ).toBe("water_overfill");
    expect(
      classifyWaterInput(fixture.parameters, { volumeLiters: 24 }).resultClass,
    ).toBe("water_overflow");
  });

  it("validates AI and manual values through the same simulation contract", () => {
    const validated = validateWaterAnalysis(analysis(15), fixture.parameters);
    expect(validated).toMatchObject({
      ok: true,
      value: {
        inputs: {
          flowRateLitersPerMinute: 3,
          timeMinutes: 5,
          volumeLiters: 15,
        },
        outcome: { resultClass: "water_correct" },
      },
    });
    expect(
      validateWaterAnalysis(analysis(24), fixture.parameters),
    ).toMatchObject({
      ok: true,
      value: { outcome: { resultClass: "water_overflow" } },
    });
  });

  it("settles bounded overflow droplets with finite positions", () => {
    const outcome = classifyWaterInput(fixture.parameters, {
      volumeLiters: 120,
    });
    const metrics = runWaterWorldToResult(outcome);
    expect(metrics.status).toBe("settled");
    expect(metrics.finite).toBe(true);
    expect(metrics.dropletCount).toBeLessThanOrEqual(WATER_MAX_DROPLETS);
    expect(metrics.bodyCount).toBeLessThanOrEqual(WATER_MAX_DROPLETS + 3);
    expect(metrics.maxAbsPosition).toBeLessThan(30);
  });

  it("tears down repeated worlds without retaining physics bodies", () => {
    const outcome = classifyWaterInput(fixture.parameters, {
      volumeLiters: 120,
    });
    for (let index = 0; index < 5; index += 1) {
      const simulation = createWaterWorld(outcome);
      expect(simulation.bodyCount).toBeLessThanOrEqual(WATER_MAX_DROPLETS + 3);
      simulation.step();
      simulation.destroy();
      expect(simulation.world.getBodyCount()).toBe(0);
      expect(simulation.droplets).toHaveLength(0);
    }
  });

  it("keeps water disaster and progress awards distinct without mastery claims", () => {
    const wrong = waterAchievement({
      attemptId: "water-attempt-wrong",
      createdAt: "2026-07-21T00:00:00.000Z",
      hadPriorIncorrectAttempt: false,
      outcome: classifyWaterInput(fixture.parameters, { volumeLiters: 24 }),
      roomSeq: 4,
    });
    const corrected = waterAchievement({
      attemptId: "water-attempt-correct",
      createdAt: "2026-07-21T00:00:01.000Z",
      hadPriorIncorrectAttempt: true,
      outcome: classifyWaterInput(fixture.parameters, { volumeLiters: 15 }),
      roomSeq: 5,
    });
    expect(wrong).toMatchObject({
      category: "disaster",
      key: "tidal-surprise",
    });
    expect(corrected).toMatchObject({
      category: "progress",
      key: "level-adjusted",
    });
    expect(JSON.stringify([wrong, corrected]).toLowerCase()).not.toContain(
      "master",
    );
  });
});
