import { describe, expect, it } from "vitest";

import { SPEED_FIXTURE_PACKS } from "../../fixtures/speed/packs";
import {
  SpeedTaskParametersSchema,
  classifySpeedInput,
  deriveTravelDistance,
} from "../../src/shared/domain/speed";
import { validateSpeedAnalysis } from "../../src/shared/validation/speed-analysis";
import {
  createSpeedWorld,
  runSpeedWorldToResult,
} from "../../src/simulations/speed/speed-world";
import { speedAchievement } from "../../src/worker/domain/speed-achievements";

const fixture = SPEED_FIXTURE_PACKS[0];

function analysis(distanceMeters: number) {
  return {
    confidence: 0.95,
    finalAnswers: [
      { name: "distanceMeters", unit: "m", value: distanceMeters },
    ],
    firstError: null,
    scenarioInputs: {
      distanceMeters,
      speedMetersPerSecond: 8,
      timeSeconds: 3,
    },
    schemaVersion: "solution-analysis.v1",
    steps: [
      {
        normalizedExpression: `8 * 3 = ${distanceMeters}`,
        regionId: "line-1",
        status: distanceMeters === 24 ? "valid" : "suspected_error",
        text: `8 × 3 = ${distanceMeters} m`,
      },
    ],
    studentFacingExplanation: "Multiply speed by time to find distance.",
    transcription: `8 m/s × 3 s = ${distanceMeters} m`,
    verdict: distanceMeters === 24 ? "correct" : "incorrect",
  } as const;
}

describe("speed and collision family", () => {
  it("keeps three curated packs valid with broad bumper separation", () => {
    expect(SPEED_FIXTURE_PACKS).toHaveLength(3);
    for (const pack of SPEED_FIXTURE_PACKS) {
      expect(SpeedTaskParametersSchema.parse(pack.parameters)).toEqual(
        pack.parameters,
      );
      expect(deriveTravelDistance(pack.parameters)).toBeLessThan(
        pack.parameters.bumperDistanceMeters,
      );
    }
  });

  it("classifies short, correct, overshoot, and collision distances deterministically", () => {
    expect(
      classifySpeedInput(fixture.parameters, { distanceMeters: 12 })
        .resultClass,
    ).toBe("speed_short");
    expect(
      classifySpeedInput(fixture.parameters, { distanceMeters: 24 })
        .resultClass,
    ).toBe("speed_correct");
    expect(
      classifySpeedInput(fixture.parameters, { distanceMeters: 27 })
        .resultClass,
    ).toBe("speed_overshoot");
    expect(
      classifySpeedInput(fixture.parameters, { distanceMeters: 36 })
        .resultClass,
    ).toBe("speed_collision");
  });

  it("validates AI and manual values through one motion contract", () => {
    expect(
      validateSpeedAnalysis(analysis(24), fixture.parameters),
    ).toMatchObject({
      ok: true,
      value: { outcome: { resultClass: "speed_correct" } },
    });
    expect(
      validateSpeedAnalysis(analysis(36), fixture.parameters),
    ).toMatchObject({
      ok: true,
      value: { outcome: { resultClass: "speed_collision" } },
    });
  });

  it("uses CCD to stop an extreme fast body at the bumper without tunneling", () => {
    const outcome = classifySpeedInput(fixture.parameters, {
      distanceMeters: 240,
    });
    const metrics = runSpeedWorldToResult(outcome);
    expect(metrics.status).toBe("collided");
    expect(metrics.collided).toBe(true);
    expect(metrics.finite).toBe(true);
    expect(metrics.bodyCount).toBe(3);
    expect(metrics.shuttleX).toBeLessThan(10.5);
  });

  it("tears down repeated worlds and keeps awards free of mastery claims", () => {
    const wrongOutcome = classifySpeedInput(fixture.parameters, {
      distanceMeters: 36,
    });
    for (let index = 0; index < 5; index += 1) {
      const simulation = createSpeedWorld(wrongOutcome);
      simulation.step();
      simulation.destroy();
      expect(simulation.world.getBodyCount()).toBe(0);
    }
    const wrong = speedAchievement({
      attemptId: "speed-attempt-wrong",
      createdAt: "2026-07-21T00:00:00.000Z",
      hadPriorIncorrectAttempt: false,
      outcome: wrongOutcome,
      roomSeq: 4,
    });
    const corrected = speedAchievement({
      attemptId: "speed-attempt-correct",
      createdAt: "2026-07-21T00:00:01.000Z",
      hadPriorIncorrectAttempt: true,
      outcome: classifySpeedInput(fixture.parameters, { distanceMeters: 24 }),
      roomSeq: 5,
    });
    expect(wrong).toMatchObject({ category: "disaster", key: "bumper-boop" });
    expect(corrected).toMatchObject({
      category: "progress",
      key: "route-corrected",
    });
    expect(JSON.stringify([wrong, corrected]).toLowerCase()).not.toContain(
      "master",
    );
  });
});
