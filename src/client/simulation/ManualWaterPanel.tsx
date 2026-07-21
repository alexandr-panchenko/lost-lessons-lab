import { useState, type FormEvent } from "react";

import type { WaterSimulationInputs } from "../../shared/domain/water";

export function ManualWaterPanel({
  disabled,
  onSubmit,
  pendingOperations,
}: {
  disabled: boolean;
  onSubmit: (inputs: WaterSimulationInputs) => void;
  pendingOperations: number;
}) {
  const [volume, setVolume] = useState("8");
  const [flowRate, setFlowRate] = useState("3");
  const [time, setTime] = useState("5");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const volumeLiters = Number(volume);
    const flowRateLitersPerMinute = Number(flowRate);
    const timeMinutes = Number(time);
    if (
      !Number.isFinite(volumeLiters) ||
      volumeLiters < 0 ||
      volumeLiters > 120
    ) {
      setError("Enter a water volume from 0 to 120 liters.");
      return;
    }
    if (
      !Number.isFinite(flowRateLitersPerMinute) ||
      flowRateLitersPerMinute <= 0 ||
      flowRateLitersPerMinute > 20 ||
      !Number.isFinite(timeMinutes) ||
      timeMinutes <= 0 ||
      timeMinutes > 30
    ) {
      setError(
        "Use a flow rate from 0 to 20 L/min and a time up to 30 minutes.",
      );
      return;
    }
    setError("");
    onSubmit({ flowRateLitersPerMinute, timeMinutes, volumeLiters });
  }

  return (
    <section className="manual-card" aria-labelledby="manual-water-title">
      <div>
        <p className="feed-card__label">Manual fallback · no AI claim</p>
        <h2 id="manual-water-title">Enter the water calculation</h2>
        <p>
          Enter the values from the learner&apos;s work. The deterministic water
          contract and the same bounded scene run below.
        </p>
      </div>
      <form className="manual-form" onSubmit={submit}>
        <label htmlFor="water-flow-rate">Flow rate</label>
        <div className="unit-input">
          <input
            id="water-flow-rate"
            inputMode="decimal"
            onChange={(event) => setFlowRate(event.target.value)}
            value={flowRate}
          />
          <span>L/min</span>
        </div>
        <label htmlFor="water-time">Time</label>
        <div className="unit-input">
          <input
            id="water-time"
            inputMode="decimal"
            onChange={(event) => setTime(event.target.value)}
            value={time}
          />
          <span>minutes</span>
        </div>
        <label htmlFor="water-volume">Final water volume</label>
        <div className="unit-input">
          <input
            id="water-volume"
            inputMode="decimal"
            onChange={(event) => setVolume(event.target.value)}
            value={volume}
          />
          <span>liters</span>
        </div>
        <button
          className="primary-button"
          disabled={disabled || pendingOperations > 0}
          type="submit"
        >
          Run water value
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
