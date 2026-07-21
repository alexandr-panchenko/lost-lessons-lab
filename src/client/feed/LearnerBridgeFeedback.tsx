import { useState } from "react";

import {
  CURATED_WRONG_BRIDGE_FEEDBACK,
  guardLearnerBridgeFeedback,
} from "../../shared/learner-feedback";

export function LearnerBridgeFeedback({
  onTryAgain,
}: {
  onTryAgain: () => void;
}) {
  const feedback = guardLearnerBridgeFeedback(CURATED_WRONG_BRIDGE_FEEDBACK);
  const [hintCount, setHintCount] = useState(0);

  return (
    <section
      className="learner-feedback-card"
      aria-labelledby="learner-feedback-title"
    >
      <div className="learner-feedback-card__copy">
        <p className="feed-card__label">What to try next</p>
        <h2 id="learner-feedback-title">{feedback.headline}</h2>
        <p>{feedback.observation}</p>
        <p className="learner-feedback-card__focus">{feedback.errorFocus}</p>
        <p>{feedback.conceptualGuidance}</p>
      </div>
      <div
        aria-label="The 12-meter bridge kit split into four equal unlabeled parts"
        className="fraction-kit"
        role="img"
      >
        {[0, 1, 2, 3].map((part) => (
          <span aria-hidden="true" key={part} />
        ))}
      </div>
      {hintCount > 0 && (
        <div className="learner-hints" aria-live="polite">
          <p>
            <strong>Hint 1:</strong> {feedback.hints[0]}
          </p>
          {hintCount > 1 && (
            <p>
              <strong>Hint 2:</strong> {feedback.hints[1]}
            </p>
          )}
        </div>
      )}
      <div className="learner-feedback-card__actions">
        <button className="primary-button" onClick={onTryAgain} type="button">
          Try again
        </button>
        {hintCount < 2 && (
          <button
            className="secondary-button"
            onClick={() => setHintCount((count) => Math.min(2, count + 1))}
            type="button"
          >
            {hintCount === 0 ? "Give me a hint" : "Give me another hint"}
          </button>
        )}
      </div>
    </section>
  );
}
