import { useState, type FormEvent } from "react";

import type { SpeedSimulationInputs } from "../../shared/domain/speed";

export function ManualSpeedPanel({
  disabled,
  onSubmit,
  pendingOperations,
}: {
  disabled: boolean;
  onSubmit: (inputs: SpeedSimulationInputs) => void;
  pendingOperations: number;
}) {
  const [distance, setDistance] = useState("12");
  const [speed, setSpeed] = useState("8");
  const [time, setTime] = useState("3");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const distanceMeters = Number(distance);
    const speedMetersPerSecond = Number(speed);
    const timeSeconds = Number(time);
    if (
      !Number.isFinite(distanceMeters) ||
      distanceMeters < 0 ||
      distanceMeters > 240
    ) {
      setError("Enter a travel distance from 0 to 240 meters.");
      return;
    }
    if (
      !Number.isFinite(speedMetersPerSecond) ||
      speedMetersPerSecond <= 0 ||
      speedMetersPerSecond > 40 ||
      !Number.isFinite(timeSeconds) ||
      timeSeconds <= 0 ||
      timeSeconds > 30
    ) {
      setError("Use a speed up to 40 m/s and a time up to 30 seconds.");
      return;
    }
    setError("");
    onSubmit({ distanceMeters, speedMetersPerSecond, timeSeconds });
  }

  return (
    <section className="manual-card" aria-labelledby="manual-speed-title">
      <div>
        <p className="feed-card__label">Manual fallback · no AI claim</p>
        <h2 id="manual-speed-title">Enter the motion calculation</h2>
        <p>
          Enter the values from the learner&apos;s work. Deterministic code
          checks the distance before the bounded motion scene runs.
        </p>
      </div>
      <form className="manual-form" onSubmit={submit}>
        <label htmlFor="speed-rate">Speed</label>
        <div className="unit-input">
          <input
            id="speed-rate"
            inputMode="decimal"
            onChange={(event) => setSpeed(event.target.value)}
            value={speed}
          />
          <span>m/s</span>
        </div>
        <label htmlFor="speed-time">Time</label>
        <div className="unit-input">
          <input
            id="speed-time"
            inputMode="decimal"
            onChange={(event) => setTime(event.target.value)}
            value={time}
          />
          <span>seconds</span>
        </div>
        <label htmlFor="speed-distance">Final travel distance</label>
        <div className="unit-input">
          <input
            id="speed-distance"
            inputMode="decimal"
            onChange={(event) => setDistance(event.target.value)}
            value={distance}
          />
          <span>meters</span>
        </div>
        <button
          className="primary-button"
          disabled={disabled || pendingOperations > 0}
          type="submit"
        >
          Run shuttle value
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
