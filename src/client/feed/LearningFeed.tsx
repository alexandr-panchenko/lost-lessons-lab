import { Fragment, useState, type FormEvent } from "react";

import type { RoomFeedEvent } from "../../shared/protocol";

type LearningFeedProps = {
  events: RoomFeedEvent[];
  studentPerspective: boolean;
};

export function LearningFeed({
  events,
  studentPerspective,
}: LearningFeedProps) {
  const [practiceRequest, setPracticeRequest] = useState("Fractions");
  const [setupStatus, setSetupStatus] = useState("");

  function submitSetup(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSetupStatus(
      `${practiceRequest || "Fractions"} selected. The bridge task is ready below.`,
    );
  }

  return (
    <>
      {events
        .filter((event) => !studentPerspective || event.visibility === "all")
        .map((event) => {
          if (event.type === "room.welcome") {
            return (
              <article className="feed-card feed-card--welcome" key={event.seq}>
                <p className="feed-card__label">Shared learning room</p>
                <h2>{event.payload.title}</h2>
                <p>{event.payload.message}</p>
              </article>
            );
          }

          if (event.type === "teacher.setup") {
            return (
              <article className="feed-card feed-card--teacher" key={event.seq}>
                <p className="feed-card__label">Teacher setup · private</p>
                <h2>{event.payload.prompt}</h2>
                <div className="skill-list" aria-label="Supported skills">
                  {event.payload.supportedSkills.map((skill) => (
                    <Fragment key={skill}>
                      {skill === "Water and volume" ||
                      skill === "Speed and collision" ||
                      skill === "Structure and load" ? (
                        <a
                          className="skill-chip"
                          href={
                            skill === "Water and volume"
                              ? "/water"
                              : skill === "Speed and collision"
                                ? "/speed"
                                : "/structure"
                          }
                        >
                          {skill}
                        </a>
                      ) : (
                        <button
                          className="skill-chip"
                          onClick={() => setPracticeRequest(skill)}
                          type="button"
                        >
                          {skill}
                        </button>
                      )}
                    </Fragment>
                  ))}
                </div>
                <form className="teacher-form" onSubmit={submitSetup}>
                  <label htmlFor="practice-request">
                    Describe the specific gap
                  </label>
                  <textarea
                    id="practice-request"
                    onChange={(event) => setPracticeRequest(event.target.value)}
                    value={practiceRequest}
                  />
                  <button className="primary-button" type="submit">
                    Use the bridge sample
                  </button>
                </form>
                <p aria-live="polite" className="inline-status">
                  {setupStatus}
                </p>
              </article>
            );
          }

          return (
            <article className="feed-card feed-card--task" key={event.seq}>
              <div className="feed-card__heading-row">
                <div>
                  <p className="feed-card__label">
                    {event.payload.fixtureLabel}
                  </p>
                  <h2>{event.payload.taskTitle}</h2>
                </div>
                <span className="skill-badge">{event.payload.skillLabel}</span>
              </div>
              <blockquote>{event.payload.prompt}</blockquote>
              <p className="task-readiness">
                The task is shared with the learner. Their handwriting workspace
                appears in the next room block.
              </p>
            </article>
          );
        })}
    </>
  );
}
