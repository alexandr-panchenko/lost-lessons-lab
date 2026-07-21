import { z } from "zod";

const LearnerFeedbackTextSchema = z.string().trim().min(1).max(240);

export const LearnerBridgeFeedbackSchema = z
  .object({
    conceptualGuidance: LearnerFeedbackTextSchema,
    errorFocus: LearnerFeedbackTextSchema,
    headline: LearnerFeedbackTextSchema,
    hints: z.tuple([LearnerFeedbackTextSchema, LearnerFeedbackTextSchema]),
    observation: LearnerFeedbackTextSchema,
  })
  .strict();
export type LearnerBridgeFeedback = z.infer<typeof LearnerBridgeFeedbackSchema>;

export const CURATED_WRONG_BRIDGE_FEEDBACK: LearnerBridgeFeedback = {
  conceptualGuidance:
    "A fraction means division. Its digits are not simply placed after a decimal point.",
  errorFocus: "Look again at this step: 3/4 = 0.34.",
  headline: "The bridge fell short.",
  hints: [
    "The denominator tells you how many equal parts to split the 12-meter kit into. What is one of four equal parts?",
    "Now take three of those equal parts.",
  ],
  observation: "The bridge was built from your answer: 4.08 m.",
};

export function containsHiddenBridgeAnswer(value: string): boolean {
  const normalized = value
    .normalize("NFKC")
    .toLowerCase()
    .replaceAll(",", ".")
    .replace(/\s+/gu, " ");
  return (
    /(?:^|\D)0\.75(?:\D|$)/u.test(normalized) ||
    /\b9\s*(?:m|meter|meters|metre|metres)\b/u.test(normalized) ||
    /\bnine\s+(?:m|meter|meters|metre|metres)\b/u.test(normalized)
  );
}

export function guardLearnerBridgeFeedback(
  candidate: unknown,
): LearnerBridgeFeedback {
  const parsed = LearnerBridgeFeedbackSchema.safeParse(candidate);
  if (!parsed.success) return CURATED_WRONG_BRIDGE_FEEDBACK;
  const visibleText = [
    parsed.data.headline,
    parsed.data.observation,
    parsed.data.errorFocus,
    parsed.data.conceptualGuidance,
    ...parsed.data.hints,
  ].join(" ");
  return containsHiddenBridgeAnswer(visibleText)
    ? CURATED_WRONG_BRIDGE_FEEDBACK
    : parsed.data;
}

export function guardLearnerBridgeText(
  candidate: string,
  fallback: string,
): string {
  return containsHiddenBridgeAnswer(candidate) ? fallback : candidate;
}
