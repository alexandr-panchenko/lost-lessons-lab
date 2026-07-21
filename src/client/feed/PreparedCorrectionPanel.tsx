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
        <p className="feed-card__label">Prepared correction · still editable</p>
        <h2 id="prepared-correction-title">
          Try the fraction conversion again
        </h2>
        <p>
          Replace the sample with <strong>3/4 = 0.75</strong> and
          <strong> 12 × 0.75 = 9 m</strong>, then submit the new canvas state.
        </p>
      </div>
      <button
        className="primary-button"
        disabled={disabled}
        onClick={onApply}
        type="button"
      >
        Apply prepared correction
      </button>
    </section>
  );
}
