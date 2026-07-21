import { describe, expect, it } from "vitest";

import {
  CURATED_WRONG_BRIDGE_FEEDBACK,
  containsHiddenBridgeAnswer,
  guardLearnerBridgeFeedback,
  LearnerBridgeFeedbackSchema,
} from "../../src/shared/learner-feedback";

describe("learner bridge feedback disclosure guard", () => {
  it("defines no expected-answer field", () => {
    expect(LearnerBridgeFeedbackSchema.keyof().options).toEqual([
      "conceptualGuidance",
      "errorFocus",
      "headline",
      "hints",
      "observation",
    ]);
    expect(JSON.stringify(CURATED_WRONG_BRIDGE_FEEDBACK)).not.toMatch(
      /0\.75|9\s*m|expected/iu,
    );
  });

  it.each(["0.75", "0,75", "9 m", "9 meters", "nine metres"])(
    "recognizes normalized hidden answer form %s",
    (value) => expect(containsHiddenBridgeAnswer(value)).toBe(true),
  );

  it("replaces generated feedback that leaks the result", () => {
    const guarded = guardLearnerBridgeFeedback({
      ...CURATED_WRONG_BRIDGE_FEEDBACK,
      conceptualGuidance: "Use 0.75 and build 9 meters.",
    });
    expect(guarded).toEqual(CURATED_WRONG_BRIDGE_FEEDBACK);
  });
});
