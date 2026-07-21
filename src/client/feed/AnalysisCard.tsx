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
  preparing: "Preparing the verified bridge inputs…",
  reading: "Reading the handwriting…",
  uploading: "Saving the student-only image…",
  validating: "Checking values with deterministic math…",
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
}: {
  analysis: AnalysisRecord | undefined;
  attempt: AiAttempt;
  onLaunch: (attemptId: string) => void;
  room: RoomLocation;
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
  return (
    <article
      className="analysis-card"
      aria-labelledby={`analysis-${attempt.id}`}
    >
      <div className="analysis-card__heading">
        <div>
          <p className="feed-card__label">
            AI interpretation · review before launch
          </p>
          <h2 id={`analysis-${attempt.id}`}>{STATUS_LABELS[attempt.status]}</h2>
        </div>
        <span className={`analysis-status analysis-status--${attempt.status}`}>
          {attempt.status}
        </span>
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
          <strong>Use the manual bridge controls below.</strong>
          <p>
            The handwriting could not be interpreted safely (
            {analysis.failureCategory.replaceAll("_", " ")}). Your drawing is
            still saved, and no result was guessed.
          </p>
        </div>
      )}
      {result !== null && result !== undefined && (
        <div className="analysis-result">
          <p className="analysis-model">
            Read by {analysis?.modelId ?? "the configured model"}
            {analysis?.usedRepair
              ? " · one bounded repair/retry used"
              : " · first structured response accepted"}
          </p>
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
                {result.scenarioInputs.deployedLengthMeters ?? "unclear"} m
              </strong>
            </div>
          </section>
          {result.firstError !== null && (
            <section className="analysis-error-note">
              <h3>Likely first error</h3>
              <p>{result.firstError.summary}</p>
            </section>
          )}
          <p className="analysis-explanation">
            {result.studentFacingExplanation}
          </p>
          {analysis?.disagreement && (
            <p className="analysis-disagreement" role="status">
              The simulation used the extracted values above. The AI explanation
              is uncertain because deterministic math disagreed with its
              verdict.
            </p>
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
                  Launch bridge
                </button>
              </>
            ) : (
              <>
                <span>
                  {countdown > 0
                    ? `Launching verified values in ${countdown}…`
                    : "Launching verified values…"}
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
