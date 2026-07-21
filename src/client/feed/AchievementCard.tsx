import type { AchievementAward } from "../../shared/achievement-types";

export function AchievementCard({ award }: { award: AchievementAward }) {
  return (
    <article
      className={`achievement-card achievement-card--${award.category}`}
      aria-labelledby={`achievement-${award.id}`}
    >
      <div className="achievement-card__icon" aria-hidden="true">
        {award.category === "progress" ? "★" : "✦"}
      </div>
      <div>
        <p className="feed-card__label">
          {award.category === "progress"
            ? "Progress achievement"
            : "Disaster discovery"}
        </p>
        <h2 id={`achievement-${award.id}`}>{award.title}</h2>
        <p>{award.description}</p>
      </div>
    </article>
  );
}
