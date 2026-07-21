export function AnalysisSubmitPanel({
  disabled,
  onSubmit,
  pendingOperations,
  retryUpload,
  submitting,
  templateId,
}: {
  disabled: boolean;
  onSubmit: () => void;
  pendingOperations: number;
  retryUpload: boolean;
  submitting: boolean;
  templateId: "bridge" | "water" | "speed" | "structure";
}) {
  return (
    <section
      className="analysis-submit-card"
      aria-labelledby="analysis-submit-title"
    >
      <div>
        <p className="feed-card__label">GPT-5.6 handwriting interpretation</p>
        <h2 id="analysis-submit-title">
          Let the math control the{" "}
          {templateId === "water"
            ? "water"
            : templateId === "speed"
              ? "shuttle"
              : templateId === "structure"
                ? "platform"
                : "bridge"}
        </h2>
        <p>
          Submit your work when you are ready. We&apos;ll read it and build the
          bridge from your answer.
        </p>
      </div>
      <button
        className="primary-button"
        disabled={disabled || pendingOperations > 0 || submitting}
        onClick={onSubmit}
        type="button"
      >
        {submitting
          ? "Preparing student work…"
          : retryUpload
            ? "Retry upload"
            : "Run my solution"}
      </button>
      {pendingOperations > 0 && (
        <p className="inline-status" role="status">
          Saving the latest stroke before capture…
        </p>
      )}
    </section>
  );
}
