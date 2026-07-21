import { useState, type FormEvent } from "react";

import type { StructureSimulationInputs } from "../../shared/domain/structure";

export function ManualStructurePanel({
  disabled,
  onSubmit,
  pendingOperations,
}: {
  disabled: boolean;
  onSubmit: (inputs: StructureSimulationInputs) => void;
  pendingOperations: number;
}) {
  const [itemCount, setItemCount] = useState("12");
  const [unitLoad, setUnitLoad] = useState("5");
  const [totalLoad, setTotalLoad] = useState("30");
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const count = Number(itemCount);
    const unitLoadKg = Number(unitLoad);
    const totalLoadKg = Number(totalLoad);
    if (
      !Number.isInteger(count) ||
      count <= 0 ||
      count > 50 ||
      !Number.isFinite(unitLoadKg) ||
      unitLoadKg <= 0 ||
      unitLoadKg > 100
    ) {
      setError("Use 1 to 50 items and a unit load up to 100 kilograms.");
      return;
    }
    if (
      !Number.isFinite(totalLoadKg) ||
      totalLoadKg < 0 ||
      totalLoadKg > 1200
    ) {
      setError("Enter a total load from 0 to 1200 kilograms.");
      return;
    }
    setError("");
    onSubmit({ itemCount: count, totalLoadKg, unitLoadKg });
  }
  return (
    <section className="manual-card" aria-labelledby="manual-structure-title">
      <div>
        <p className="feed-card__label">Manual fallback · no AI claim</p>
        <h2 id="manual-structure-title">Enter the load calculation</h2>
        <p>
          Enter the learner&apos;s values. Deterministic code classifies the
          load before any platform fragments move.
        </p>
      </div>
      <form className="manual-form" onSubmit={submit}>
        <label htmlFor="structure-count">Item count</label>
        <input
          id="structure-count"
          inputMode="numeric"
          onChange={(event) => setItemCount(event.target.value)}
          value={itemCount}
        />
        <label htmlFor="structure-unit-load">Load per item</label>
        <div className="unit-input">
          <input
            id="structure-unit-load"
            inputMode="decimal"
            onChange={(event) => setUnitLoad(event.target.value)}
            value={unitLoad}
          />
          <span>kg</span>
        </div>
        <label htmlFor="structure-total-load">Final total load</label>
        <div className="unit-input">
          <input
            id="structure-total-load"
            inputMode="decimal"
            onChange={(event) => setTotalLoad(event.target.value)}
            value={totalLoad}
          />
          <span>kg</span>
        </div>
        <button
          className="primary-button"
          disabled={disabled || pendingOperations > 0}
          type="submit"
        >
          Run platform value
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
