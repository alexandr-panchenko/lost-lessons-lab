import type { AchievementAward } from "../../shared/achievement-types";
import type { WaterOutcome } from "../../shared/domain/water";

export function waterAchievement(input: {
  attemptId: string;
  createdAt: string;
  hadPriorIncorrectAttempt: boolean;
  outcome: WaterOutcome;
  roomSeq: number;
}): AchievementAward {
  if (!input.outcome.isMathematicallyCorrect) {
    return {
      attemptId: input.attemptId,
      category: "disaster",
      createdAt: input.createdAt,
      description:
        input.outcome.resultClass === "water_overflow"
          ? "Your value sent a bounded splash over the tank—excellent evidence to revisit the multiplication."
          : input.outcome.resultClass === "water_overfill"
            ? "Your value raised the water above its intended mark, making the extra volume visible."
            : "Your value left the tank surprisingly low, making the missing volume easy to see.",
      id: `achievement_${crypto.randomUUID()}`,
      key: "tidal-surprise",
      roomSeq: input.roomSeq,
      title: "Tidal Surprise",
    };
  }
  return {
    attemptId: input.attemptId,
    category: "progress",
    createdAt: input.createdAt,
    description: input.hadPriorIncorrectAttempt
      ? "You adjusted the calculation and brought the water to the intended level."
      : "Your rate-and-time calculation produced the intended water level.",
    id: `achievement_${crypto.randomUUID()}`,
    key: input.hadPriorIncorrectAttempt ? "level-adjusted" : "perfect-pour",
    roomSeq: input.roomSeq,
    title: input.hadPriorIncorrectAttempt ? "Level Adjusted" : "Perfect Pour",
  };
}
