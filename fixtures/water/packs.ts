import type { WaterTaskParameters } from "../../src/shared/domain/water";
import { preparedWaterHandwriting } from "../../src/shared/judge-handwriting";

export type WaterFixturePack = {
  fixtureId: `water-${string}-v1`;
  fixtureLabel: string;
  parameters: WaterTaskParameters;
  prompt: string;
  skillLabel: string;
  taskTitle: string;
};

export const WATER_FIXTURE_PACKS = [
  {
    fixtureId: "water-aquarium-v1",
    fixtureLabel: "Water lab sample",
    parameters: {
      capacityLiters: 20,
      flowRateLitersPerMinute: 3,
      presentationVariant: "tank-splash-v1",
      timeMinutes: 5,
    },
    prompt:
      "An aquarium can hold 20 liters. A pump adds 3 liters of water each minute for 5 minutes. How many liters enter the aquarium?",
    skillLabel: "Volume, rate, and time",
    taskTitle: "Fill the aquarium",
  },
  {
    fixtureId: "water-garden-v1",
    fixtureLabel: "Curated water pack",
    parameters: {
      capacityLiters: 30,
      flowRateLitersPerMinute: 4,
      presentationVariant: "tank-splash-v1",
      timeMinutes: 6,
    },
    prompt:
      "A garden tank can hold 30 liters. A hose adds 4 liters each minute for 6 minutes. How many liters enter the tank?",
    skillLabel: "Volume, rate, and time",
    taskTitle: "Fill the garden tank",
  },
  {
    fixtureId: "water-mixing-v1",
    fixtureLabel: "Curated water pack",
    parameters: {
      capacityLiters: 18,
      flowRateLitersPerMinute: 2.5,
      presentationVariant: "tank-splash-v1",
      timeMinutes: 6,
    },
    prompt:
      "A mixing tank can hold 18 liters. A pipe adds 2.5 liters each minute for 6 minutes. How many liters enter the tank?",
    skillLabel: "Volume, rate, and time",
    taskTitle: "Fill the mixing tank",
  },
] as const satisfies readonly WaterFixturePack[];

export const DEFAULT_WATER_FIXTURE = WATER_FIXTURE_PACKS[0];
export const WATER_PREPARED_OPERATIONS = preparedWaterHandwriting();

export function waterFixtureById(
  fixtureId: string,
): WaterFixturePack | undefined {
  return WATER_FIXTURE_PACKS.find((pack) => pack.fixtureId === fixtureId);
}
