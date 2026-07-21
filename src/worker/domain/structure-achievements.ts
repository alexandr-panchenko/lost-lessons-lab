import type { AchievementAward } from "../../shared/achievement-types";
import type { StructureOutcome } from "../../shared/domain/structure";

export function structureAchievement(input: {
  attemptId: string;
  createdAt: string;
  hadPriorIncorrectAttempt: boolean;
  outcome: StructureOutcome;
  roomSeq: number;
}): AchievementAward {
  if (!input.outcome.isMathematicallyCorrect) {
    return {
      attemptId: input.attemptId,
      category: "disaster",
      createdAt: input.createdAt,
      description:
        input.outcome.resultClass === "structure_collapse"
          ? "Your load triggered the prepared breakaway platform and a bounded pile of comic fragments."
          : input.outcome.resultClass === "structure_strained"
            ? "Your load made the platform visibly strain without breaking."
            : "Your load left part of the expected cargo uncounted.",
      id: `achievement_${crypto.randomUUID()}`,
      key: "platform-pancake",
      roomSeq: input.roomSeq,
      title: "Platform Pancake",
    };
  }
  return {
    attemptId: input.attemptId,
    category: "progress",
    createdAt: input.createdAt,
    description: input.hadPriorIncorrectAttempt
      ? "You corrected the load calculation and restored the platform support."
      : "Your load calculation kept the cargo platform stable.",
    id: `achievement_${crypto.randomUUID()}`,
    key: input.hadPriorIncorrectAttempt ? "support-restored" : "load-balanced",
    roomSeq: input.roomSeq,
    title: input.hadPriorIncorrectAttempt
      ? "Support Restored"
      : "Load Balanced",
  };
}
