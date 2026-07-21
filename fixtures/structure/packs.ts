import type { StructureTaskParameters } from "../../src/shared/domain/structure";
import { preparedStructureHandwriting } from "../../src/shared/judge-handwriting";

export type StructureFixturePack = {
  fixtureId: `structure-${string}-v1`;
  fixtureLabel: string;
  parameters: StructureTaskParameters;
  prompt: string;
  skillLabel: string;
  taskTitle: string;
};

export const STRUCTURE_FIXTURE_PACKS = [
  {
    fixtureId: "structure-platform-v1",
    fixtureLabel: "Load lab sample",
    parameters: {
      collapseThresholdKg: 75,
      itemCount: 12,
      presentationVariant: "platform-fragments-v1",
      unitLoadKg: 5,
    },
    prompt:
      "A platform carries 12 identical crates. Each crate has a mass of 5 kilograms. What total load must the platform support? Its comic breakaway threshold is 75 kilograms.",
    skillLabel: "Multiplication and load",
    taskTitle: "Balance the cargo platform",
  },
  {
    fixtureId: "structure-stage-v1",
    fixtureLabel: "Curated load pack",
    parameters: {
      collapseThresholdKg: 90,
      itemCount: 8,
      presentationVariant: "platform-fragments-v1",
      unitLoadKg: 9,
    },
    prompt:
      "A stage holds 8 identical props. Each prop has a mass of 9 kilograms. What total load must the stage support? Its comic breakaway threshold is 90 kilograms.",
    skillLabel: "Multiplication and load",
    taskTitle: "Load the rehearsal stage",
  },
  {
    fixtureId: "structure-lift-v1",
    fixtureLabel: "Curated load pack",
    parameters: {
      collapseThresholdKg: 120,
      itemCount: 10,
      presentationVariant: "platform-fragments-v1",
      unitLoadKg: 10,
    },
    prompt:
      "A model lift carries 10 identical blocks. Each block has a mass of 10 kilograms. What total load must the lift support? Its comic breakaway threshold is 120 kilograms.",
    skillLabel: "Multiplication and load",
    taskTitle: "Load the model lift",
  },
] as const satisfies readonly StructureFixturePack[];

export const DEFAULT_STRUCTURE_FIXTURE = STRUCTURE_FIXTURE_PACKS[0];
export const STRUCTURE_PREPARED_OPERATIONS = preparedStructureHandwriting();

export function structureFixtureById(
  fixtureId: string,
): StructureFixturePack | undefined {
  return STRUCTURE_FIXTURE_PACKS.find((pack) => pack.fixtureId === fixtureId);
}
