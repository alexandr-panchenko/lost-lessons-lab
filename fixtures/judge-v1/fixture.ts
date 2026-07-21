import { preparedBridgeHandwriting } from "../../src/shared/judge-handwriting";

export const JUDGE_FIXTURE_ID = "judge-v1" as const;

export const judgePreparedWrongOperations = preparedBridgeHandwriting(
  "wrong",
  "judge-v1-wrong",
);

export const bridgeRoomFixture = {
  fixtureLabel: "Prepared judge sample",
  prompt:
    "Engineers have a 12-meter bridge kit. To cross the ravine, they must deploy three quarters of the kit. How many meters of bridge should they deploy?",
  skillLabel: "Fractions and decimal conversion",
  supportedSkills: ["Fractions"],
  taskTitle: "Fractions and the bridge",
} as const;
