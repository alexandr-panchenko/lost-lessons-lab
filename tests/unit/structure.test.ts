import { describe, expect, it } from "vitest";

import { STRUCTURE_FIXTURE_PACKS } from "../../fixtures/structure/packs";
import {
  StructureTaskParametersSchema,
  classifyStructureInput,
  deriveStructureLoad,
} from "../../src/shared/domain/structure";
import { validateStructureAnalysis } from "../../src/shared/validation/structure-analysis";
import {
  STRUCTURE_MAX_FRAGMENTS,
  createStructureWorld,
  runStructureWorldToResult,
} from "../../src/simulations/structure/structure-world";
import { structureAchievement } from "../../src/worker/domain/structure-achievements";

const fixture = STRUCTURE_FIXTURE_PACKS[0];
function analysis(totalLoadKg: number) {
  return {
    confidence: 0.95,
    finalAnswers: [{ name: "totalLoadKg", unit: "kg", value: totalLoadKg }],
    firstError: null,
    scenarioInputs: { itemCount: 12, totalLoadKg, unitLoadKg: 5 },
    schemaVersion: "solution-analysis.v1",
    steps: [
      {
        normalizedExpression: `12 * 5 = ${totalLoadKg}`,
        regionId: "line-1",
        status: totalLoadKg === 60 ? "valid" : "suspected_error",
        text: `12 × 5 = ${totalLoadKg}`,
      },
    ],
    studentFacingExplanation: "Multiply the crate count by the load per crate.",
    transcription: `12 × 5 = ${totalLoadKg}`,
    verdict: totalLoadKg === 60 ? "correct" : "incorrect",
  } as const;
}

describe("structure and load family", () => {
  it("keeps three curated packs valid below their breakaway thresholds", () => {
    expect(STRUCTURE_FIXTURE_PACKS).toHaveLength(3);
    for (const pack of STRUCTURE_FIXTURE_PACKS) {
      expect(StructureTaskParametersSchema.parse(pack.parameters)).toEqual(
        pack.parameters,
      );
      expect(deriveStructureLoad(pack.parameters)).toBeLessThan(
        pack.parameters.collapseThresholdKg,
      );
    }
  });
  it("classifies underload, stable, strained, and collapse values deterministically", () => {
    expect(
      classifyStructureInput(fixture.parameters, { totalLoadKg: 30 })
        .resultClass,
    ).toBe("structure_underload");
    expect(
      classifyStructureInput(fixture.parameters, { totalLoadKg: 60 })
        .resultClass,
    ).toBe("structure_stable");
    expect(
      classifyStructureInput(fixture.parameters, { totalLoadKg: 70 })
        .resultClass,
    ).toBe("structure_strained");
    expect(
      classifyStructureInput(fixture.parameters, { totalLoadKg: 90 })
        .resultClass,
    ).toBe("structure_collapse");
  });
  it("validates AI and manual values through one load contract", () => {
    expect(
      validateStructureAnalysis(analysis(60), fixture.parameters),
    ).toMatchObject({
      ok: true,
      value: { outcome: { resultClass: "structure_stable" } },
    });
    expect(
      validateStructureAnalysis(analysis(90), fixture.parameters),
    ).toMatchObject({
      ok: true,
      value: { outcome: { resultClass: "structure_collapse" } },
    });
  });
  it("settles a bounded prepared fragment set with finite positions", () => {
    const outcome = classifyStructureInput(fixture.parameters, {
      totalLoadKg: 1200,
    });
    const metrics = runStructureWorldToResult(outcome);
    expect(metrics.status).toBe("settled");
    expect(metrics.finite).toBe(true);
    expect(metrics.fragmentCount).toBe(STRUCTURE_MAX_FRAGMENTS);
    expect(metrics.bodyCount).toBeLessThanOrEqual(STRUCTURE_MAX_FRAGMENTS + 1);
    expect(metrics.maxAbsPosition).toBeLessThan(15);
  });
  it("tears down repeated worlds and keeps awards free of mastery claims", () => {
    const wrongOutcome = classifyStructureInput(fixture.parameters, {
      totalLoadKg: 90,
    });
    for (let index = 0; index < 5; index += 1) {
      const simulation = createStructureWorld(wrongOutcome);
      simulation.step();
      simulation.destroy();
      expect(simulation.world.getBodyCount()).toBe(0);
      expect(simulation.fragments).toHaveLength(0);
    }
    const wrong = structureAchievement({
      attemptId: "structure-wrong",
      createdAt: "2026-07-21T00:00:00.000Z",
      hadPriorIncorrectAttempt: false,
      outcome: wrongOutcome,
      roomSeq: 4,
    });
    const corrected = structureAchievement({
      attemptId: "structure-correct",
      createdAt: "2026-07-21T00:00:01.000Z",
      hadPriorIncorrectAttempt: true,
      outcome: classifyStructureInput(fixture.parameters, { totalLoadKg: 60 }),
      roomSeq: 5,
    });
    expect(wrong).toMatchObject({
      category: "disaster",
      key: "platform-pancake",
    });
    expect(corrected).toMatchObject({
      category: "progress",
      key: "support-restored",
    });
    expect(JSON.stringify([wrong, corrected]).toLowerCase()).not.toContain(
      "master",
    );
  });
});
