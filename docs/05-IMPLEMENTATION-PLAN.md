# 05 — Implementation plan

This is the implementation runbook. It is not a feature wishlist.

## Execution rules

For every milestone:

1. Mark the milestone `in progress` in `STATUS.md`.
2. Read the relevant source-of-truth sections again.
3. Implement only the milestone scope.
4. Add or update tests.
5. Run every listed validation command.
6. Fix failures before continuing.
7. Review the diff for scope creep, secrets, accessibility regressions, stale docs, and unlicensed assets.
8. Update `STATUS.md` and `docs/08-SUBMISSION-EVIDENCE.md`.
9. Deploy when the milestone calls for it and verify the real URL.
10. Commit with the exact milestone message.
11. Record commit, URL, screenshots, logs, and test evidence.
12. Move to the next milestone only when acceptance criteria are green.

Never leave a partially exposed simulation family in production. A cut slice is removed from supported skill lists, routes, fixtures, and claims.

## Canonical command contract

Milestone 1 must define these scripts:

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

`bun run validate` must run at least:

```text
format:check
→ lint
→ typecheck
→ unit tests
→ Worker/Durable Object integration tests
→ production build
→ mocked Playwright E2E
```

Live AI evaluation and production smoke are release gates, not default per-commit calls.

---

# M1 — Repository and reproducible environment

## Objective

Create a clean TypeScript workspace that runs locally in Cloudflare's runtime, has canonical validation commands, contains no secrets, and can be cloned and reproduced by another agent.

## Files and components affected

```text
package.json
bun.lock
tsconfig*.json
vite.config.ts
wrangler.jsonc or wrangler.toml
eslint configuration
formatter configuration
playwright.config.ts
vitest configurations
src/client/*
src/worker/*
src/shared/*
tests/*
.github/workflows/ci.yml
.env.example
.gitignore
README.md
STATUS.md
THIRD_PARTY_NOTICES.md
```

## Implementation steps

1. Inspect current Git state and preserve all design documents.
2. Use the current official Cloudflare React/Vite setup as the starting point.
3. Configure TypeScript strict mode.
4. Add Hono only if it simplifies Worker route composition without hiding Cloudflare bindings.
5. Export `RoomDurableObject` from the Worker entry, but do not implement product behavior yet.
6. Add the one-time SQLite Durable Object class registration to Cloudflare config.
7. Add a private R2 binding named `MEDIA`.
8. Create typed environment parsing; no browser module may import secret bindings.
9. Add minimal React shell and Worker `/api/health`.
10. Add unit, integration, and E2E test harnesses.
11. Implement every canonical package script.
12. Add GitHub Actions CI without production deployment until credentials exist.
13. Run a license check of selected dependencies and update third-party notices.
14. Verify `.dev.vars`, `.env`, keys, and Cloudflare state directories are ignored.
15. Update README setup instructions from a clean clone perspective.

## Acceptance criteria

- `bun install --frozen-lockfile` succeeds after the lockfile exists.
- `bun run dev` serves a React page and Worker health endpoint in the Cloudflare runtime.
- TypeScript strict mode is active.
- No secret is present in tracked files or client output.
- Cloudflare config includes Worker, Static Assets, `ROOMS`, and `MEDIA` bindings.
- Tests can instantiate the Worker test environment.
- Playwright can load the local shell.
- `bun run validate` is green.
- README contains exact prerequisites and local commands.

## Commands to validate

```bash
bun install
bun run format
bun run lint
bun run typecheck
bun run test:unit
bun run test:integration
bun run build
bun run test:e2e
bun run validate
git status --short
git diff --check
```

Run a secret scan available in the environment, or at minimum:

```bash
git grep -nE '(sk-[A-Za-z0-9_-]{20,}|OPENAI_API_KEY=.+|CLOUDFLARE_API_TOKEN=.+)' -- . ':!*.md' || true
```

## Expected UI and behavior

A plain but accessible shell identifies Lost Lessons Lab as pre-implementation and reports a healthy Worker. No fake room, AI result, or simulation is shown.

## Failure handling

- If the current Cloudflare template conflicts with Bun, prefer official supported commands and document the exact workaround.
- If a dependency is not Cloudflare-compatible, remove it rather than adding a second runtime.
- If the test pool has a documented limitation, isolate the affected suite and document the command.

## Dependencies

- Git repository.
- Bun.
- Cloudflare account is not required for local validation but is required for deployment.
- No OpenAI key required.

## Commit message

```text
chore: establish reproducible Cloudflare application environment
```

## Fallback / cut option

Do not cut strict typing, tests, or canonical scripts. Hono may be removed if direct Worker routing is simpler. No product dependency should be added before it is used.

## Evidence to record

- Exact Bun and dependency versions.
- Green `bun run validate` output.
- Repository tree.
- Secret scan output.
- Initial commit SHA.
- Screenshot of the local shell.
- Updated dependency notice.

---

# M2 — Deployable guided room shell

## Objective

Deploy the earliest real vertical slice: opening `/` or `/judge` creates an isolated persistent room with teacher and learner links, a guided first feed block, and reload-safe state.

## Files and components affected

```text
src/worker/routes/rooms.ts
src/worker/routes/judge.ts
src/worker/room/RoomDurableObject.ts
src/worker/room/room-schema.ts
src/worker/security/capabilities.ts
src/shared/protocol.ts
src/client/room/*
src/client/feed/*
fixtures/judge-v1/*
tests/unit/capabilities*
tests/integration/rooms*
tests/e2e/room-shell*
.github/workflows/deploy.yml
README.md
JUDGING.md
STATUS.md
docs/08-SUBMISSION-EVIDENCE.md
```

## Implementation steps

1. Implement high-entropy teacher and learner capability generation.
2. Store only capability hashes in the room Durable Object.
3. Implement `/` room creation and redirect to teacher fragment URL.
4. Implement `/judge` creation from source-controlled `judge-v1`.
5. Implement room bootstrap authorization and role-filtered feed state.
6. Render the continuous feed shell with:
   - product explanation;
   - “What does your learner struggle with?”;
   - supported-skill chips;
   - recommended hero action;
   - free teacher prompt.
7. Generate and display the student invite link only in teacher view.
8. Add teacher/student preview switching in one tab.
9. Persist room metadata and feed events in Durable Object SQLite.
10. Implement reload reconstruction.
11. Implement WebSocket authentication, initial snapshot, and basic connection status.
12. Add semantic controls and accessible labels.
13. Add rate protection for room creation at a wide demo-safe limit.
14. Configure scoped Cloudflare and GitHub secrets.
15. Deploy to the first production URL.
16. Run incognito and clean-context smoke tests.
17. Put the real URL in README, JUDGING, and evidence.

## Acceptance criteria

- Opening `/` redirects to a unique teacher room in one action.
- Opening `/judge` twice creates two different room IDs.
- The room is never blank.
- The first action is understandable without documentation.
- Teacher and learner links show appropriate feed visibility.
- The teacher can preview learner view in one tab.
- Refresh reconstructs the same room.
- Invalid capability receives no room data.
- No registration, CAPTCHA, payment, or user API key appears.
- A production URL is live and uses the same code path as local tests.
- `bun run validate` and `bun run smoke:prod` are green.

## Commands to validate

```bash
bun run format:check
bun run lint
bun run typecheck
bun run test:unit
bun run test:integration
bun run build
bun run test:e2e
bun run validate
bun run deploy
bun run smoke:prod
```

Manual:

- open `/` in incognito;
- open student link in a second clean context;
- open `/judge` twice and compare room IDs;
- refresh both contexts;
- inspect network logs for capability leakage;
- inspect the client bundle for `OPENAI_API_KEY`.

## Expected UI and behavior

A polished-enough room shell, not a marketing page. The teacher sees a concise guided opening block and a clear path into the fraction sample. The learner link hides private setup. No canvas or simulation is claimed yet.

## Failure handling

- If Worker-level redirect with a fragment is awkward, return a tiny no-store boot page that creates the room and uses `location.replace`.
- If WebSocket is temporarily unavailable, bootstrap and reload persistence must still work over HTTP.
- If deployment credentials are missing, stop only at the external deployment step; complete all local work and clearly mark the blocker.

## Dependencies

- M1 green.
- Cloudflare account, Worker target, R2 bucket, and scoped deployment token.

## Commit message

```text
feat: deploy persistent guided teacher and student rooms
```

## Fallback / cut option

Do not cut room persistence, role filtering, or production deployment. Presence indicators and decorative onboarding animation can be omitted.

## Evidence to record

- Production URL.
- Two distinct `/judge` room URLs.
- Screenshots of teacher and learner views.
- Reload persistence Playwright trace.
- Unauthorized bootstrap test.
- Deployment commit SHA and Cloudflare version ID.

---

# M3 — Realtime canvas and deterministic bridge physics

## Objective

Complete the core experience without AI: shared layered handwriting, immutable attempts, template-specific manual input, deterministic bridge math, and real parameterized 2D physics.

## Files and components affected

```text
src/client/canvas/*
src/client/simulation/*
src/worker/room/websocket.ts
src/worker/domain/templates/bridge/*
src/worker/domain/attempts.ts
src/shared/protocol.ts
fixtures/judge-v1/bridge*
tests/unit/canvas*
tests/unit/bridge*
tests/integration/canvas-room*
tests/integration/attempts*
tests/e2e/bridge-manual*
README.md
STATUS.md
docs/08-SUBMISSION-EVIDENCE.md
```

## Implementation steps

1. Implement canvas Pointer Events and required tools:
   - pen;
   - highlighter;
   - whole-stroke eraser;
   - undo/redo;
   - clear.
2. Normalize and simplify points at pointer release.
3. Implement discriminated stroke operations and optimistic local rendering.
4. Add Durable Object validation, deduplication, global sequence, persistence, acknowledgement, and broadcast.
5. Implement reconnect using `lastSeenSeq` and idempotent resend.
6. Separate student and teacher layers in storage and rendering.
7. Add teacher annotations and visually distinct role labels.
8. Implement student-only raster function and tests that exclude teacher/system strokes.
9. Create immutable attempt capture at student `sourceCanvasSeq`.
10. Enforce one active analysis/attempt-processing lock even though this milestone uses manual input.
11. Implement bridge task parameters, correct-solution derivation, input validation, and outcome classes.
12. Implement the template-specific bridge length form.
13. Integrate PixiJS and Planck in an inline simulation block.
14. Use fixed-step physics and continuous collision handling for the vehicle.
15. Make wrong length alter actual bridge geometry.
16. Implement safe comic failure and correct crossing.
17. Add Pause/Resume, Replay, 2×, Skip to result, mute placeholder, reduced motion, and text transcript.
18. Persist simulation run inputs and replay without any AI call.
19. Run two-context collaboration E2E.
20. Deploy and verify production before proceeding.

## Acceptance criteria

- Student strokes appear in teacher context in realtime.
- Teacher strokes appear to the learner but never enter student raster or attempt input.
- Duplicate operations are not rendered twice.
- Reconnect restores and reconciles drawing.
- Submitted attempts remain unchanged after later drawing.
- Manual `4.08 m` creates a visibly short bridge and safe failure.
- Manual `9 m` creates a successful crossing.
- Correctness comes from domain logic, not collision outcome.
- Replay uses stored template data and does not call the server for AI.
- Exact debris may vary without changing the semantic result.
- Reload restores attempt and simulation blocks.
- Physics tests contain no NaN, tunneling, or unbounded body growth.
- Production is still green.

## Commands to validate

```bash
bun run format:check
bun run lint
bun run typecheck
bun run test:unit -- canvas bridge
bun run test:integration -- canvas attempts websocket
bun run build
bun run test:e2e -- bridge-manual realtime
bun run validate
bun run deploy
bun run smoke:prod
```

Also run a browser performance check on:

- desktop;
- tablet/touch viewport;
- a modest phone viewport.

## Expected UI and behavior

The room feed now supports a complete manual-input learning loop. A learner can write, submit, enter the bridge length through fallback, see actual geometry change, fail safely, correct, succeed, and replay. Teacher annotations are visibly shared.

## Failure handling

- WebSocket disconnect keeps local drawing and retries pending operations.
- Renderer failure shows result card and transcript.
- Low FPS reduces decorative particles before affecting critical bodies.
- Invalid manual parameters produce inline field errors and never create a world.
- If Pixi or Planck integration is a real blocker, stop and present evidence before changing engines.

## Dependencies

- M2 green.
- PixiJS and Planck license checks.
- No OpenAI key required.

## Commit message

```text
feat: add realtime math canvas and deterministic bridge physics
```

## Fallback / cut option

Do not cut realtime layers, immutable attempts, real physics, or manual fallback. Cut decorative debris, advanced camera effects, pressure-sensitive width, and nonessential presence UI first.

## Evidence to record

- Realtime two-context video or trace.
- Unit proof that teacher strokes are excluded.
- Screenshots of `4.08 m` and `9 m` geometry.
- Headless physics test output.
- Replay network trace showing no AI request.
- Production URL and commit SHA.

---

# M4 — GPT-5.6 handwriting interpretation

## Objective

Add the substantive multimodal AI boundary: send student-only handwritten work to `gpt-5.6`, receive a strict structured interpretation, validate it, and feed only validated parameters to the existing deterministic bridge system.

## Files and components affected

```text
src/worker/ai/*
src/worker/routes/attempts.ts
src/worker/security/rate-limit.ts
src/worker/security/logging.ts
src/client/feed/blocks/Analysis*
src/client/canvas/student-raster.ts
src/shared/analysis-types.ts
tests/fixtures/openai/*
tests/unit/analysis-schema*
tests/unit/semantic-validation*
tests/integration/attempt-analysis*
tests/e2e/bridge-ai*
tests/live-ai/*
.env.example
README.md
STATUS.md
docs/08-SUBMISSION-EVIDENCE.md
```

## Implementation steps

1. Add server-only OpenAI client configuration.
2. Validate environment and fail closed when `AI_ENABLED=true` without a key.
3. Implement strict TaskPlan and SolutionAnalysis schemas.
4. Implement bridge semantic validation.
5. Render/crop a clean student-only PNG and validate upload limits.
6. Store the visible attempt PNG in private R2.
7. Implement attempt capture transaction and active-analysis lock.
8. Return accepted state quickly and run analysis through `ctx.waitUntil`.
9. Send:
   - exact task;
   - expected input names;
   - student image;
   - optional clarification;
   - strict schema.
10. Set `store: false`.
11. Implement staged WebSocket status events.
12. Parse schema strictly and reject unknown or malformed fields.
13. Run deterministic semantic validation.
14. Implement at most one bounded repair/retry.
15. On success, persist analysis and release lock.
16. On failure, release lock and display the manual bridge form.
17. Render recognition card with transcription, steps, values, error, and explanation.
18. Implement neutral disagreement state.
19. Add the two-second cancelable launch countdown.
20. Add deterministic mocked contract fixtures for all CI paths.
21. Add a separate real GPT-5.6 handwriting evaluation suite.
22. Tune crop, image detail, reasoning effort, output length, and timeout from evidence.
23. Deploy and run a real production analysis.

## Acceptance criteria

- The OpenAI key is absent from browser bundle, logs, repository, and screenshots.
- A real sample image reaches `gpt-5.6`.
- Strict schema validation succeeds for the prepared hero.
- `3/4 = 0.34` and `4.08 m` are extracted from prepared handwriting.
- The likely conversion error is visible.
- The deterministic validator, not model verdict text, controls the outcome.
- Teacher strokes are absent from the sent image.
- A second attempt cannot be submitted during analysis.
- Timeout, 429, 5xx, invalid schema, semantic invalidity, ambiguous, and unreadable paths end in a usable state.
- Manual fallback runs the same bridge scene.
- CI does not require a live OpenAI call.
- Live eval results and latency are recorded.
- Production real-AI path is verified.

## Commands to validate

```bash
bun run format:check
bun run lint
bun run typecheck
bun run test:unit -- analysis semantic
bun run test:integration -- attempt-analysis media
bun run build
bun run test:e2e -- bridge-ai fallback
bun run validate
bun run test:live-ai
bun run deploy
bun run smoke:prod
```

Inspect:

```bash
grep -R "OPENAI_API_KEY" dist .wrangler 2>/dev/null || true
```

Review Cloudflare and OpenAI logs for content leakage.

## Expected UI and behavior

After **Run my solution**, the feed reports analysis stages. It then shows a concise recognition card and countdown. The learner understands exactly which values will control the bridge. On AI failure, the room remains intact and presents the bridge-length form.

## Failure handling

- Missing production secret blocks AI deployment but not deterministic local paths.
- R2 failure keeps the canvas and offers retry; do not call OpenAI.
- Timeout or retriable upstream error gets at most one bounded retry.
- Semantic invalidity gets at most one repair call.
- After the budget, use fallback.
- If live p90 exceeds 20 seconds or fallback rate exceeds about 5%, move only the AI job to Queue/Workflow in M6.

## Dependencies

- M3 green.
- OpenAI API project and server-side key.
- R2 binding.
- Production budget and model access.

## Commit message

```text
feat: interpret handwritten solutions with GPT-5.6
```

## Fallback / cut option

Do not replace real AI with a silent fixture. Cut model-based region overlay, photo upload, voice, and elaborate prose first. Preserve image interpretation, visible structured result, validation, and fallback.

## Evidence to record

- Exact production model ID.
- Real OpenAI request/response ID without content.
- Redacted structured result.
- Live handwriting eval metrics.
- p50/p90 latency and fallback rate.
- R2 access test.
- Bundle and log secret checks.
- Production screen recording of real analysis.
- Commit and deployment IDs.

---

# M5 — Complete hero and judge flow

## Objective

Turn M2–M4 into the complete frozen judge experience: prepared room, wrong consequence, causal explanation, correction, successful rescue, achievements, replay, reset, reload, and one-tab role switching.

## Files and components affected

```text
fixtures/judge-v1/*
src/client/feed/*
src/client/room/*
src/client/simulation/templates/bridge/*
src/worker/domain/achievements.ts
src/worker/routes/judge.ts
src/worker/routes/reset.ts
tests/e2e/judge-flow*
tests/e2e/persistence*
JUDGING.md
README.md
STATUS.md
docs/08-SUBMISSION-EVIDENCE.md
```

## Implementation steps

1. Freeze `judge-v1` task wording and parameter pack.
2. Add prepared sample handwriting in a way that remains editable and clearly marked as sample state.
3. Ensure every `/judge` creates a fresh ordinary room.
4. Make the first action visually dominant and understandable.
5. Complete the wrong attempt:
   - recognize `0.34`;
   - validate `4.08 m`;
   - run short bridge;
   - show causal explanation;
   - award a disaster discovery.
6. Add the prepared correction or simple edit path.
7. Complete the correct attempt:
   - recognize `0.75`;
   - validate `9 m`;
   - run crossing;
   - show rescue;
   - award progress achievement.
8. Ensure both runs have Replay and transcript.
9. Add **Reset current task**.
10. Ensure refresh restores the same feed and visible media.
11. Ensure teacher view sees the learner process and can annotate.
12. Ensure student view never sees private teacher setup.
13. Keep the path within 90 seconds under expected real latency; allow fallback.
14. Add exact JUDGING steps and production URL.
15. Run the literal JUDGING instructions in a clean browser.
16. Deploy and freeze the first fully viable submission candidate.

## Acceptance criteria

Every item in the Definition of Done is green for the bridge family:

- no login;
- fresh judge room;
- obvious task;
- one-tab teacher/learner flow;
- real GPT interpretation;
- actual parameterized physics;
- wrong and correct outcomes;
- causal explanation;
- separate achievement categories;
- replay without GPT;
- reset;
- reload persistence;
- realtime teacher annotation;
- AI fallback;
- accessible transcript;
- production URL;
- clean E2E and smoke tests.

No `TODO`, disabled placeholder, or false claim appears in the judge path.

## Commands to validate

```bash
bun run validate
bun run test:live-ai
bun run deploy
bun run smoke:prod
```

Then manually execute every step in `JUDGING.md`:

- in incognito;
- with AI enabled;
- with AI deliberately disabled;
- at desktop width;
- at tablet width;
- with keyboard for non-drawing controls;
- with reduced motion;
- with sound muted.

## Expected UI and behavior

A judge understands the concept in the first screen, sees the AI interpretation, laughs at a safe physical consequence, corrects the mathematics, succeeds, and can verify persistence or realtime collaboration without leaving the product.

## Failure handling

The path must never dead-end:

- AI problem → bridge-length fallback;
- WebSocket problem → preserve local work and reconnect;
- renderer problem → outcome transcript and retry;
- prepared state issue → Reset;
- contaminated room concern → reopen `/judge` for a new room.

## Dependencies

- M2, M3, and M4 green.
- Production OpenAI and Cloudflare configuration.

## Commit message

```text
feat: complete the Lost Lessons Lab hero and judge flow
```

## Fallback / cut option

This milestone cannot be cut. If time is short, stop all supporting families and polish not required for comprehension. The bridge path remains the submission.

## Evidence to record

- Full 90-second production capture.
- Clean-browser Playwright trace.
- Real AI and disabled-AI screenshots.
- Teacher/student two-context capture.
- Replay network evidence.
- Reload and Reset evidence.
- Exact commit and deployment version.

---

# S1 — Supporting family: water and volume

## Objective

Add one fully tested family for volume, flow rate, time, underfill, and overflow without destabilizing the hero.

## Files and components affected

```text
src/worker/domain/templates/water/*
src/client/simulation/templates/water/*
fixtures/water/*
tests/unit/water*
tests/e2e/water*
supported skill registry
STATUS.md
docs/08-SUBMISSION-EVIDENCE.md
```

## Implementation steps

1. Define a narrow supported task schema.
2. Derive correct volume or level deterministically.
3. Create at least three curated parameter packs.
4. Validate GPT-proposed parameters within safe visual ranges.
5. Implement stable bulk liquid level plus bounded rigid droplets and authored spray.
6. Implement underfill, correct fill, and overflow outcomes.
7. Add accessible transcript and progress/disaster achievements.
8. Add headless body-count and settlement tests.
9. Add one browser path and production smoke.
10. Enable skill chip only after all gates pass.

## Acceptance criteria

- Mathematical volume determines result before physics.
- Water level visibly responds to submitted parameter.
- Overflow looks dynamic but remains performant.
- At least three curated packs are valid.
- AI and manual fallback use the same schema.
- No hero test regresses.
- Production verification passes.

## Commands to validate

```bash
bun run test:unit -- water
bun run test:integration
bun run test:e2e -- water judge-flow
bun run validate
bun run deploy
bun run smoke:prod
```

## Expected UI and behavior

A real volume or flow problem precedes an entertaining underfill/overflow scene. The feed states exactly which value caused the level.

## Failure handling

Reduce decorative droplets and spray first. If performance, validation, or E2E remains unreliable, hide and cut the entire family.

## Dependencies

M5 green and stable.

## Commit message

```text
feat: add the water and volume simulation family
```

## Fallback / cut option

First supporting family to keep, but still optional. Cut it completely rather than exposing a partial template.

## Evidence to record

Curated packs, physics metrics, correct/incorrect screenshots, tests, production URL, and commit.

---

# S2 — Supporting family: speed, time, and collision

## Objective

Add a deterministic motion family where speed, time, and distance change arrival or safe separation.

## Files and components affected

```text
src/worker/domain/templates/speed/*
src/client/simulation/templates/speed/*
fixtures/speed/*
tests/unit/speed*
tests/e2e/speed*
supported skill registry
STATUS.md
docs/08-SUBMISSION-EVIDENCE.md
```

## Implementation steps

1. Define one narrow speed–time–distance task pattern.
2. Derive the correct value deterministically.
3. Create curated packs with broad safe physical thresholds.
4. Implement arrival, stop, safe passage, or comic collision outcomes.
5. Mark fast bodies for continuous collision handling.
6. Keep correctness independent from the actual collision callback.
7. Add transcript, explanation, achievements, fallback, and tests.
8. Enable the skill only after production verification.

## Acceptance criteria

- Inputs visibly change trajectory/timing.
- No tunneling in extreme fixtures.
- Semantic outcome and explanation are deterministic.
- Accessible result does not require watching collision.
- Hero and water tests remain green.

## Commands to validate

```bash
bun run test:unit -- speed
bun run test:e2e -- speed judge-flow
bun run validate
bun run deploy
bun run smoke:prod
```

## Expected UI and behavior

A real motion calculation leads to safe separation, wrong arrival, or a clearly non-harmful comic collision.

## Failure handling

Simplify to one moving body and one broad target zone before considering an engine change.

## Dependencies

M5 green; S1 preferred but not technically required.

## Commit message

```text
feat: add the speed and collision simulation family
```

## Fallback / cut option

Cut before S1. Remove it from supported skills and claims if any gate is unreliable.

## Evidence to record

CCD tests, fixture matrix, screenshots, browser trace, production version, and commit.

---

# S3 — Supporting family: structure, load, and destruction

## Objective

Add a simple equation, scale, load, or counterweight family with controlled authored destruction.

## Files and components affected

```text
src/worker/domain/templates/structure/*
src/client/simulation/templates/structure/*
fixtures/structure/*
tests/unit/structure*
tests/e2e/structure*
supported skill registry
STATUS.md
docs/08-SUBMISSION-EVIDENCE.md
```

## Implementation steps

1. Choose one narrow deterministic equation/load schema.
2. Create curated packs with clear valid ranges.
3. Implement intact structure and prepared fragment replacement.
4. Trigger result from deterministic outcome or a broad authored threshold.
5. Cap fragments and particles.
6. Add transcript, explanation, achievements, fallback, and tests.
7. Enable only after production verification.

## Acceptance criteria

- The task is mathematically real and not spectacle-only.
- Submitted value clearly changes stability/load.
- Fragments never determine grading.
- No body leak or unbounded simulation.
- All earlier gates remain green.

## Commands to validate

```bash
bun run test:unit -- structure
bun run test:e2e -- structure judge-flow
bun run validate
bun run deploy
bun run smoke:prod
```

## Expected UI and behavior

A correct load stabilizes or completes the structure; a wrong value produces a bounded comic collapse.

## Failure handling

Reduce fragments and effects. If still unreliable, cut the family completely.

## Dependencies

M5 green; lowest priority.

## Commit message

```text
feat: add the structure and destruction simulation family
```

## Fallback / cut option

First family removed when time is short.

## Evidence to record

Fixture matrix, fragment/body metrics, screenshots, production smoke, and commit.

---

# M6 — Reliability, fallbacks, and cost controls

## Objective

Harden every frozen failure path using measured production behavior without changing the product model.

## Files and components affected

```text
src/worker/security/*
src/worker/ai/*
src/worker/routes/*
src/client/error/*
src/client/room/*
tests/integration/failure*
tests/e2e/failure*
.env.example
README.md
STATUS.md
docs/07-SECURITY-COST-AND-DEPLOYMENT.md
docs/08-SUBMISSION-EVIDENCE.md
```

## Implementation steps

1. Review live AI latency and fallback measurements.
2. Confirm or tune:
   - total timeout;
   - retry categories;
   - maximum retry;
   - image size;
   - reasoning effort;
   - output limits.
3. Move only AI execution to Queue/Workflow if documented threshold is violated.
4. Finish per-room and per-IP limits.
5. Implement `AI_ENABLED` kill switch.
6. Complete R2 upload and authorized read failure paths.
7. Complete WebSocket reconnect and pending operation UI.
8. Complete renderer failure and low-quality modes.
9. Verify one active analysis lock cannot get stuck after exceptions.
10. Add reset recovery and stale-status cleanup.
11. Ensure error copy is concise and preserves user work.
12. Verify structured logs exclude content.
13. Add production failure drills.
14. Deploy and rerun the full judge flow.

## Acceptance criteria

- Every failure table row in UX docs has a tested recovery.
- No error deletes unsent canvas work.
- Active analysis lock releases on success, failure, timeout, and thrown exception.
- AI-disabled mode completes the bridge path.
- Limits do not interrupt the 90-second judge path or ordinary 20–30 minute practice.
- Logs contain operational evidence but no work content or tokens.
- Production remains usable after deliberate OpenAI failure.

## Commands to validate

```bash
bun run test:unit
bun run test:integration -- failure rate-limit
bun run test:e2e -- failure judge-flow
bun run validate
bun run test:live-ai
bun run deploy
bun run smoke:prod
```

## Expected UI and behavior

Failures feel like recoverable branches of the same feed, not system crashes. The room and work remain intact.

## Failure handling

If Queue/Workflow is not needed by evidence, do not add it. If a reliability feature adds more failure surface than it removes, revert it and document the simpler control.

## Dependencies

M5 green; real production measurements.

## Commit message

```text
fix: harden analysis, persistence, and demo fallbacks
```

## Fallback / cut option

External observability, automated retention, and sophisticated link controls remain cut. Do not cut manual fallback or kill switch.

## Evidence to record

Failure matrix, latency metrics, limit tests, redacted logs, kill-switch screenshot, production drill, commit, and version.

---

# M7 — Design polish and accessibility

## Objective

Improve clarity, emotional payoff, responsiveness, sound, and accessibility without adding product scope.

## Files and components affected

```text
src/client/feed/*
src/client/styles/*
src/client/accessibility/*
src/client/simulation/*
public/assets/*
tests/e2e/accessibility*
README.md
JUDGING.md
STATUS.md
docs/08-SUBMISSION-EVIDENCE.md
```

## Implementation steps

1. Conduct a five-second first-screen review.
2. Strengthen hierarchy and dominant next action.
3. Polish feed spacing and block transitions.
4. Finalize original bridge assets and rescue character.
5. Add restrained authored particles, camera motion, and sound.
6. Gate sound behind user interaction and provide mute.
7. Implement reduced-motion substitutions.
8. Verify all non-drawing controls by keyboard.
9. Add live-region status behavior.
10. Verify color-independent role and result indicators.
11. Tune desktop, tablet, and small-phone layouts.
12. Ensure simulation transcript stays synchronized with semantic outcome.
13. Run automated accessibility checks where available and manual screen-reader spot checks.
14. Do not change hero timing or logic without rerunning E2E.

## Acceptance criteria

- A first-time user identifies the next action in five seconds.
- The room remains one continuous feed at all target widths.
- No essential state exists only in a canvas, animation, sound, or color.
- Keyboard completes the judge path except freehand drawing, for which prepared state/fallback exists.
- Focus order is logical.
- Reduced motion preserves meaning.
- Sound never autoplays before interaction.
- Assets have confirmed licensing or are original.
- Performance remains within measured thresholds.

## Commands to validate

```bash
bun run format:check
bun run lint
bun run typecheck
bun run test:e2e -- accessibility responsive judge-flow
bun run validate
bun run deploy
bun run smoke:prod
```

## Expected UI and behavior

The demo feels intentional and playful while retaining textbook clarity. Spectacle follows the calculation and never obscures it.

## Failure handling

Remove decorative effects that cause performance, motion, readability, or licensing problems. Do not weaken semantic structure.

## Dependencies

M5 and M6 green.

## Commit message

```text
style: polish the learning feed and accessible simulation controls
```

## Fallback / cut option

Cut decorative onboarding animation, extra achievements, optional sound layers, and secondary character art before core clarity.

## Evidence to record

Desktop/tablet/mobile screenshots, keyboard capture, reduced-motion capture, accessibility report, performance notes, asset provenance, commit, and deployment.

---

# M8 — E2E, security, and deployment verification

## Objective

Prove the exact production release is reproducible, safe enough for the demo, and passes the literal judging path.

## Files and components affected

```text
tests/*
.github/workflows/*
scripts/smoke-prod*
scripts/secret-audit*
README.md
JUDGING.md
STATUS.md
docs/06-TEST-PLAN.md
docs/07-SECURITY-COST-AND-DEPLOYMENT.md
docs/08-SUBMISSION-EVIDENCE.md
THIRD_PARTY_NOTICES.md
```

## Implementation steps

1. Run all validation from a clean install.
2. Run unit, integration, mocked E2E, and live AI eval.
3. Run two-context realtime collaboration.
4. Run persistence, reset, replay, and failure paths.
5. Run desktop, tablet, phone, reduced-motion, and keyboard checks.
6. Scan repository, build output, source maps, Worker bundle, and logs for secrets.
7. Verify private R2 media cannot be fetched without a valid capability.
8. Verify learner link cannot access teacher setup.
9. Verify rate limits and kill switch.
10. Verify no CAPTCHA, WAF challenge, registration, or BYOK.
11. Verify production rollback procedure.
12. Clone repository into a clean directory and follow README.
13. Run `JUDGING.md` literally in a clean browser.
14. Fix all failures; do not waive required checks.
15. Deploy a candidate release and stop adding features.

## Acceptance criteria

- Clean-clone setup works.
- Full validation is green.
- Live AI eval meets recorded release threshold or fallback remains acceptable.
- Every judge step works on production.
- Every security checklist item has evidence.
- No secret or private link is exposed.
- Production rollback target exists.
- No unresolved P0/P1 issue remains.
- Documentation describes only working behavior.

## Commands to validate

```bash
rm -rf node_modules dist
bun install --frozen-lockfile
bun run validate
bun run test:live-ai
bun run deploy
bun run smoke:prod
```

Run repository-specific audit scripts created during implementation.

## Expected UI and behavior

The release behaves exactly like JUDGING and README describe in a clean context.

## Failure handling

A failed required gate blocks release. Revert the latest risky change or cut an optional family rather than documenting around the failure.

## Dependencies

All included product milestones complete.

## Commit message

```text
test: verify the complete production judge path
```

## Fallback / cut option

Cut optional supporting families in reverse priority to restore a green release. Do not waive hero, security, fallback, or production checks.

## Evidence to record

Complete command logs, clean-clone notes, production trace, security audit, rollback ID, issue list, commit, and deployment.

---

# M9 — Submission evidence and release freeze

## Objective

Freeze the exact submission release and replace every pending submission claim with concrete evidence.

## Files and components affected

```text
README.md
JUDGING.md
STATUS.md
docs/08-SUBMISSION-EVIDENCE.md
docs/09-SUBMISSION-COPY-DRAFT.md
docs/10-REVIEW-PROMPTS.md
docs/11-HUMAN-VERIFICATION-CHECKLIST.md
docs/12-SUBMISSION-CHECKLIST.md
THIRD_PARTY_NOTICES.md
```

## Implementation steps

1. Choose the exact submission commit.
2. Put the production URL, video URL, repository URL, and exact model path in docs.
3. Run the eligibility-auditor prompt against real evidence.
4. Run the rubric-grader prompt.
5. Run the first-impression prompt using final assets.
6. Fix evidence gaps and friction before considering any polish.
7. Record how Codex built core functionality and the representative `/feedback` Session ID privately for submission.
8. Update the Devpost copy draft to match only implemented behavior.
9. Capture final screenshots and timestamps.
10. Record all licenses and third-party assets.
11. Run final production smoke and literal JUDGING path.
12. Commit the release documentation.
13. Create annotated or lightweight tag `build-week-submission`.
14. Push commit and tag.
15. Do not deploy risky changes after tag.

## Acceptance criteria

- Evidence matrix contains no unsupported `PASS`.
- Every required claim points to exact evidence.
- README starts with value, demo, judge path, and expected result.
- JUDGING has exact production URL and 3–6 steps.
- Video is public, under three minutes, and matches production.
- Repository and license access satisfy submission rules.
- Session ID is recorded in the appropriate private submission location.
- Submission commit and tag match production.
- Final smoke is green after tag.
- `STATUS.md` accurately records implemented and cut scope.

## Commands to validate

```bash
bun run validate
bun run test:live-ai
bun run smoke:prod
git status --short
git diff --check
git grep -nE '(sk-[A-Za-z0-9_-]{20,}|CLOUDFLARE_API_TOKEN|#token=)' -- . || true
git log -1 --oneline
git tag --list build-week-submission
```

Do not create the tag until the final commit is selected.

## Expected UI and behavior

No product change is expected. The exact judged release remains stable.

## Failure handling

If a claim lacks evidence, remove or soften the claim. If production and video differ, fix the material or restore production to the tagged behavior. Do not add a new feature during evidence freeze.

## Dependencies

M8 green, video and external submission assets available.

## Commit message

```text
docs: freeze Build Week submission evidence and release
```

## Fallback / cut option

There is no cut for truthful evidence. Remove optional marketing claims rather than asserting unsupported impact or coverage.

## Evidence to record

- Submission commit and tag.
- Production deployment version.
- Final validation outputs.
- Public video URL and timestamps.
- Devpost preview screenshots.
- Eligibility/rubric/first-impression review outputs.
- Final known-risk statement.

---

# Global cut line

The protected core is:

```text
production room
+ teacher/student links and one-tab preview
+ continuous feed
+ realtime layered canvas
+ immutable attempt
+ GPT-5.6 handwriting interpretation
+ deterministic validation and manual fallback
+ real bridge physics
+ wrong → explanation → correction → success
+ replay, reset, persistence, accessibility, tests
```

Cut in this order:

1. S3 structure/load/destruction;
2. S2 speed/time/collision;
3. S1 water/volume;
4. decorative sound and particles;
5. extra achievements and presentation variants;
6. optional photo input;
7. optional text-region overlay.

Never cut or silently mock the protected core.
