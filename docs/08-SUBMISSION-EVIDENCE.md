# 08 — Submission evidence

## Rules

This file is an evidence ledger, not marketing copy.

Statuses:

- `PENDING` — implementation or evidence does not exist yet;
- `PASS` — exact evidence exists and was independently verified;
- `FAIL` — requirement was tested and failed;
- `CUT` — the related optional claim or feature was removed from submission scope;
- `N/A` — genuinely not applicable, with a written reason.

A row may become `PASS` only when **Exact evidence** names a concrete file, test, URL, screenshot, log, commit, or video timestamp and **Verification** records how it was checked.

Do not use:

- “works as expected”;
- “tests pass” without command/report;
- a design document as proof of implemented behavior;
- a local screenshot as proof of production;
- a prepared fixture as proof of a live AI call;
- an unverified marketing claim.

## Release identifiers

| Item | Value | Status |
|---|---|---|
| Production URL | `https://lost-lessons-lab.sanocks.workers.dev` | PASS |
| Judge URL | `https://lost-lessons-lab.sanocks.workers.dev/judge` | PASS for complete M5 hero |
| Repository URL | `https://github.com/alexandr-panchenko/lost-lessons-lab` | PASS |
| Public video URL | pending | PENDING |
| Submission commit | pending | PENDING |
| Submission tag | `build-week-submission` pending | PENDING |
| Cloudflare deployment/version | S2 final `33e4f9eb-a13b-427d-b01c-464d353a827e` from verified-entry commit `fa857d3` | PASS through S2 |
| Representative Codex Session ID | store in private submission checklist; pending | PENDING |
| OpenAI model ID observed in production | `gpt-5.6-sol` | PASS |
| License | `LICENSE`, Apache-2.0 | PASS for design packet only |

## Milestone implementation evidence

| Milestone | Exact evidence | Verification | Status |
|---|---|---|---|
| M1 — reproducible environment | `package.json`; `bun.lock`; `wrangler.jsonc`; `.github/workflows/ci.yml`; `src/client/App.tsx`; `src/worker/index.ts`; `src/worker/room/RoomDurableObject.ts`; `tests/unit/environment.test.ts`; `tests/integration/worker.test.ts`; `tests/e2e/shell.spec.ts`; `scripts/finalize-build.ts` | On 2026-07-21, `bun install --frozen-lockfile` and every documented M1 command passed; `bun run validate` covered format, lint, strict types, 2 unit tests, 2 Cloudflare Worker/SQLite DO integration tests, production build, and 2 Chromium E2E tests. `git diff --check`, non-Markdown tracked/history scans, generated `.dev.vars` removal, actual-value artifact scan, and client-bundle scan passed. | PASS |
| M2 — deployable room shell | Core commit `0c39b42`; delivery fixes through `c906082`; Cloudflare version `b2b3b725-b3ab-48e5-8f80-8eedf46f6bb3`; CI run `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29802489533`; deploy/smoke run `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29802536234`; `src/worker/routes/rooms.ts`; `src/worker/room/RoomDurableObject.ts`; `src/worker/security/capabilities.ts`; `src/shared/protocol.ts`; `fixtures/judge-v1/fixture.ts`; `src/client/room/`; `src/client/feed/`; `tests/unit/capabilities.test.ts`; `tests/integration/rooms.test.ts`; `tests/e2e/room-shell.spec.ts`; `scripts/smoke-prod.ts`; `.github/workflows/deploy.yml` | On 2026-07-21, `bun run validate` passed 5 unit, 6 Worker/SQLite DO integration, and 3 Chromium E2E tests. Three clean-context production Chromium tests passed. CI run `29802489533` passed validation and secret scan; gated deploy run `29802536234` deployed the validated commit and passed isolated `/judge` creation, teacher/student filtering, invalid-capability rejection, and protected room headers. | PASS |
| M3 — realtime canvas and deterministic bridge | Core commit `b76eede`; strict-CSP delivery fix `cb80021`; Cloudflare version `71f9ffc7-9423-413f-a52e-4ccac07ff6c4`; CI `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29804635232`; deploy/smoke `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29804696808`; `src/shared/canvas.ts`; `src/shared/domain/bridge.ts`; `src/client/canvas/`; `src/client/simulation/`; `src/simulations/bridge/bridge-world.ts`; `src/worker/room/RoomDurableObject.ts`; `tests/unit/canvas.test.ts`; `tests/unit/bridge.test.ts`; `tests/integration/canvas-room.test.ts`; `tests/e2e/bridge-manual.spec.ts`; `tests/e2e/realtime.spec.ts`; `tests/e2e/responsive.spec.ts`; `docs/evidence/m3/` | On 2026-07-21, the local gate passed 18 unit, 9 Worker/SQLite DO integration, build, and 11 Chromium E2E tests. CI run `29804635232` repeated the full gate and secret scan. Deploy run `29804696808` passed production smoke. A clean production browser run passed all 11 tests, including real PixiJS canvas assertions under strict CSP, two-context layers, reconnect/idempotent resend, immutable cutoff, `4.08 m` recovery, `9 m` crossing, replay without API traffic, reload, three viewports, and reduced motion. The three cropped production screenshots were visually inspected and contain no capability. | PASS |
| M4 — GPT-5.6 handwriting interpretation | Core commit `969f99d`; Worker fetch delivery fix `42ae639`; Cloudflare version `4df2792d-c731-4f05-946b-000671de227e`; CI `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29807921144`; deploy/smoke `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29807995100`; `src/worker/ai/`; `src/worker/routes/attempts.ts`; `src/shared/analysis-types.ts`; `src/shared/validation/bridge-analysis.ts`; `src/client/canvas/student-raster.ts`; `src/client/feed/AnalysisCard.tsx`; `tests/live-ai/`; `scripts/verify-production-ai.ts`; `docs/evidence/m4/analysis-wrong.png` | On 2026-07-21, the final local gate passed 39 unit, 13 Worker/SQLite DO/R2 integration, build, and 12 mocked Chromium tests. The opt-in two-image live gate extracted wrong and correct hero inputs exactly on first responses in 4.55s and 4.23s. After CI and gated deployment, repeated production samples extracted `0.34` and `4.08 m` on first responses in 5.14s, 5.70s, and 8.59s; each persisted a deterministic short-bridge run, denied unauthenticated media, loaded authorized private R2 media, and rendered without console errors. The cropped recognition card was visually inspected and contains no capability. | PASS |
| M5 — complete hero and judge flow | Core commit `80d93aa`; verification commit `892791e`; Cloudflare version `3143b924-6be1-4436-aa62-167e4ef25e1d`; CI `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29810106237`; deploy/smoke `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29810212998`; `src/shared/judge-handwriting.ts`; `src/worker/domain/achievements.ts`; `src/worker/routes/reset.ts`; `src/client/feed/PreparedCorrectionPanel.tsx`; `src/client/feed/AchievementCard.tsx`; `scripts/verify-production-hero.ts`; `docs/evidence/m5/hero-wrong-to-correct.png` | On 2026-07-21, final validation passed 42 unit, 15 Worker/SQLite DO/R2 integration, build, and 12 Chromium tests. The live gate extracted both frozen samples exactly on first GPT-5.6 responses in 4.62s and 5.06s. All 12 tests passed again against production. A clean reduced-motion production browser made exactly two real AI requests, extracted `0.34` / `4.08 m` and `0.75` / `9 m`, rendered both physics outcomes and separate awards, replayed without AI, restored both runs after reload, and reset the same room to prepared state. The final post-propagation smoke passed. | PASS |
| S1 — water and volume family | Core commit `c586be7`; verified-entry commit `5508df4`; verifier commit `f436986`; Cloudflare version `398a8f5c-9cc7-4887-9b85-b0f641cfbca4`; CI `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29813159173`; deploy/smoke `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29813260681`; `src/shared/domain/water.ts`; `src/shared/validation/water-analysis.ts`; `src/simulations/water/water-world.ts`; `fixtures/water/packs.ts`; `scripts/verify-production-water.ts`; `docs/evidence/s1/water-correct-and-overflow.png` | On 2026-07-21, the final local gate passed 49 unit, 17 Worker/SQLite DO/R2 integration, build, and 13 Chromium tests; CI repeated the gate and secret scan. All 13 browser paths passed against the final production version, including the enabled skill link and unchanged hero. Repeated clean production runs each made one real AI request; the final strengthened verifier explicitly asserted visible `gpt-5.6-sol`, exact `3 L/min`, `5 min`, and `15 L`, the deterministic correct level and separate manual `24 L` bounded overflow with distinct awards, replay without AI, persistence across reload, and reset to prepared ink. The production capture was visually inspected and contains no capability. | PASS |
| S2 — speed, time, and collision family | Core commit `2a5ffbb`; verified-entry commit `fa857d3`; Cloudflare version `33e4f9eb-a13b-427d-b01c-464d353a827e`; CI `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29814757030`; deploy/smoke `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29814874095`; `src/shared/domain/speed.ts`; `src/shared/validation/speed-analysis.ts`; `src/simulations/speed/speed-world.ts`; `fixtures/speed/packs.ts`; `scripts/verify-production-speed.ts`; `docs/evidence/s2/speed-correct-and-collision.png` | On 2026-07-21, the final local gate passed 55 unit, 19 Worker/SQLite DO/R2 integration, build, and 14 Chromium tests; CI repeated the gate and secret scan. All 14 browser paths passed against the final production version at bounded concurrency, including the enabled speed link and unchanged hero/water flows. Repeated clean production runs each made one real AI request and explicitly asserted visible `gpt-5.6-sol`, exact `8 m/s`, `3 s`, and `24 m`, deterministic target arrival and a separate manual `36 m` soft-bumper collision with distinct awards, replay without AI, persistence across reload, and reset to prepared ink. The extreme headless CCD case contacted the bumper without tunneling. The production capture was visually inspected and contains no capability. | PASS |
| S3 — structure, load, and destruction family | Core commit `81af212`; verified-entry commit `5942254`; Cloudflare version `d536c44d-5f34-4e00-b528-47a8347ffcd0`; CI `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29817214716`; deploy/smoke `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29817376261`; `src/shared/domain/structure.ts`; `src/shared/validation/structure-analysis.ts`; `src/simulations/structure/structure-world.ts`; `fixtures/structure/packs.ts`; `scripts/verify-production-structure.ts`; `docs/evidence/s3/structure-stable-and-collapse.png` | On 2026-07-21, the final local gate passed 61 unit, 21 Worker/SQLite DO/R2 integration, build, and 15 Chromium tests; CI repeated the gate and secret scan. All 15 browser paths passed against the enabled production version at bounded concurrency, including the structure skill link and unchanged hero/water/speed flows. Repeated clean production runs each made one real AI request and explicitly asserted visible `gpt-5.6-sol`, exact 12 items, 5 kg per item, and 60 kg total, the deterministic stable platform and a separate manual 90 kg bounded 12-fragment collapse with distinct awards, replay without AI, persistence across reload, and reset to prepared ink. Repeated headless worlds settled with finite positions and explicit teardown. The production capture was visually inspected and contains no capability. | PASS |

## Eligibility and submission matrix

| Requirement / criterion | Claim | Exact evidence target | URL / file / video timestamp | Verification | Status |
|---|---|---|---|---|---|
| New or substantially new work | Core application is built during the competition period | Git history from initial design commit through submission tag | repository commit range | Compare timestamps and diff; summarize in README | PENDING |
| Education track fit | Product addresses tutor-guided correction of a specific math gap | Implemented teacher request, learner attempt, correction flow | production `/judge`; `docs/01-PRODUCT-BRIEF.md` is rationale only | Human judge run and video | PENDING |
| Substantive Codex use | Primary Codex session implements the majority of core functionality | Codex Session ID, commit authorship/log, milestone history, README build log | private Devpost field; README; Git history | Cross-check Session ID and commits | PENDING |
| Substantive GPT-5.6 use | GPT-5.6 reads free-form handwriting, returns structured steps and likely error | Production server config, real response ID, analysis card, live eval | `src/worker/ai/openai-responses.ts`; `tests/live-ai/bridge-live.test.ts`; `docs/evidence/m4/analysis-wrong.png`; production response suffix `44401dc4` | Live and production paths reported `gpt-5.6-sol`; exact extracted values and visible likely error were independently asserted | PASS |
| Working product | Production judge path completes wrong and correct attempts | Playwright production trace and manual capture | `scripts/verify-production-hero.ts`; `docs/evidence/m5/hero-wrong-to-correct.png` | Clean production browser completed both real-AI attempts, physics outcomes, awards, reload, and reset | PASS |
| Free testing path | No login, payment, or BYOK | `/judge` in clean browser; UI screenshot | `JUDGING.md`; `docs/evidence/m5/hero-wrong-to-correct.png` | Clean production contexts entered isolated rooms without credentials, payment, or user API key | PASS |
| Live URL | Cloudflare URL remains accessible | HTTP/smoke report | `https://lost-lessons-lab.sanocks.workers.dev`; deploy run `29810212998` | Gated and post-propagation smoke passed | PASS |
| Video under 3 minutes | Public narrated English video is shorter than 3:00 | YouTube duration and public access | video URL | Open incognito; record duration | PENDING |
| Repository available | Public repo or organizer-accessible private repo | Repository settings and URL | repo URL | Open unauthenticated or verify invitations | PENDING |
| Suitable license | Repository includes Apache-2.0 | `LICENSE` | repository root | Compare to official Apache text | PASS |
| English materials | UI, README, judging, video/subtitles, Devpost are English | Final production and documents | multiple | Manual review | PENDING |
| No secrets | No API keys/tokens/private links in tracked files, bundle, logs, video | secret-scan output and manual review | CI artifact; report | Run scan on submission commit | PENDING |
| License compliance | Dependencies and assets have verified licenses | lockfile audit, `THIRD_PARTY_NOTICES.md`, asset provenance | repository files | Manual and automated license review | PENDING |
| `/feedback` Session ID | Representative Codex Session ID supplied | Devpost field/screenshot | private evidence location | Verify after `/feedback` | PENDING |
| Submission status | Devpost project is Submitted, not Draft | confirmation screen | private screenshot | Open My Projects and public View | PENDING |

## Frozen hero-flow evidence

| Requirement / criterion | Claim | Exact evidence target | URL / file / video timestamp | Verification | Status |
|---|---|---|---|---|---|
| Fresh judge room | Every `/judge` visit creates a different real room | E2E test comparing two room IDs | `tests/e2e/room-shell.spec.ts`; production run on `cb80021` | Passed in the 11-test clean production Chromium run on 2026-07-21 | PASS |
| Guided first screen | User understands next action within five seconds | First-screen screenshot and first-impression review | production `/judge`; review output | Independent reviewer response | PENDING |
| One-tab role flow | Teacher can preview learner without second browser | E2E and screen capture | `tests/e2e/room-shell.spec.ts`; production run on `cb80021` | Teacher-to-student preview passed in a clean production context | PASS |
| Real shared room | Separate teacher and learner links observe the same state | Two-context E2E trace | `tests/e2e/realtime.spec.ts`; CI run `29804635232` | Two isolated browser contexts observed the same ordered operations | PASS |
| Realtime canvas | Learner stroke appears for teacher and teacher annotation appears for learner | Two-context Playwright test | `tests/e2e/realtime.spec.ts`; `docs/evidence/m3/realtime-layers.png` | Production browser test passed; cropped production capture was visually inspected | PASS |
| Teacher layer exclusion | Teacher annotations do not enter AI input | Unit raster fixture and intercepted/hashed E2E media | `tests/unit/canvas.test.ts`; `tests/e2e/analysis-fallback.spec.ts`; `src/client/canvas/student-raster.ts` | Unit tests cover the layer reducer; mocked Chromium submitted no request for teacher-only ink, then inspected the cropped PNG request after learner ink was added | PASS |
| Immutable attempt | Later strokes do not modify earlier attempt | unit/integration test and reload evidence | `tests/integration/canvas-room.test.ts`; `tests/e2e/bridge-manual.spec.ts` | Integration reconstruction and production reload assertions passed | PASS |
| One active analysis | Correction cannot submit until prior analysis finishes | integration/E2E test | `tests/integration/analysis-room.test.ts`; `src/client/App.tsx` | SQLite lock rejected a parallel analysis and released after terminal failure; both submission controls share the active-attempt disable condition | PASS |
| Real handwriting input | Prepared free-form work is an image rendered from canvas | visible attempt and media reference | `src/client/canvas/student-raster.ts`; `docs/evidence/m4/analysis-wrong.png` | Production smoke loaded the persisted private PNG through an authorized media route and denied the same route without a capability | PASS |
| Visible interpretation | Recognition card shows transcription, steps, inputs, likely error | production screenshot/video | `docs/evidence/m4/analysis-wrong.png` | Cropped production card visibly contains the source image, transcription, ordered steps, `0.34`, `4.08 m`, first error, explanation, and launch countdown | PASS |
| Strict Structured Output | Model response is parsed through closed schema | exact source and schema tests | `src/shared/analysis-types.ts`; `src/worker/ai/openai-responses.ts`; `tests/unit/analysis-schema.test.ts`; `tests/unit/openai-responses.test.ts` | Closed Zod and Responses JSON schemas reject unknown/missing/malformed fields; exact request options and bounded repair are tested | PASS |
| Deterministic validation | Arithmetic and units are checked outside GPT | bridge domain tests and source | `src/shared/domain/bridge.ts`; `src/shared/validation/bridge-analysis.ts`; `tests/unit/bridge-analysis-validation.test.ts` | Extracted wrong/correct inputs are classified by pure TypeScript; contradiction and model-verdict disagreement tests prove GPT text cannot control truth | PASS |
| Wrong parameter controls physics | `4.08 m` creates actual short bridge geometry | source, physics test, production capture | `docs/evidence/m3/bridge-4.08-failure.png`; `tests/unit/bridge.test.ts` | Cropped production PixiJS capture and bounded Planck test were inspected; no video asset exists | PASS |
| Safe comic failure | Vehicle enters recovery area without harmful presentation | production capture and transcript | `docs/evidence/m3/bridge-4.08-failure.png` | Production capture shows the vehicle in the highlighted recovery area with a non-punitive transcript | PASS |
| Causal explanation | UI states how `0.34` created `4.08 m` | screenshot/video | `docs/evidence/m4/analysis-wrong.png` | Production card states that the multiplication is consistent with `0.34`, identifies the earlier fraction conversion, and displays the resulting `4.08 m` | PASS |
| Correction | Learner changes to `0.75` / `9 m` | production trace | `scripts/verify-production-hero.ts`; `docs/evidence/m5/hero-wrong-to-correct.png` | Prepared correction replaced editable student ink; the second real response extracted exact corrected values | PASS |
| Correct physics outcome | `9 m` produces successful crossing | physics test and production capture | `docs/evidence/m3/bridge-9-success.png`; `tests/unit/bridge.test.ts` | Production PixiJS canvas shows the crossed vehicle; headless Planck test reached `crossed` | PASS |
| Achievements | Separate disaster and progress awards appear | source/test/screenshots | `tests/unit/achievements.test.ts`; `docs/evidence/m5/hero-wrong-to-correct.png` | Production displayed “The World's Shortest Bridge” as disaster and “Fixed It” as progress; source/test review found no mastery claim | PASS |
| Replay | Wrong and correct scenes replay without OpenAI request | Playwright network assertion | `tests/e2e/bridge-manual.spec.ts`; `scripts/verify-production-hero.ts` | Local and production request counters remained unchanged across Replay | PASS |
| Reset | Reset returns current judge task to fixture start | E2E and production test | `tests/integration/reset-room.test.ts`; `scripts/smoke-prod.ts`; `scripts/verify-production-hero.ts` | Teacher reset removed attempts, analyses, runs, awards, and private media while restoring prepared editable ink in the same room | PASS |
| Persistence | Reload reconstructs visible feed and media | E2E plus production reload | `tests/e2e/bridge-manual.spec.ts`; `scripts/verify-production-hero.ts` | Both real-AI analysis cards, runs, awards, and visible handwriting returned after production reload | PASS |
| Manual fallback | AI-disabled or failed path accepts bridge length and runs same scene | failure E2E and production capture | `tests/e2e/bridge-manual.spec.ts`; `docs/evidence/m3/bridge-4.08-failure.png` | Production was deliberately configured `AI_ENABLED=false`; manual values drove the same deterministic scene | PASS for AI-disabled path |
| Text transcript | Simulation outcome is available as text | DOM assertion/screenshot | `tests/e2e/bridge-manual.spec.ts`; `docs/evidence/m3/bridge-4.08-failure.png` | Production DOM and capture expose the verified result and domain check as text | PASS |
| Responsive feed | Desktop/tablet/phone use one continuous flow | viewport screenshots and E2E | `tests/e2e/responsive.spec.ts`; CI run `29804635232` | Desktop, tablet, and phone tests passed without horizontal overflow | PASS |
| Accessible controls | Semantic controls, keyboard path, focus, reduced motion | accessibility E2E and manual check | report | Keyboard and reduced-motion run | PENDING |

## Technical implementation evidence

| Requirement / criterion | Claim | Exact evidence target | URL / file / video timestamp | Verification | Status |
|---|---|---|---|---|---|
| Cloudflare deployment | React SPA and API run in one Worker | Worker config and deployed headers | `wrangler.jsonc`; Cloudflare version `3143b924-6be1-4436-aa62-167e4ef25e1d` | Gated deploy and strengthened production smoke run `29810212998` passed | PASS |
| Durable Object room | One SQLite-backed Durable Object owns room state | binding/config, source, integration tests | `wrangler.jsonc`; `src/worker/room/RoomDurableObject.ts`; `tests/integration/` | 9 Worker/SQLite DO integration tests plus production persistence passed | PASS |
| Hibernation WebSockets | Realtime uses Durable Object Hibernation API | source and reconnect test | `src/worker/room/RoomDurableObject.ts`; `tests/e2e/realtime.spec.ts` | Code review plus explicit production disconnect/reconnect test passed | PASS |
| Private R2 | Visible media stored privately and served through authorized Worker | binding, source, authorization test | `src/worker/routes/attempts.ts`; `scripts/verify-production-ai.ts`; `tests/integration/analysis-room.test.ts` | Production returned `401` without a capability and loaded the same PNG with the learner capability; reset deletion passed integration coverage | PASS |
| Operation-log canvas | Strokes are simplified operations ordered by room sequence | source/unit/integration tests | `src/shared/canvas.ts`; `src/client/canvas/stroke-simplify.ts`; `tests/unit/canvas.test.ts`; `tests/integration/canvas-room.test.ts` | Unit and integration runs verified simplification, sequencing, delta resume, and deduplication | PASS |
| Parameterized physics | PixiJS renders Planck world built from submitted values | source, tests, production | `src/client/simulation/BridgeSimulation.tsx`; `src/simulations/bridge/bridge-world.ts`; `docs/evidence/m3/bridge-4.08-failure.png`; `docs/evidence/m3/bridge-9-success.png` | Production canvases show two different bridge lengths; browser test rejects renderer fallback | PASS |
| Fixed-step and CCD | Simulation uses fixed step and continuous collision for fast body | source and stress test | `src/simulations/bridge/bridge-world.ts`; `tests/unit/bridge.test.ts` | Unit run used the 1/60-second bounded world and asserted finite, terminal outcomes | PASS |
| Semantic replay | Replay reconstructs from template/version/inputs, not frames | source, persisted run, network test | `src/shared/protocol.ts`; `src/worker/room/RoomDurableObject.ts`; `tests/e2e/bridge-manual.spec.ts` | Stored inputs/version were replayed while the browser network request count stayed unchanged | PASS |
| Server-side OpenAI | Key and SDK remain in Worker code only | dependency graph, bundle scan | `src/worker/ai/openai-responses.ts`; final client bundle scan | The server uses the key only in Worker code; tracked/history and built-client scans found no credential or OpenAI key reference | PASS |
| `store: false` | Responses call disables application-state storage | source and mocked request assertion | `src/worker/ai/openai-responses.ts`; `tests/unit/openai-responses.test.ts` | Exact request assertion passed with `store: false`, strict format, model, reasoning effort, and high-detail PNG | PASS |
| Timeout/retry policy | 24-second configurable budget and one bounded retry | source and failure tests | `src/worker/ai/openai-responses.ts`; `tests/unit/openai-responses.test.ts` | Timeout, network, 429, 5xx, refusal, malformed schema, semantic invalidity, ambiguous, unreadable, repair success, and repair exhaustion are bounded and categorized | PASS |
| Kill switch | `AI_ENABLED=false` exposes honest deterministic fallback | config, test, screenshot | `tests/integration/analysis-room.test.ts`; `tests/e2e/analysis-fallback.spec.ts` | Worker and browser tests expose an explicit manual fallback and retain the canvas without a fake AI result | PASS |
| Rate limits | Public endpoints have configured room/IP controls without judge friction | source/tests/config | `src/worker/security/rate-limit.ts`; `src/worker/room/RoomDurableObject.ts`; `tests/integration/analysis-room.test.ts` | Cloudflare burst protection plus authoritative configurable hourly SQLite counters passed per-room and per-IP integration assertions | PASS |
| Metadata-only logging | Logs omit work content, media, and capabilities | logging source and redacted sample | `src/worker/security/logging.ts`; build/source scan | Logger accepts only attempt ID, hashed room ID, model/response IDs, latency, repair use, category, upstream status, and bounded fetch-error diagnostics; request/image/result bodies are not log inputs | PASS |
| CI gate | Main deploy follows required checks | GitHub Actions run | CI `29804635232`; deploy `29804696808`; `.github/workflows/deploy.yml` | Deployment checked out `cb80021` only after its CI workflow completed successfully | PASS |
| Clean clone | Setup and validation work from fresh clone | recorded command log | artifact | Independent execution | PENDING |
| Rollback | Previous green Cloudflare version is known and rollback tested/documented | version IDs and drill | private evidence/report | Controlled rollback or dry verification | PENDING |

## Judging-criterion evidence

### Technological Implementation

| Claim | Evidence needed | Status |
|---|---|---|
| Multimodal handwriting is converted into safe structured simulation parameters | Real model call, strict schema, semantic validation, visible recognition card | PENDING |
| Realtime collaboration is persistent and role-aware | Two-context WebSocket/DO test, reload, permission assertions | PENDING |
| Physics is real and input-parameterized | Varying bridge length, Planck source, headless contract tests, no video switch | PENDING |
| Failure paths are designed rather than hidden | AI-disabled, invalid schema, renderer, reconnect tests | PENDING |
| Deployment is reproducible | Clean clone, CI, pinned lockfile, production URL | PENDING |

### Design

| Claim | Evidence needed | Status |
|---|---|---|
| First action is obvious | Five-second first-impression review and first-screen capture | PENDING |
| Task, reasoning, consequence, and retry remain in one coherent feed | Full path screenshot sequence/video | PENDING |
| Visual spectacle supports rather than obscures math | Causal explanation and visible values beside outcome | PENDING |
| Cross-device and accessible states exist | Responsive, keyboard, reduced-motion, transcript evidence | PENDING |
| Errors feel playful, not punitive | Copy review and user/reviewer response | PENDING |

### Potential Impact

| Claim | Evidence needed | Status |
|---|---|---|
| Tutors can turn a known gap into targeted visual practice | Teacher request-to-task production capture | PENDING |
| Learners can see and correct a specific misconception | Wrong/correction/success evidence | PENDING |
| The room supports live and between-session practice | Two-context collaboration and reload persistence | PENDING |
| Expansion is feasible across supported templates | At least one complete hero and any finished supporting family; source template contract | PENDING |

Do not claim measured learning improvement without a study.

### Quality of the Idea

| Claim | Evidence needed | Status |
|---|---|---|
| “The math is the controller” is clearly demonstrated | Hero video and varying submitted lengths | PENDING |
| Error itself becomes a memorable experiment | Disaster discovery plus successful retry | PENDING |
| AI use is necessary rather than decorative | Free-form alternate handwriting examples and structured interpretation | PENDING |
| The product is not a generic worksheet or physics game | Teacher context, causal loop, no direct game control | PENDING |

## Codex collaboration evidence

Record without revealing private chain-of-thought:

| Evidence item | Target | Status |
|---|---|---|
| Primary build session identity | `/feedback` Session ID in private submission record | PENDING |
| Source-of-truth read confirmation | Initial Codex response or build log | PENDING |
| Milestone commits | Git log mapped to `docs/05-IMPLEMENTATION-PLAN.md` | PENDING |
| Core functionality authored in session | Commit/file mapping | PENDING |
| Human decisions preserved | Decision log and README section | PASS for design; implementation cross-check pending |
| Codex validation behavior | CI/test fixes and STATUS updates | PENDING |
| Additional meaningful sessions | README disclosure if used | N/A until implementation |

Do not publish a private Session ID in a public repository unless submission rules require it publicly. Store it in the user's secure checklist and the Devpost field.

## GPT-5.6 evidence

Record:

- configured model ID;
- server source path;
- strict schema source path;
- real production response/request ID;
- redacted structured result;
- prepared handwriting screenshot;
- live-eval corpus description;
- accuracy, latency, retry, and fallback metrics;
- one alternate valid method;
- one unreadable/fallback example;
- proof that teacher marks were excluded;
- video timestamp showing recognition and explanation.

Do not publish raw identifiable work or API credentials.

## Screenshot targets

Capture from the exact submission release:

1. first guided teacher room;
2. learner hero task and prepared canvas;
3. teacher/learner realtime annotation;
4. GPT recognition card;
5. `4.08 m` short bridge failure;
6. causal error explanation and disaster discovery;
7. `9 m` successful crossing and progress achievement;
8. Replay controls;
9. manual fallback;
10. supported-skill list;
11. any completed supporting family;
12. mobile or tablet feed;
13. reduced-motion/text transcript;
14. production URL without capability fragment.

Crop or blur all room fragments, private tokens, personal content, browser extensions, and unrelated tabs.

## Video evidence targets

Final script must reference real behavior. Suggested evidence markers to replace after editing:

| Segment | Target evidence | Final timestamp |
|---|---|---|
| Hook | Short bridge failure | pending |
| Problem | Tutor identifies fraction gap | pending |
| Input | Free-form handwriting canvas | pending |
| GPT-5.6 | Structured interpretation and likely error | pending |
| Physics | Submitted value changes bridge length | pending |
| Correction | `0.75`, `9 m` | pending |
| Success | Crossing and progress award | pending |
| Collaboration | Teacher annotation visible to learner | pending |
| Reliability | Manual fallback or replay/reset | pending |
| Codex | Milestone/repository evidence | pending |

## Evidence collection procedure

After every completed milestone:

1. run required commands;
2. export test reports/traces;
3. record commit and deployment version;
4. capture only stable implemented UI;
5. update relevant rows;
6. leave status `PENDING` if verification is incomplete;
7. remove claims for cut scope;
8. keep evidence paths relative or use stable URLs;
9. never include a private capability fragment;
10. rerun affected evidence after later changes.

## Final audit

Before submission, filter this file for:

```text
PENDING
FAIL
```

Each remaining row must be:

- completed;
- explicitly `CUT`;
- or clearly `N/A` with a valid reason.

No broad submission claim may depend on a `PENDING` row.
