import { useState, type FormEvent } from "react";

import type { BridgeSimulationInputs } from "../../shared/domain/bridge";

type ManualBridgePanelProps = {
  disabled: boolean;
  onSubmit: (inputs: BridgeSimulationInputs) => void;
  pendingOperations: number;
};

export function ManualBridgePanel({
  disabled,
  onSubmit,
  pendingOperations,
}: ManualBridgePanelProps) {
  const [bridgeLength, setBridgeLength] = useState("4.08");
  const [decimal, setDecimal] = useState("0.34");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const deployedLengthMeters = Number(bridgeLength);
    const fractionAsDecimal =
      decimal.trim() === "" ? undefined : Number(decimal);
    if (
      !Number.isFinite(deployedLengthMeters) ||
      deployedLengthMeters <= 0 ||
      deployedLengthMeters > 24
    ) {
      setError(
        "Enter a bridge length greater than 0 and no more than 24 meters.",
      );
      return;
    }
    if (
      fractionAsDecimal !== undefined &&
      (!Number.isFinite(fractionAsDecimal) ||
        fractionAsDecimal < 0 ||
        fractionAsDecimal > 2)
    ) {
      setError("The optional decimal must be between 0 and 2.");
      return;
    }
    setError("");
    onSubmit({
      deployedLengthMeters,
      ...(fractionAsDecimal === undefined ? {} : { fractionAsDecimal }),
    });
  }

  return (
    <section className="manual-card" aria-labelledby="manual-title">
      <div>
        <p className="feed-card__label">Use your measurement</p>
        <h2 id="manual-title">Build from your answer</h2>
        <p>
          Enter the bridge length from your work. You can solve with fractions
          directly; the decimal field is optional.
        </p>
      </div>
      <form className="manual-form" onSubmit={submit}>
        <label htmlFor="bridge-length">Bridge length</label>
        <div className="unit-input">
          <input
            id="bridge-length"
            inputMode="decimal"
            onChange={(event) => setBridgeLength(event.target.value)}
            value={bridgeLength}
          />
          <span>meters</span>
        </div>
        <label htmlFor="fraction-decimal">
          Fraction as a decimal (optional)
        </label>
        <input
          id="fraction-decimal"
          inputMode="decimal"
          onChange={(event) => setDecimal(event.target.value)}
          value={decimal}
        />
        <button
          className="primary-button"
          disabled={disabled || pendingOperations > 0}
          type="submit"
        >
          Test this bridge
        </button>
        {pendingOperations > 0 && (
          <p className="inline-status" role="status">
            Saving the latest stroke before capture…
          </p>
        )}
        <p className="field-error" role="alert">
          {error}
        </p>
      </form>
    </section>
  );
}
