export const JUDGE_FIXTURE_ID = "judge-v1" as const;

export const bridgeRoomFixture = {
  fixtureLabel: "Prepared judge sample",
  prompt:
    "Engineers have a 12-meter bridge kit. To cross the ravine, they must deploy three quarters of the kit. How many meters of bridge should they deploy?",
  skillLabel: "Fractions and decimal conversion",
  supportedSkills: ["Fractions", "Percentages", "Measurement", "Proportions"],
  taskTitle: "Fractions and the bridge",
} as const;
