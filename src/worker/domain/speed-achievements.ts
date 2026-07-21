import type { AchievementAward } from "../../shared/achievement-types";
import type { SpeedOutcome } from "../../shared/domain/speed";

export function speedAchievement(input: {
  attemptId: string;
  createdAt: string;
  hadPriorIncorrectAttempt: boolean;
  outcome: SpeedOutcome;
  roomSeq: number;
}): AchievementAward {
  if (!input.outcome.isMathematicallyCorrect) {
    return {
      attemptId: input.attemptId,
      category: "disaster",
      createdAt: input.createdAt,
      description:
        input.outcome.resultClass === "speed_collision"
          ? "Your distance sent the shuttle into the soft bumper with a harmless boop."
          : input.outcome.resultClass === "speed_overshoot"
            ? "Your distance carried the shuttle past its station but stopped before the bumper."
            : "Your distance stopped the shuttle before its station, making the missing travel visible.",
      id: `achievement_${crypto.randomUUID()}`,
      key: "bumper-boop",
      roomSeq: input.roomSeq,
      title: "Bumper Boop",
    };
  }
  return {
    attemptId: input.attemptId,
    category: "progress",
    createdAt: input.createdAt,
    description: input.hadPriorIncorrectAttempt
      ? "You corrected the calculation and guided the shuttle to its station."
      : "Your speed-and-time calculation guided the shuttle to its station.",
    id: `achievement_${crypto.randomUUID()}`,
    key: input.hadPriorIncorrectAttempt ? "route-corrected" : "perfect-arrival",
    roomSeq: input.roomSeq,
    title: input.hadPriorIncorrectAttempt
      ? "Route Corrected"
      : "Perfect Arrival",
  };
}
