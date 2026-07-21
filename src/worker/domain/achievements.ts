import type { AchievementAward } from "../../shared/achievement-types";
import type { BridgeOutcome } from "../../shared/domain/bridge";

export function bridgeAchievement(input: {
  attemptId: string;
  createdAt: string;
  hadPriorIncorrectAttempt: boolean;
  outcome: BridgeOutcome;
  roomSeq: number;
}): AchievementAward {
  if (!input.outcome.isMathematicallyCorrect) {
    return {
      attemptId: input.attemptId,
      category: "disaster",
      createdAt: input.createdAt,
      description:
        "You discovered how a small decimal can build a spectacularly short bridge.",
      id: `achievement_${crypto.randomUUID()}`,
      key: "worlds-shortest-bridge",
      roomSeq: input.roomSeq,
      title: "The World's Shortest Bridge",
    };
  }
  if (input.hadPriorIncorrectAttempt) {
    return {
      attemptId: input.attemptId,
      category: "progress",
      createdAt: input.createdAt,
      description:
        "You changed the math, rebuilt the bridge, and made the crossing safe.",
      id: `achievement_${crypto.randomUUID()}`,
      key: "fixed-it",
      roomSeq: input.roomSeq,
      title: "Fixed It",
    };
  }
  return {
    attemptId: input.attemptId,
    category: "progress",
    createdAt: input.createdAt,
    description: "Your first verified bridge reached the far side safely.",
    id: `achievement_${crypto.randomUUID()}`,
    key: "first-try-crossing",
    roomSeq: input.roomSeq,
    title: "First-Try Crossing",
  };
}
