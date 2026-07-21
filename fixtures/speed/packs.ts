import type { SpeedTaskParameters } from "../../src/shared/domain/speed";
import { preparedSpeedHandwriting } from "../../src/shared/judge-handwriting";

export type SpeedFixturePack = {
  fixtureId: `speed-${string}-v1`;
  fixtureLabel: string;
  parameters: SpeedTaskParameters;
  prompt: string;
  skillLabel: string;
  taskTitle: string;
};

export const SPEED_FIXTURE_PACKS = [
  {
    fixtureId: "speed-shuttle-v1",
    fixtureLabel: "Motion lab sample",
    parameters: {
      bumperDistanceMeters: 30,
      presentationVariant: "shuttle-bumper-v1",
      speedMetersPerSecond: 8,
      timeSeconds: 3,
    },
    prompt:
      "A lab shuttle travels at 8 meters per second for 3 seconds. How far should it travel? A soft safety bumper is 30 meters from the start.",
    skillLabel: "Speed, time, and distance",
    taskTitle: "Guide the lab shuttle",
  },
  {
    fixtureId: "speed-rover-v1",
    fixtureLabel: "Curated motion pack",
    parameters: {
      bumperDistanceMeters: 30,
      presentationVariant: "shuttle-bumper-v1",
      speedMetersPerSecond: 6,
      timeSeconds: 4,
    },
    prompt:
      "A rover travels at 6 meters per second for 4 seconds. How far should it travel? A soft safety bumper is 30 meters from the start.",
    skillLabel: "Speed, time, and distance",
    taskTitle: "Park the test rover",
  },
  {
    fixtureId: "speed-cart-v1",
    fixtureLabel: "Curated motion pack",
    parameters: {
      bumperDistanceMeters: 32,
      presentationVariant: "shuttle-bumper-v1",
      speedMetersPerSecond: 5,
      timeSeconds: 5,
    },
    prompt:
      "A supply cart travels at 5 meters per second for 5 seconds. How far should it travel? A soft safety bumper is 32 meters from the start.",
    skillLabel: "Speed, time, and distance",
    taskTitle: "Stop the supply cart",
  },
] as const satisfies readonly SpeedFixturePack[];

export const DEFAULT_SPEED_FIXTURE = SPEED_FIXTURE_PACKS[0];
export const SPEED_PREPARED_OPERATIONS = preparedSpeedHandwriting();

export function speedFixtureById(
  fixtureId: string,
): SpeedFixturePack | undefined {
  return SPEED_FIXTURE_PACKS.find((pack) => pack.fixtureId === fixtureId);
}
