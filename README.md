# Lost Lessons Lab

**Lost Lessons Lab turns a learner's free-form handwritten math solution into a playful physical consequence inside a shared teacher–student room, making mistakes visible, memorable, and worth correcting.**

## Live demo

- Production: **<https://lost-lessons-lab.sanocks.workers.dev>**.
- Direct judge route: **<https://lost-lessons-lab.sanocks.workers.dev/judge>**.
- No login, payment, or user-provided API key is permitted on the judge path.

Implementation status is tracked in [`STATUS.md`](STATUS.md).

## 60–90 second judge path

1. Open `/judge`; it creates a fresh real room and redirects to its unique address.
2. Switch to **Student view** and submit the prepared handwritten fraction mistake.
3. Watch GPT-5.6 show how it read the work and extract `4.08 m`.
4. Let the bridge simulation run: the bridge is too short and the vehicle falls safely into a comic rescue area.
5. Correct `3/4 = 0.34` to `3/4 = 0.75`, submit again, and watch the successful crossing.
6. Replay either run or reload the page to verify that the room feed persists.

Expected visible result:

- the wrong value changes the bridge length rather than selecting a prerecorded video;
- the recognition card identifies the likely conversion error;
- the corrected value produces a safe crossing and a progress achievement;
- a teacher can annotate the learner's canvas in realtime without those marks entering the learner's submitted answer.

See [`JUDGING.md`](JUDGING.md) for the final concise instructions.

## Video

Public YouTube demo: **not recorded yet**. Add the verified URL only after the production path is stable.

## Product

Tutors often recognize a specific gap—fractions, percentages, volume, proportions, or speed—but creating a personalized visual explanation takes time. Typical practice products reduce a mistake to a red mark. Lost Lessons Lab instead treats the learner's math as the controller for a simulated world.

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

Supporting simulation families, only if completed and tested:

1. water and volume;
2. speed, time, and collision;
3. structure, load, and destruction.

See [`docs/01-PRODUCT-BRIEF.md`](docs/01-PRODUCT-BRIEF.md) for the complete scope and cut line.

## Local setup

Prerequisites for the current repository shell:

- Bun 1.2.5 or newer;
- Git.

Cloudflare and OpenAI credentials are not required for the M1 local shell or its automated validation. They become necessary only at the deployment and live-AI milestones described in the implementation plan.

From a clean clone:

```bash
bun install --frozen-lockfile
cp .env.example .dev.vars
bun run dev
```

Open <http://127.0.0.1:5173>. It immediately creates a guided teacher room. Use the separate student capability link or the one-tab preview to inspect learner visibility.

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

`bun run validate` runs formatting, lint, strict types, unit tests, the Cloudflare Worker/Durable Object integration suite, a production build, and mocked Playwright E2E. The production smoke command requires `PRODUCTION_URL` once M2 deploys the application.

A separate opt-in live model evaluation is reserved for M4 and later:

```bash
bun run test:live-ai
```

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
  ├─ private R2 media access
  └─ one SQLite-backed Durable Object per room
```

Room data lives with the room Durable Object. Visible binary media lives in private R2. The canvas is an ordered operation log; a submission records the last included student operation. Teacher marks are a different layer and are never sent as learner work.

See [`docs/04-TECHNICAL-DESIGN.md`](docs/04-TECHNICAL-DESIGN.md).

## GPT-5.6 usage (M4 target)

The production AI path will use the OpenAI Responses API with `gpt-5.6`, image input, `store: false`, and strict Structured Outputs. M1 contains no AI call or simulated AI response.

GPT-5.6 performs genuinely multimodal work:

- reads free-form handwriting;
- transcribes multiple solution steps;
- extracts scenario-specific values and units;
- identifies a likely first mathematical error;
- explains the mismatch in learner-facing language;
- maps a tutor's natural-language description to a supported skill/template.

GPT does not decide arithmetic truth or execute simulation code. Pure TypeScript validators compute the expected answer, validate units and ranges, and classify the simulation outcome.

## Codex collaboration

The repository is intentionally prepared for one primary Codex implementation session. The human completed the product framing, educational boundary, UX, scope freeze, deterministic/AI boundary, Cloudflare architecture, physics choice, test strategy, and cut order before coding.

Codex must implement milestone by milestone using [`CODEX-KICKOFF.md`](CODEX-KICKOFF.md), update [`STATUS.md`](STATUS.md), run the specified gates, and record exact evidence.

Before submission, update this section with:

- primary Codex Session ID from `/feedback`;
- representative commits and milestones implemented by Codex;
- important human corrections or decisions made during implementation;
- any additional Codex sessions used and why.

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
