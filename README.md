# Lost Lessons Lab

**Lost Lessons Lab turns a learner's free-form handwritten math solution into a playful physical consequence inside a shared teacher–student room, making mistakes visible, memorable, and worth correcting.**

## Live demo

- Production: **<https://lost-lessons-lab.sanocks.workers.dev>**.
- Direct judge route: **<https://lost-lessons-lab.sanocks.workers.dev/judge>**.
- No login, payment, or user-provided API key is permitted on the judge path.

Implementation status is tracked in [`STATUS.md`](STATUS.md).

## 60–90 second judge path

1. Open `/judge`; it creates a fresh real room and redirects to its unique address.
2. The same tab opens directly in **Student lesson** with an empty handwriting canvas. Choose **Load sample mistake**, then **Run my solution**.
3. Watch GPT-5.6 show how it read the work and extract `4.08 m`.
4. Let the suspension bridge fail in stages: its cable snaps, the deck folds, the vehicle strikes the maintenance boat, and emergency pontoons return the driver safely to the moving river surface.
5. Choose **Try again**, then use the secondary **Load correct sample** helper or write a correction yourself. Submit it and watch the stable crossing and repair payoff.
6. Replay either run or reload the page to verify that the room feed persists.

Expected visible result:

- the wrong value changes the bridge length rather than selecting a prerecorded video;
- the recognition card identifies the likely conversion error;
- the corrected value produces a safe crossing and a progress achievement;
- a teacher can annotate the learner's canvas in realtime without those marks entering the learner's submitted answer.

The complete bridge slice starts `/judge` with an empty student-layer handwriting canvas, interprets both the wrong and corrected work through server-only GPT-5.6, and turns strictly validated values into persisted physics runs. Separate disaster and progress awards, replay, reload, and teacher-only reset complete the loop. Student-only PNGs remain private, failures return to an explicitly labeled manual form, the browser never receives an OpenAI key, and the model verdict never decides arithmetic truth.

See [`JUDGING.md`](JUDGING.md) for the final concise instructions.

## Product

Tutors often recognize a specific fraction gap, but creating a personalized visual explanation takes time. Typical practice products reduce a mistake to a red mark. Lost Lessons Lab instead treats the learner's math as the controller for a simulated world.

The core loop is:

```text
teacher identifies a gap
→ system selects a supported simulation template
→ learner solves freely on a shared canvas
→ GPT-5.6 interprets the work
→ deterministic code validates simulation inputs
→ 2D physics shows the consequence
→ learner corrects and retries
```

The product is organized by **skills and knowledge gaps**, not by age or school grade.

## Accessibility and original media

The room begins with a visible next-action cue and a keyboard skip link. Every
non-drawing action uses a native control with a visible focus ring; the canvas
has a text name and instructions, while recognized work, verified inputs, and
simulation outcomes remain available outside canvas pixels. Status changes use
polite live regions. Reduced-motion mode advances directly to the same semantic
result and lowers decorative rendering detail.

Simulation sound is muted by default. Turning it on is an explicit user action
that enables short tones synthesized locally with the Web Audio API; no sound
file is downloaded and no audio autoplays. Visuals are original CSS and PixiJS
primitives. The application includes no third-party image, font, music, or sound
asset.

## Frozen Build Week scope

Required:

- persistent no-login teacher–student rooms;
- one continuous responsive learning feed;
- realtime shared handwriting canvas with separate teacher/student layers;
- GPT-5.6 vision analysis with strict Structured Outputs;
- deterministic arithmetic and template validation;
- real PixiJS + Planck bridge simulation;
- wrong attempt, explanation, correction, successful retry, achievements, replay;
- manual parameter fallback when AI analysis fails;
- isolated `/judge` room per visit.

Supporting simulation code remains in the repository but is hidden from the
public rescue build pending visual approval:

1. water and volume;
2. speed, time, and collision;
3. structure, load, and destruction.

See [`docs/01-PRODUCT-BRIEF.md`](docs/01-PRODUCT-BRIEF.md) for the complete scope and cut line.

## Local setup

Prerequisites for the current repository shell:

- Bun 1.2.5 or newer;
- Git.

Cloudflare and OpenAI credentials are not required for mocked automated validation. They are required for deployment and the opt-in live-AI suite described in the implementation plan.

From a clean clone:

```bash
bun install --frozen-lockfile
cp .env.example .dev.vars
bun run dev
```

Open <http://127.0.0.1:5173>. The root creates a guided teacher room; `/judge` creates a fresh room and opens its real student lesson in the same tab. The compact role control returns to teacher setup, where the separate collaboration link remains available.

When later milestones are active, set these local-only values in `.dev.vars`:

```text
OPENAI_API_KEY=...
ROOM_TOKEN_PEPPER=...
```

Never commit `.dev.vars`.

## Tests

Canonical commands:

```bash
bun run format
bun run format:check
bun run lint
bun run typecheck
bun run test:unit
bun run test:integration
bun run test:e2e
bun run build
bun run validate
bun run deploy
bun run smoke:prod
```

`bun run validate` runs formatting, lint, strict types, unit tests, the Cloudflare Worker/Durable Object integration suite, a production build, a tracked/history/build secret audit, and mocked Playwright E2E. The production smoke command defaults to the judged URL; set `PRODUCTION_URL` only to verify another deployment.

A separate opt-in live model evaluation is reserved for M4 and later:

```bash
bun run test:live-ai
```

Set `AI_ENABLED=false` to exercise the server-side kill switch. The room,
handwriting, deterministic validators, and template-specific manual simulation
paths remain available. After deployment, the bounded production recovery drill
is available as:

```bash
PRODUCTION_URL=https://your-worker.example bun run smoke:fallback:prod
PRODUCTION_URL=https://your-worker.example bun run smoke:accessibility:prod
```

The drill injects one client-visible AI-disabled response without changing the
Worker configuration, verifies wrong and correct manual bridge outcomes, reload,
and Reset, and makes no OpenAI request.

See [`docs/06-TEST-PLAN.md`](docs/06-TEST-PLAN.md).

## Target architecture

```text
React learning feed
  ├─ native shared handwriting canvas
  ├─ recognition and explanation cards
  └─ PixiJS renderer + Planck physics
          │
          │ HTTPS + hibernating WebSocket
          ▼
Cloudflare Worker + Hono
  ├─ static SPA assets and API
  ├─ server-side OpenAI Responses calls
  ├─ durable per-attempt analysis Workflow
  ├─ private R2 media access
  └─ one SQLite-backed Durable Object per room
```

Room data lives with the room Durable Object. Visible binary media lives in private R2. The canvas is an ordered operation log; a submission records the last included student operation. Teacher marks are a different layer and are never sent as learner work.

See [`docs/04-TECHNICAL-DESIGN.md`](docs/04-TECHNICAL-DESIGN.md).

## GPT-5.6 usage

The production AI path uses the OpenAI Responses API with `gpt-5.6`, high-detail PNG input, `store: false`, low reasoning effort, and strict Structured Outputs. It permits at most one bounded repair or retry. Each attempt and its private-R2 image are persisted before an idempotent Cloudflare Workflow performs analysis, so a browser disconnect does not cancel the work.

GPT-5.6 performs genuinely multimodal work:

- reads free-form handwriting;
- transcribes multiple solution steps;
- extracts scenario-specific values and units;
- identifies a likely first mathematical error;
- explains the mismatch in learner-facing language;
- maps a tutor's natural-language description to a supported skill/template.

GPT does not decide arithmetic truth or execute simulation code. Pure TypeScript validators compute the expected answer, validate units and ranges, and classify the simulation outcome.

## Codex collaboration

One primary Codex implementation session executed the frozen plan from
[`CODEX-KICKOFF.md`](CODEX-KICKOFF.md). The session built the reproducible
Cloudflare shell (`7c5b502`), persistent capability rooms (`0c39b42`), realtime
layered canvas and bridge physics (`b76eede`), GPT-5.6 interpretation
(`969f99d`), complete hero (`80d93aa`), archived unapproved scenario experiments
that remain excluded from the public product, reliability controls (`3c9afce`),
accessibility polish (`b990abe`), and the release audit (`eef7c03`).

At every milestone Codex updated [`STATUS.md`](STATUS.md), added automated tests,
ran the prescribed local and production gates, fixed failures, deployed only
after green CI, and recorded concrete evidence in
[`docs/08-SUBMISSION-EVIDENCE.md`](docs/08-SUBMISSION-EVIDENCE.md). The private
representative `/feedback` Session ID belongs in the Devpost field, not this
public repository. No additional implementation session or delegated agent was
used.

The human supplied and retained ownership of the educational boundary, product
scope, UX, deterministic/AI split, architecture, simulation priorities, test
strategy, and cut order. Codex made implementation choices within those frozen
decisions and surfaced release blockers instead of inventing missing evidence.

## Key human decisions

- Target skill gaps rather than age or grade.
- Make real math precede the spectacle; effects never replace the problem.
- Let learners use free-form handwriting rather than a prescribed answer format.
- Use GPT for interpretation and explanation, deterministic code for truth and simulation contracts.
- Use a no-registration persistent room shared by tutor and learner.
- Make the entire experience one scrollable instructional feed.
- Treat funny wrong answers as valid exploration while reserving progress achievements for successful outcomes.
- Use original flat 2D visuals and approximate game physics, not 3D or scientific simulation.
- Ship one fully tested scenario at a time and remove unfinished families entirely.

## Documentation

- [Competition constraints](docs/00-COMPETITION-CONSTRAINTS.md)
- [Product brief](docs/01-PRODUCT-BRIEF.md)
- [UX and demo flow](docs/02-UX-AND-DEMO-FLOW.md)
- [Decision log](docs/03-DECISION-LOG.md)
- [Technical design](docs/04-TECHNICAL-DESIGN.md)
- [Implementation plan](docs/05-IMPLEMENTATION-PLAN.md)
- [Test plan](docs/06-TEST-PLAN.md)
- [Security, cost, and deployment](docs/07-SECURITY-COST-AND-DEPLOYMENT.md)
- [Submission evidence matrix](docs/08-SUBMISSION-EVIDENCE.md)
- [Submission copy draft](docs/09-SUBMISSION-COPY-DRAFT.md)
- [Independent review prompts](docs/10-REVIEW-PROMPTS.md)
- [Human verification checklist](docs/11-HUMAN-VERIFICATION-CHECKLIST.md)
- [Final submission checklist](docs/12-SUBMISSION-CHECKLIST.md)
- [Codex readiness review](docs/13-CODEX-READINESS-REVIEW.md)
- [Codex kickoff](CODEX-KICKOFF.md)

## License

Apache License 2.0. See [`LICENSE`](LICENSE).

Third-party dependencies and assets must be recorded in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) before submission.
