import { useEffect, useState } from "react";

import type {
  AiAttempt,
  AnalysisRecord,
  AnalysisStatus,
} from "../../shared/analysis-types";
import type { RoomLocation } from "../room/room-client";

const STATUS_LABELS: Record<AnalysisStatus, string> = {
  complete: "Interpretation complete",
  extracting: "Extracting visible steps…",
  failed: "Interpretation needs your help",
  preparing: "Preparing the verified simulation inputs…",
  reading: "Reading the handwriting…",
  uploading: "Saving the student-only image…",
  validating: "Checking the measurement…",
};

function AttemptImage({
  attempt,
  room,
}: {
  attempt: AiAttempt;
  room: RoomLocation;
}) {
  const [source, setSource] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (attempt.media === null) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    void fetch(
      `/api/rooms/${room.roomId}/media/${encodeURIComponent(attempt.media.id)}`,
      {
        headers: { Authorization: `Bearer ${room.token}` },
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("media unavailable");
        objectUrl = URL.createObjectURL(await response.blob());
        setSource(objectUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => {
      controller.abort();
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
    };
  }, [attempt.media, room.roomId, room.token]);

  if (failed)
    return (
      <p className="attempt-media-status">Saved work image unavailable.</p>
    );
  if (source === null) {
    return <p className="attempt-media-status">Loading saved student work…</p>;
  }
  return (
    <img alt="Student handwriting submitted for this attempt" src={source} />
  );
}

export function AnalysisCard({
  analysis,
  attempt,
  onLaunch,
  room,
  studentPerspective,
}: {
  analysis: AnalysisRecord | undefined;
  attempt: AiAttempt;
  onLaunch: (attemptId: string) => void;
  room: RoomLocation;
  studentPerspective: boolean;
}) {
  const [countdown, setCountdown] = useState(2);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (attempt.status !== "complete" || analysis?.result === null || cancelled)
      return;
    if (countdown <= 0) {
      onLaunch(attempt.id);
      return;
    }
    const timer = window.setTimeout(
      () => setCountdown((value) => value - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [
    analysis?.result,
    attempt.id,
    attempt.status,
    cancelled,
    countdown,
    onLaunch,
  ]);

  const result = analysis?.result;
  const bridgeInputs =
    result !== null &&
    result !== undefined &&
    "deployedLengthMeters" in result.scenarioInputs
      ? result.scenarioInputs
      : null;
  const isBridgeResult = bridgeInputs !== null;
  return (
    <article
      className="analysis-card"
      aria-labelledby={`analysis-${attempt.id}`}
    >
      <div className="analysis-card__heading">
        <div>
          <p className="feed-card__label">Handwriting review</p>
          <h2 id={`analysis-${attempt.id}`}>{STATUS_LABELS[attempt.status]}</h2>
        </div>
        {!studentPerspective && (
          <span
            className={`analysis-status analysis-status--${attempt.status}`}
          >
            {attempt.status}
          </span>
        )}
      </div>
      {attempt.media !== null && (
        <div className="attempt-media">
          <AttemptImage attempt={attempt} room={room} />
        </div>
      )}
      {!analysis && (
        <p className="analysis-progress" role="status" aria-live="polite">
          {STATUS_LABELS[attempt.status]}
        </p>
      )}
      {analysis?.failureCategory != null && (
        <div className="analysis-fallback" role="status">
          <strong>I couldn&apos;t read the handwriting this time.</strong>
          <p>
            Your drawing is saved. Enter the measurement from your work below.
          </p>
        </div>
      )}
      {result !== null && result !== undefined && (
        <div className="analysis-result">
          {studentPerspective && isBridgeResult ? (
            <>
              <section>
                <h3>What I read from your work</h3>
                <p className="analysis-transcription">{result.transcription}</p>
              </section>
              <section
                className="analysis-values"
                aria-label="Your measurements"
              >
                <div>
                  <span>Fraction as decimal</span>
                  <strong>
                    {bridgeInputs?.fractionAsDecimal ?? "not written"}
                  </strong>
                </div>
                <div>
                  <span>Bridge length</span>
                  <strong>
                    {bridgeInputs?.deployedLengthMeters ?? "not written"} m
                  </strong>
                </div>
              </section>
            </>
          ) : (
            <>
              <section>
                <h3>What the AI read</h3>
                <p className="analysis-transcription">{result.transcription}</p>
                <ol>
                  {result.steps.map((step, index) => (
                    <li
                      className={`analysis-step analysis-step--${step.status}`}
                      key={`${index}-${step.text}`}
                    >
                      {step.text}
                    </li>
                  ))}
                </ol>
              </section>
              {"deployedLengthMeters" in result.scenarioInputs ? (
                <section
                  className="analysis-values"
                  aria-label="Extracted simulation values"
                >
                  <div>
                    <span>Fraction as decimal</span>
                    <strong>
                      {result.scenarioInputs.fractionAsDecimal ?? "unclear"}
                    </strong>
                  </div>
                  <div>
                    <span>Bridge length</span>
                    <strong>
                      {result.scenarioInputs.deployedLengthMeters ?? "unclear"}{" "}
                      m
                    </strong>
                  </div>
                </section>
              ) : "distanceMeters" in result.scenarioInputs ? (
                <section
                  className="analysis-values"
                  aria-label="Extracted simulation values"
                >
                  <div>
                    <span>Speed</span>
                    <strong>
                      {result.scenarioInputs.speedMetersPerSecond ?? "unclear"}{" "}
                      m/s
                    </strong>
                  </div>
                  <div>
                    <span>Time</span>
                    <strong>
                      {result.scenarioInputs.timeSeconds ?? "unclear"} s
                    </strong>
                  </div>
                  <div>
                    <span>Travel distance</span>
                    <strong>
                      {result.scenarioInputs.distanceMeters ?? "unclear"} m
                    </strong>
                  </div>
                </section>
              ) : "totalLoadKg" in result.scenarioInputs ? (
                <section
                  className="analysis-values"
                  aria-label="Extracted simulation values"
                >
                  <div>
                    <span>Item count</span>
                    <strong>
                      {result.scenarioInputs.itemCount ?? "unclear"}
                    </strong>
                  </div>
                  <div>
                    <span>Load per item</span>
                    <strong>
                      {result.scenarioInputs.unitLoadKg ?? "unclear"} kg
                    </strong>
                  </div>
                  <div>
                    <span>Total load</span>
                    <strong>
                      {result.scenarioInputs.totalLoadKg ?? "unclear"} kg
                    </strong>
                  </div>
                </section>
              ) : (
                <section
                  className="analysis-values"
                  aria-label="Extracted simulation values"
                >
                  <div>
                    <span>Flow rate</span>
                    <strong>
                      {result.scenarioInputs.flowRateLitersPerMinute ??
                        "unclear"}{" "}
                      L/min
                    </strong>
                  </div>
                  <div>
                    <span>Time</span>
                    <strong>
                      {result.scenarioInputs.timeMinutes ?? "unclear"} min
                    </strong>
                  </div>
                  <div>
                    <span>Water volume</span>
                    <strong>
                      {result.scenarioInputs.volumeLiters ?? "unclear"} L
                    </strong>
                  </div>
                </section>
              )}
              {!studentPerspective &&
              isBridgeResult &&
              result.verdict !== "correct" ? (
                <section className="analysis-error-note">
                  <h3>Likely misconception</h3>
                  <p>
                    The learner treated the numerator and denominator as decimal
                    digits.
                  </p>
                </section>
              ) : result.firstError !== null ? (
                <section className="analysis-error-note">
                  <h3>Likely first error</h3>
                  <p>{result.firstError.summary}</p>
                </section>
              ) : null}
              {(!isBridgeResult || result.verdict === "correct") && (
                <p className="analysis-explanation">
                  {result.studentFacingExplanation}
                </p>
              )}
            </>
          )}
          <div className="launch-countdown" role="status" aria-live="polite">
            {cancelled ? (
              <>
                <span>Automatic launch paused.</span>
                <button
                  className="primary-button"
                  onClick={() => onLaunch(attempt.id)}
                  type="button"
                >
                  Launch{" "}
                  {attempt.taskId === "water-task-v1"
                    ? "water"
                    : attempt.taskId === "speed-task-v1"
                      ? "shuttle"
                      : attempt.taskId === "structure-task-v1"
                        ? "platform"
                        : "bridge"}
                </button>
              </>
            ) : (
              <>
                <span>
                  {countdown > 0
                    ? `Starting the bridge test in ${countdown}…`
                    : "Starting the bridge test…"}
                </span>
                <button
                  className="secondary-button"
                  onClick={() => setCancelled(true)}
                  type="button"
                >
                  Cancel launch
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
