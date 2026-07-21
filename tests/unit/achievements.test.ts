import { describe, expect, it } from "vitest";

import {
  HERO_BRIDGE_PARAMETERS,
  classifyBridgeInput,
} from "../../src/shared/domain/bridge";
import { bridgeAchievement } from "../../src/worker/domain/achievements";

const createdAt = "2026-07-21T00:00:00.000Z";

function award(
  deployedLengthMeters: number,
  hadPriorIncorrectAttempt: boolean,
) {
  return bridgeAchievement({
    attemptId: "attempt_achievement_test",
    createdAt,
    hadPriorIncorrectAttempt,
    outcome: classifyBridgeInput(HERO_BRIDGE_PARAMETERS, {
      deployedLengthMeters,
      fractionAsDecimal: deployedLengthMeters / 12,
    }),
    roomSeq: 10,
  });
}

describe("bridge achievements", () => {
  it("classifies a wrong bridge as a disaster discovery", () => {
    expect(award(4.08, false)).toMatchObject({
      category: "disaster",
      key: "worlds-shortest-bridge",
      title: "The World's Shortest Bridge",
    });
  });

  it("awards progress for a successful correction", () => {
    const result = award(9, true);
    expect(result).toMatchObject({
      category: "progress",
      key: "fixed-it",
      title: "Fixed It",
    });
    expect(`${result.title} ${result.description}`.toLowerCase()).not.toMatch(
      /mastery|mastered/u,
    );
  });

  it("keeps a first correct attempt distinct from a correction", () => {
    expect(award(9, false)).toMatchObject({
      category: "progress",
      key: "first-try-crossing",
    });
  });
});
