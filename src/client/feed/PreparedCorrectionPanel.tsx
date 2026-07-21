export function PreparedCorrectionPanel({
  disabled,
  onApply,
}: {
  disabled: boolean;
  onApply: () => void;
}) {
  return (
    <section
      className="correction-card"
      aria-labelledby="prepared-correction-title"
    >
      <div>
        <p className="feed-card__label">Your next try</p>
        <h2 id="prepared-correction-title">Try your fraction strategy again</h2>
        <p>Return to your work and revise the step you want to change.</p>
      </div>
      <button
        className="primary-button"
        disabled={disabled}
        onClick={onApply}
        type="button"
      >
        Try again
      </button>
    </section>
  );
}
