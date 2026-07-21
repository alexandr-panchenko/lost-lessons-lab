import { useEffect, useState } from "react";

type HealthState = "checking" | "healthy" | "unavailable";

export function App() {
  const [health, setHealth] = useState<HealthState>("checking");

  useEffect(() => {
    const controller = new AbortController();

    void fetch("/api/health", { signal: controller.signal })
      .then((response) => {
        setHealth(response.ok ? "healthy" : "unavailable");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setHealth("unavailable");
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <main className="shell">
      <section className="shell__card" aria-labelledby="page-title">
        <p className="shell__eyebrow">Build Week foundation</p>
        <h1 id="page-title">Lost Lessons Lab</h1>
        <p className="shell__lede">
          A learner&apos;s handwritten math will become the controller for a
          playful, deterministic physics scene inside a shared tutoring room.
        </p>
        <div className="shell__status" role="status" aria-live="polite">
          <span
            className={`status-dot status-dot--${health}`}
            aria-hidden="true"
          />
          {health === "checking" && "Checking the Worker runtime…"}
          {health === "healthy" && "Cloudflare Worker runtime is healthy."}
          {health === "unavailable" && "Worker health check is unavailable."}
        </div>
        <p className="shell__note">
          The guided room, handwriting analysis, and bridge simulation are not
          part of this environment milestone yet.
        </p>
      </section>
    </main>
  );
}
