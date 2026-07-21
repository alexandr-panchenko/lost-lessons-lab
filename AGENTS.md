# AGENTS.md

This repository is the implementation workspace for **Lost Lessons Lab**, the OpenAI Build Week 2026 Education project.

## Mission

Build a no-login web application where a tutor identifies a learner's specific math gap, the learner solves a real problem in free-form handwriting, GPT-5.6 interprets the work, deterministic code validates the simulation inputs, and a playful 2D physics scene shows the consequence. The learner can correct the work and retry inside a persistent shared teacher–student room.

**The math is the controller. The simulation is evidence, not decoration.**

## Source of truth

Read these files completely before changing code:

1. `AGENTS.md`
2. `docs/00-COMPETITION-CONSTRAINTS.md`
3. `docs/01-PRODUCT-BRIEF.md`
4. `docs/02-UX-AND-DEMO-FLOW.md`
5. `docs/03-DECISION-LOG.md`
6. `docs/04-TECHNICAL-DESIGN.md`
7. `docs/05-IMPLEMENTATION-PLAN.md`
8. `docs/06-TEST-PLAN.md`
9. `docs/07-SECURITY-COST-AND-DEPLOYMENT.md`
10. `docs/08-SUBMISSION-EVIDENCE.md`
11. `STATUS.md`

`docs/03-DECISION-LOG.md` resolves ambiguity. Do not reopen settled product decisions unless implementation is impossible or unsafe.

## Frozen product boundary

### Required core

- React web application deployed to Cloudflare Workers.
- `/` immediately creates a guided teacher room; no marketing gate and no empty chat.
- `/judge` creates a new isolated real room from a versioned fixture.
- Separate teacher and student capability links; no registration.
- One continuous responsive learning feed, not a dashboard with permanent panels.
- Shared realtime operation-log canvas through a room Durable Object.
- Teacher annotations and student solution strokes are separate layers.
- A submitted attempt is immutable and identified by a student-layer operation cutoff.
- One AI analysis at a time per room; student submission and correction wait for completion.
- Visible GPT-5.6 handwriting interpretation through the Responses API and strict Structured Outputs.
- Template-specific deterministic validation before simulation.
- Real parameterized PixiJS + Planck 2D physics, not a prerecorded video switch.
- Wrong attempt, explanation, correction, successful retry, achievements, replay, reload persistence.
- Template-specific manual fallback when AI analysis fails.
- Apache-2.0 repository license.

### Frozen hero scenario

Fractions and the bridge:

> Engineers have a 12-meter bridge kit. To cross the ravine, they must deploy three quarters of the kit. How many meters of bridge should they deploy?

Prepared wrong work:

```text
3/4 = 0.34
12 × 0.34 = 4.08 m
```

Correct work:

```text
3/4 = 0.75
12 × 0.75 = 9 m
```

### Optional supporting slices, in priority order

1. Water and volume.
2. Speed, time, and collision.
3. Structure, load, and destruction.

Each supporting family must be complete, tested, deployed, and hidden until ready. Cut in reverse order: structure, then speed, then water. Never weaken the hero flow to preserve breadth.

### Explicitly out of scope

- Accounts, registration, recovery, link revocation, or link rotation.
- Classroom rosters or parallel multi-learner management.
- Mastery scoring or automated claims that a learner has mastered a topic.
- LMS integrations, payments, marketplace, public leaderboards.
- 3D, scientific fluid simulation, soft bodies, generated fracture geometry.
- Generated executable simulation code.
- CRDTs, D1, KV, separate backend deployment, or a user-facing simulation editor.
- Full voice pipeline, mandatory photo upload, formula editor, live AI analysis on every stroke.
- Application-level data migrations. If storage becomes incompatible during the demo build, provision a fresh room namespace and discard old demo rooms.

## Target repository layout

Codex may refine filenames, but preserve boundaries:

```text
src/
  client/
    app/
    components/
    features/
      room/
      canvas/
      analysis/
      simulation/
    styles/
  worker/
    index.ts
    api/
    auth/
    ai/
    durable/
    media/
  shared/
    contracts/
    domain/
    validation/
  simulations/
    core/
    bridge/
    water/
    speed/
    structure/
tests/
  unit/
  integration/
  e2e/
  fixtures/
public/
docs/
```

Dependency direction:

```text
client -> shared contracts
worker -> shared contracts/domain
simulations -> shared domain
shared -> no client or worker imports
```

## Canonical commands

Milestone 1 must create these scripts. After that, use them exactly:

```bash
bun install --frozen-lockfile
bun run dev
bun run format
bun run format:check
bun run lint
bun run typecheck
bun run test:unit
bun run test:integration
bun run test:e2e
bun run test:live-ai
bun run build
bun run validate
bun run deploy
bun run smoke:prod
```

`bun run validate` must run, at minimum:

```text
format:check -> lint -> typecheck -> unit -> integration -> build -> mocked E2E
```

Never replace a failing required check with a weaker command. Fix the cause.

## Engineering conventions

- TypeScript strict mode. Avoid `any`; validate `unknown` at boundaries.
- Use discriminated unions for room events, WebSocket messages, attempts, analysis states, and simulation outcomes.
- Use Zod schemas for HTTP input, WebSocket payloads, environment variables, and OpenAI Structured Outputs.
- Keep deterministic math and template validation in pure functions.
- The physical outcome visualizes a result already classified by deterministic code. Physics never decides whether the learner is correct.
- Use fixed-step physics. Fast bodies must use continuous-collision behavior where appropriate.
- No hidden global state. The room Durable Object is authoritative for room-local state.
- Persist before server broadcast. Client-owned drawing may render optimistically.
- Deduplicate mutations with `clientOperationId` or `idempotencyKey`.
- Store visible binary media in private R2. Store structured room state in the room Durable Object.
- Do not log raw handwriting images, capabilities, personal text, or secrets.
- Do not expose OpenAI or Cloudflare credentials to the browser.
- Use native semantic HTML controls around canvas and simulation surfaces.
- Provide text equivalents for recognized work and simulation outcomes.
- Respect reduced motion and provide a mute control.
- Prefer original vector/primitive art generated in code. Do not add unlicensed assets.

## Room and attempt invariants

- A room has exactly one teacher capability and one student capability, generated once.
- Teacher capability may render a student preview in the same tab.
- Student capability never exposes private teacher-agent setup.
- Only one AI analysis may be active in a room.
- Student submission controls are disabled while analysis is active.
- A submitted attempt references a fixed student-layer canvas cutoff.
- Teacher annotations are never rasterized into a student attempt.
- Replay uses saved template/version/inputs/optional seed and does not call GPT again.
- Exact fragment or particle positions may differ between replays; the semantic outcome must remain the same.
- `/judge` creates a new room every time and redirects to the normal room route.

## AI boundary

GPT-5.6 is responsible for:

- reading free-form handwritten math;
- transcribing visible steps;
- interpreting alternative solution styles;
- extracting template inputs;
- identifying a likely first error;
- producing a short learner-facing explanation;
- mapping a teacher request to a supported skill/template.

Deterministic code is responsible for:

- arithmetic truth;
- units and ranges;
- supported template contracts;
- correctness classification;
- simulation parameters;
- achievements;
- authorization and persistence.

Every model output that affects state must pass strict schema validation and template-specific semantic validation. Permit at most one bounded repair/retry. Then use the visible manual fallback.

## No-secret rules

Never commit:

- `.env`, `.dev.vars`, API keys, tokens, capability values, or production URLs containing capabilities;
- screenshots containing secrets or private student data;
- raw OpenAI request/response bodies containing learner work;
- Cloudflare API tokens or other credentials.

Before every release, run a tracked-file and history secret scan and inspect the browser bundle.

## Milestone workflow

Follow `docs/05-IMPLEMENTATION-PLAN.md` in order.

For every milestone:

1. Set its row in `STATUS.md` to `in progress`.
2. Implement only that milestone's scope.
3. Add or update tests.
4. Run the milestone validation commands.
5. Fix every required failure before continuing.
6. Review the diff for scope creep, secrets, accessibility, and stale docs.
7. Update `STATUS.md` and evidence targets.
8. Commit with the specified message.
9. Record concrete evidence in `docs/08-SUBMISSION-EVIDENCE.md`.
10. Deploy when required and run the production smoke path.

Do not move to the next milestone when a required validation is red.

## Mock and fixture policy

Mocks are allowed in automated tests. The judge fixture may preload task text and sample handwriting. A prepared fallback may exist for API failure.

Mocks or fixtures must never be presented as a fresh successful AI call without an explicit label. The production hero path must include a real GPT-5.6 call when AI is enabled.

## Definition of done

The project is not done until all frozen-core criteria in `docs/01-PRODUCT-BRIEF.md` and the release gate in `docs/06-TEST-PLAN.md` pass, including:

- production URL works without login;
- `/judge` creates an isolated room;
- GPT-5.6 interprets handwriting visibly;
- wrong and correct bridge runs are real physics scenes;
- correction and replay work;
- teacher/student realtime canvas works;
- teacher strokes are excluded from analysis;
- reload restores the visible feed;
- AI failure reaches a usable manual fallback;
- `JUDGING.md` works literally in a clean browser;
- validation is green;
- evidence contains only verified claims.

Update `STATUS.md` after every meaningful implementation or validation change.
