export function AnalysisSubmitPanel({
  disabled,
  onSubmit,
  pendingOperations,
  submitting,
}: {
  disabled: boolean;
  onSubmit: () => void;
  pendingOperations: number;
  submitting: boolean;
}) {
  return (
    <section
      className="analysis-submit-card"
      aria-labelledby="analysis-submit-title"
    >
      <div>
        <p className="feed-card__label">GPT-5.6 handwriting interpretation</p>
        <h2 id="analysis-submit-title">Let the math control the bridge</h2>
        <p>
          Submit only the solid learner layer. The AI reads the handwriting;
          deterministic code checks every value before physics starts.
        </p>
      </div>
      <button
        className="primary-button"
        disabled={disabled || pendingOperations > 0 || submitting}
        onClick={onSubmit}
        type="button"
      >
        {submitting ? "Preparing student work…" : "Run my solution"}
      </button>
      {pendingOperations > 0 && (
        <p className="inline-status" role="status">
          Saving the latest stroke before capture…
        </p>
      )}
    </section>
  );
}
