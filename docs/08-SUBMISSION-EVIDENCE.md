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
| Judge URL | `https://lost-lessons-lab.sanocks.workers.dev/judge` | PASS through Rescue R2; human visual approval pending |
| Repository URL | `https://github.com/alexandr-panchenko/lost-lessons-lab` | PASS |
| Public video URL | pending | PENDING |
| Local video upload candidate | `artifacts/submission/lost-lessons-lab-demo.mp4`; 1:41.95; SHA-256 `d48a1b2edb74cac0eca3fc7cbf870f245cfed61c36ac8b19f9e0119c511eefa6` | PASS locally; public upload pending |
| Submission commit | pending | PENDING |
| Submission tag | `build-week-submission` pending | PENDING |
| Cloudflare deployment/version | Rescue R2 `443a90cd-2777-480f-bb42-78a14940bb86` from commit `0476c04` | PASS technically; human visual approval pending |
| Representative Codex Session ID | store in private submission checklist; pending | PENDING |
| OpenAI model ID observed in production | `gpt-5.6-sol` | PASS |
| License | `LICENSE`, Apache-2.0; public GitHub metadata reports Apache-2.0 | PASS |

## Milestone implementation evidence

| Milestone | Exact evidence | Verification | Status |
|---|---|---|---|
| M1 — reproducible environment | `package.json`; `bun.lock`; `wrangler.jsonc`; `.github/workflows/ci.yml`; `src/client/App.tsx`; `src/worker/index.ts`; `src/worker/room/RoomDurableObject.ts`; `tests/unit/environment.test.ts`; `tests/integration/worker.test.ts`; `tests/e2e/shell.spec.ts`; `scripts/finalize-build.ts` | On 2026-07-21, `bun install --frozen-lockfile` and every documented M1 command passed; `bun run validate` covered format, lint, strict types, 2 unit tests, 2 Cloudflare Worker/SQLite DO integration tests, production build, and 2 Chromium E2E tests. `git diff --check`, non-Markdown tracked/history scans, generated `.dev.vars` removal, actual-value artifact scan, and client-bundle scan passed. | PASS |
| M2 — deployable room shell | Core commit `0c39b42`; delivery fixes through `c906082`; Cloudflare version `b2b3b725-b3ab-48e5-8f80-8eedf46f6bb3`; CI run `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29802489533`; deploy/smoke run `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29802536234`; `src/worker/routes/rooms.ts`; `src/worker/room/RoomDurableObject.ts`; `src/worker/security/capabilities.ts`; `src/shared/protocol.ts`; `fixtures/judge-v1/fixture.ts`; `src/client/room/`; `src/client/feed/`; `tests/unit/capabilities.test.ts`; `tests/integration/rooms.test.ts`; `tests/e2e/room-shell.spec.ts`; `scripts/smoke-prod.ts`; `.github/workflows/deploy.yml` | On 2026-07-21, `bun run validate` passed 5 unit, 6 Worker/SQLite DO integration, and 3 Chromium E2E tests. Three clean-context production Chromium tests passed. CI run `29802489533` passed validation and secret scan; gated deploy run `29802536234` deployed the validated commit and passed isolated `/judge` creation, teacher/student filtering, invalid-capability rejection, and protected room headers. | PASS |
| M3 — realtime canvas and deterministic bridge | Core commit `b76eede`; strict-CSP delivery fix `cb80021`; Cloudflare version `71f9ffc7-9423-413f-a52e-4ccac07ff6c4`; CI `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29804635232`; deploy/smoke `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29804696808`; `src/shared/canvas.ts`; `src/shared/domain/bridge.ts`; `src/client/canvas/`; `src/client/simulation/`; `src/simulations/bridge/bridge-world.ts`; `src/worker/room/RoomDurableObject.ts`; `tests/unit/canvas.test.ts`; `tests/unit/bridge.test.ts`; `tests/integration/canvas-room.test.ts`; `tests/e2e/bridge-manual.spec.ts`; `tests/e2e/realtime.spec.ts`; `tests/e2e/responsive.spec.ts`; `docs/evidence/m3/` | On 2026-07-21, the local gate passed 18 unit, 9 Worker/SQLite DO integration, build, and 11 Chromium E2E tests. CI run `29804635232` repeated the full gate and secret scan. Deploy run `29804696808` passed production smoke. A clean production browser run passed all 11 tests, including real PixiJS canvas assertions under strict CSP, two-context layers, reconnect/idempotent resend, immutable cutoff, `4.08 m` recovery, `9 m` crossing, replay without API traffic, reload, three viewports, and reduced motion. The three cropped production screenshots were visually inspected and contain no capability. | PASS |
| M4 — GPT-5.6 handwriting interpretation | Core commit `969f99d`; Worker fetch delivery fix `42ae639`; Cloudflare version `4df2792d-c731-4f05-946b-000671de227e`; CI `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29807921144`; deploy/smoke `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29807995100`; `src/worker/ai/`; `src/worker/routes/attempts.ts`; `src/shared/analysis-types.ts`; `src/shared/validation/bridge-analysis.ts`; `src/client/canvas/student-raster.ts`; `src/client/feed/AnalysisCard.tsx`; `tests/live-ai/`; `scripts/verify-production-ai.ts`; `docs/evidence/m4/analysis-wrong.png` | On 2026-07-21, the final local gate passed 39 unit, 13 Worker/SQLite DO/R2 integration, build, and 12 mocked Chromium tests. The opt-in two-image live gate extracted wrong and correct hero inputs exactly on first responses in 4.55s and 4.23s. After CI and gated deployment, repeated production samples extracted `0.34` and `4.08 m` on first responses in 5.14s, 5.70s, and 8.59s; each persisted a deterministic short-bridge run, denied unauthenticated media, loaded authorized private R2 media, and rendered without console errors. The cropped recognition card was visually inspected and contains no capability. | PASS |
| M5 — complete hero and judge flow | Core commit `80d93aa`; verification commit `892791e`; Cloudflare version `3143b924-6be1-4436-aa62-167e4ef25e1d`; CI `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29810106237`; deploy/smoke `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29810212998`; `src/shared/judge-handwriting.ts`; `src/worker/domain/achievements.ts`; `src/worker/routes/reset.ts`; `src/client/feed/PreparedCorrectionPanel.tsx`; `src/client/feed/AchievementCard.tsx`; `scripts/verify-production-hero.ts`; `docs/evidence/m5/hero-wrong-to-correct.png` | On 2026-07-21, final validation passed 42 unit, 15 Worker/SQLite DO/R2 integration, build, and 12 Chromium tests. The live gate extracted both frozen samples exactly on first GPT-5.6 responses in 4.62s and 5.06s. All 12 tests passed again against production. A clean reduced-motion production browser made exactly two real AI requests, extracted `0.34` / `4.08 m` and `0.75` / `9 m`, rendered both physics outcomes and separate awards, replayed without AI, restored both runs after reload, and reset the same room to prepared state. The final post-propagation smoke passed. | PASS |
| Rescue R2 — wrong bridge catastrophe | Commit `0476c04`; Cloudflare version `443a90cd-2777-480f-bb42-78a14940bb86`; CI `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29843521120`; deploy/smoke `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29843719410`; `src/simulations/bridge/bridge-world.ts`; `src/client/simulation/BridgeSimulation.tsx`; `src/client/accessibility/useSimulationSound.ts`; `tests/unit/bridge.test.ts`; `tests/e2e/bridge-manual.spec.ts`; `tests/e2e/responsive.spec.ts`; `tests/e2e/accessibility.spec.ts`; `scripts/verify-rescue-r2.ts`; `scripts/capture-rescue-r2.ts`; `docs/evidence/r2/wrong-bridge-before-run.png`; `docs/evidence/r2/wrong-bridge-catastrophe-climax.png`; `docs/evidence/r2/wrong-bridge-complete-run.webm` | On 2026-07-21, the complete local gate and CI passed format, lint, strict types, 67 unit tests, 22 Worker/SQLite DO/R2 integration tests, build, secret audit, and 22 Chromium tests. Broad physics contracts verified at least 10 bodies and 10 joints, load before break, four destroyed bridge joints, a wheel leaving the deck, deck rotation, chassis rotation over 1.2 radians, and water entry without exact-coordinate assertions. Focused browsers verified replay without a new request, the full reduced-motion meaning, fallback/low-detail paths, and opt-in break/suspension/splash sounds. The gated deployment and baseline production smoke passed. The focused production verifier observed deploying, driving, failing, falling, splash, and aftermath in 14.10 seconds at 28.6 fps average / 50.1 ms p95 under software-rendered headless Chromium, then repeated replay-without-request and reduced-motion checks. The final production 1440×1000 before/climax frames and 21.56-second VP8 capture were visually inspected; the video includes setup context around the 14.10-second scene. Technical gates pass; human visual approval remains pending. | PASS technically; human review pending |
| S1 — water and volume family | Core commit `c586be7`; verified-entry commit `5508df4`; verifier commit `f436986`; Cloudflare version `398a8f5c-9cc7-4887-9b85-b0f641cfbca4`; CI `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29813159173`; deploy/smoke `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29813260681`; `src/shared/domain/water.ts`; `src/shared/validation/water-analysis.ts`; `src/simulations/water/water-world.ts`; `fixtures/water/packs.ts`; `scripts/verify-production-water.ts`; `docs/evidence/s1/water-correct-and-overflow.png` | On 2026-07-21, the final local gate passed 49 unit, 17 Worker/SQLite DO/R2 integration, build, and 13 Chromium tests; CI repeated the gate and secret scan. All 13 browser paths passed against the final production version, including the enabled skill link and unchanged hero. Repeated clean production runs each made one real AI request; the final strengthened verifier explicitly asserted visible `gpt-5.6-sol`, exact `3 L/min`, `5 min`, and `15 L`, the deterministic correct level and separate manual `24 L` bounded overflow with distinct awards, replay without AI, persistence across reload, and reset to prepared ink. The production capture was visually inspected and contains no capability. | PASS |
| S2 — speed, time, and collision family | Core commit `2a5ffbb`; verified-entry commit `fa857d3`; Cloudflare version `33e4f9eb-a13b-427d-b01c-464d353a827e`; CI `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29814757030`; deploy/smoke `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29814874095`; `src/shared/domain/speed.ts`; `src/shared/validation/speed-analysis.ts`; `src/simulations/speed/speed-world.ts`; `fixtures/speed/packs.ts`; `scripts/verify-production-speed.ts`; `docs/evidence/s2/speed-correct-and-collision.png` | On 2026-07-21, the final local gate passed 55 unit, 19 Worker/SQLite DO/R2 integration, build, and 14 Chromium tests; CI repeated the gate and secret scan. All 14 browser paths passed against the final production version at bounded concurrency, including the enabled speed link and unchanged hero/water flows. Repeated clean production runs each made one real AI request and explicitly asserted visible `gpt-5.6-sol`, exact `8 m/s`, `3 s`, and `24 m`, deterministic target arrival and a separate manual `36 m` soft-bumper collision with distinct awards, replay without AI, persistence across reload, and reset to prepared ink. The extreme headless CCD case contacted the bumper without tunneling. The production capture was visually inspected and contains no capability. | PASS |
| S3 — structure, load, and destruction family | Core commit `81af212`; verified-entry commit `5942254`; Cloudflare version `d536c44d-5f34-4e00-b528-47a8347ffcd0`; CI `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29817214716`; deploy/smoke `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29817376261`; `src/shared/domain/structure.ts`; `src/shared/validation/structure-analysis.ts`; `src/simulations/structure/structure-world.ts`; `fixtures/structure/packs.ts`; `scripts/verify-production-structure.ts`; `docs/evidence/s3/structure-stable-and-collapse.png` | On 2026-07-21, the final local gate passed 61 unit, 21 Worker/SQLite DO/R2 integration, build, and 15 Chromium tests; CI repeated the gate and secret scan. All 15 browser paths passed against the enabled production version at bounded concurrency, including the structure skill link and unchanged hero/water/speed flows. Repeated clean production runs each made one real AI request and explicitly asserted visible `gpt-5.6-sol`, exact 12 items, 5 kg per item, and 60 kg total, the deterministic stable platform and a separate manual 90 kg bounded 12-fragment collapse with distinct awards, replay without AI, persistence across reload, and reset to prepared ink. Repeated headless worlds settled with finite positions and explicit teardown. The production capture was visually inspected and contains no capability. | PASS |
| M6 — reliability, fallbacks, and cost controls | Core commit `3c9afce`; low-detail delivery correction `bb43e2f`; verifier correction `59e6f62`; Cloudflare version `7171964a-e712-442a-8051-ae52c3fd6ec3`; CI `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29820119859`; deploy/smoke `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29820306932`; `src/worker/media/attempt-media.ts`; `src/worker/security/logging.ts`; `src/worker/room/RoomDurableObject.ts`; `src/simulations/core/render-quality.ts`; `tests/unit/reliability-controls.test.ts`; `tests/integration/analysis-room.test.ts`; `tests/e2e/failure-recovery.spec.ts`; `scripts/verify-production-fallback.ts`; `docs/evidence/m6/ai-disabled-manual-recovery.png` | On 2026-07-21, the final local gate passed 65 unit, 22 Worker/SQLite DO/R2 integration, build, and 19 Chromium tests; CI repeated the gate and secret scan. All 19 browser paths passed against the corrected production version. The opt-in wrong/correct live gate extracted the exact hero values on first GPT-5.6 responses in 5.16s and 4.45s without repair. A production browser then injected exactly one honest client-visible `ai_disabled` response without changing Worker configuration or making that OpenAI request, completed manual `4.08 m` and `9 m` physics runs, restored both after reload, and reset the fixture. A separate clean production run made exactly two real GPT-5.6 requests, extracted `0.34` / `4.08 m` and `0.75` / `9 m`, persisted both outcomes across reload, and reset successfully. The fallback capture was visually inspected and contains no capability. | PASS |
| M7 — design polish and accessibility | Core commit `b990abe`; verifier correction `c2ab48a`; Cloudflare version `14d54119-b3ac-464f-8745-aea8025dd08a`; CI `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29822165434`; deploy/smoke `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29822327473`; `src/client/accessibility/useSimulationSound.ts`; `src/client/styles.css`; `src/client/simulation/BridgeSimulation.tsx`; `tests/e2e/accessibility.spec.ts`; `scripts/verify-production-accessibility.ts`; `docs/evidence/m7/desktop-first-screen.png`; `docs/evidence/m7/tablet-first-screen.png`; `docs/evidence/m7/phone-first-screen.png`; `docs/evidence/m7/reduced-motion-transcript.png`; `THIRD_PARTY_NOTICES.md` | On 2026-07-21, final local validation passed 65 unit, 22 Worker/SQLite DO/R2 integration, build, and 21 Chromium tests; CI repeated the gate and secret scan. All 21 paths passed against the production M7 runtime. The production accessibility verifier confirmed one non-overflowing feed at 1280×900, 768×1024, and 390×844, first-focus keyboard skip without capability-fragment mutation, visible connected state, and a reduced-motion result with the same transcript. Automated browser coverage also verified a polite live update, descriptive canvas instructions, color-independent student-layer text, sound muted without an AudioContext before interaction, synthesized opt-in tone, and mute. A separate production run completed two real GPT-5.6 hero attempts, reload, and reset without a reproducible console error. The client entry was 323.05 kB / 94.89 kB gzip. All four final-version captures were visually inspected and contain no capability; visuals and tones are original code-generated primitives with no external media asset. | PASS |
| M8 — E2E, security, and deployment verification | Core commit `eef7c03`; clean-install correction `154feb9`; canonical-audit correction `951c978`; Cloudflare version `968d9590-25e6-4a6d-8ea6-e6b12febb9be`; rollback target `c680b97d-7577-465c-93fd-31ddbda51e0f`; CI `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29824539151`; deploy/smoke `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29824698851`; `bunfig.toml`; `scripts/secret-audit.ts`; `scripts/verify-production-security.ts`; `scripts/verify-production-hero.ts`; `scripts/verify-production-ai.ts` | On 2026-07-21, a fresh clone reconstructed 197 locked packages with the literal `bun install --frozen-lockfile`, then passed formatting, lint, strict types, 65 unit tests, 22 Worker/SQLite DO/R2 integration tests, build, secret audit, and 21 Chromium tests. CI repeated the full gate. All 21 isolated browser paths passed against production with two workers. Live eval extracted both frozen samples without repair in 7.06s and 5.78s. The literal production judge verifier made exactly two real GPT-5.6 calls and completed wrong/correct physics, replay, reload, and reset. The separate production AI verifier extracted `0.34` / `4.08 m` in 4.53s without repair, denied unauthenticated R2 media, and loaded authorized media. Focused fallback, accessibility, HTTP, and security audits passed; tracked files, history, 27 build files, client bundle, and source-map checks found no secret or capability. Wrangler retained the immediately previous fully green version as a dry-verified rollback target. No P0/P1 issue was found. | PASS |
| M9 — preparatory submission media | Commit `8ea744b`; CI `https://github.com/alexandr-panchenko/lost-lessons-lab/actions/runs/29827184287`; `docs/evidence/m9/submission-thumbnail.png`; `docs/evidence/m9/thumbnail-provenance.md`; `docs/evidence/m9/video-narration.txt`; `docs/evidence/m9/video-captions.srt`; `scripts/capture-submission-video.ts`; `scripts/build-submission-video.sh`; `scripts/verify-submission-media.ts` | The local gate passed formatting, lint, strict types, 65 unit tests, 22 Worker/SQLite DO/R2 integration tests, build, tracked-source audit, 21 Chromium tests, and the media verifier. CI run `29827184287` repeated the complete validation and tracked-source secret scan. The ignored upload candidate was measured at 101.95 seconds, 1280×720 H.264/AAC with an embedded `mov_text` caption stream, and SHA-256 `d48a1b2edb74cac0eca3fc7cbf870f245cfed61c36ac8b19f9e0119c511eefa6`. This is preparatory evidence only; the public URL, final freeze commit, and tag remain pending. | PASS locally; M9 remains in progress |

## Eligibility and submission matrix

| Requirement / criterion | Claim | Exact evidence target | URL / file / video timestamp | Verification | Status |
|---|---|---|---|---|---|
| New or substantially new work | Core application is built during the competition period | Git history from initial design commit through submission tag | commits `07d27b5` through M8 close `2b4e60b`, all dated 2026-07-21 | `git log --reverse` and README commit mapping were reviewed; the final tag remains pending external submission assets | PASS through M8 |
| Education track fit | Product addresses tutor-guided correction of a specific math gap | Implemented teacher request, learner attempt, correction flow | production `/judge`; `scripts/verify-production-hero.ts`; `docs/evidence/m5/hero-wrong-to-correct.png` | The production verifier completed tutor-guided fraction error, explanation, correction, and retry without a mastery claim | PASS |
| Substantive Codex use | Primary Codex session implements the majority of core functionality | Codex Session ID, commit authorship/log, milestone history, README build log | private Devpost field; README; Git history | Cross-check Session ID and commits | PENDING |
| Substantive GPT-5.6 use | GPT-5.6 reads free-form handwriting, returns structured steps and likely error | Production server config, real response ID, analysis card, live eval | `src/worker/ai/openai-responses.ts`; `tests/live-ai/bridge-live.test.ts`; `docs/evidence/m4/analysis-wrong.png`; production response suffix `44401dc4` | Live and production paths reported `gpt-5.6-sol`; exact extracted values and visible likely error were independently asserted | PASS |
| Working product | Production judge path completes wrong and correct attempts | Playwright production trace and manual capture | `scripts/verify-production-hero.ts`; `docs/evidence/m5/hero-wrong-to-correct.png` | Clean production browser completed both real-AI attempts, physics outcomes, awards, reload, and reset | PASS |
| Free testing path | No login, payment, or BYOK | `/judge` in clean browser; UI screenshot | `JUDGING.md`; `docs/evidence/m5/hero-wrong-to-correct.png` | Clean production contexts entered isolated rooms without credentials, payment, or user API key | PASS |
| Live URL | Cloudflare URL remains accessible | HTTP/smoke report | `https://lost-lessons-lab.sanocks.workers.dev`; deploy run `29810212998` | Gated and post-propagation smoke passed | PASS |
| Video under 3 minutes | Public narrated English video is shorter than 3:00 | YouTube duration and public access | video URL | Open incognito; record duration | PENDING |
| Repository available | Public repo or organizer-accessible private repo | Repository settings and URL | `https://github.com/alexandr-panchenko/lost-lessons-lab` | `gh repo view` reported `PUBLIC`, default branch `main`, and Apache-2.0 metadata on 2026-07-21 | PASS |
| Suitable license | Repository includes Apache-2.0 | `LICENSE` | repository root | Compare to official Apache text | PASS |
| English materials | UI, README, judging, video/subtitles, Devpost are English | Final production and documents | multiple | Manual review | PENDING |
| No secrets | No API keys/tokens/private links in tracked files, bundle, logs, video | secret-scan output and manual review | CI artifact; report | Run scan on submission commit | PENDING |
| License compliance | Dependencies and assets have verified licenses | lockfile audit, `THIRD_PARTY_NOTICES.md`, asset provenance | `bun.lock`; `THIRD_PARTY_NOTICES.md`; README original-media statement | Locked direct dependencies were reviewed as MIT/Apache-2.0-compatible; visuals and Web Audio tones are original code-generated primitives with no third-party media | PASS |
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
| Accessible controls | Semantic controls, keyboard path, focus, reduced motion | accessibility E2E and production verifier | `tests/e2e/accessibility.spec.ts`; `scripts/verify-production-accessibility.ts`; `docs/evidence/m7/` | The final production verifier passed keyboard skip, visible state, desktop/tablet/phone layouts, reduced-motion transcript, opt-in synthesized sound, and mute behavior | PASS |

## Technical implementation evidence

| Requirement / criterion | Claim | Exact evidence target | URL / file / video timestamp | Verification | Status |
|---|---|---|---|---|---|
| Cloudflare deployment | React SPA and API run in one Worker | Worker config and deployed headers | `wrangler.jsonc`; Cloudflare version `968d9590-25e6-4a6d-8ea6-e6b12febb9be` | Gated deploy and production smoke run `29824698851` passed for commit `951c978` | PASS |
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
| CI gate | Main deploy follows required checks | GitHub Actions run | CI `29824539151`; deploy `29824698851`; `.github/workflows/deploy.yml` | Deployment checked out `951c978` only after its 65-unit, 22-integration, build, audit, and 21-browser validation completed successfully | PASS |
| Clean clone | Setup and validation work from fresh clone | recorded command log | `bunfig.toml`; commit `154feb9`; CI `29824539151` | A fresh `/tmp` clone installed 197 locked packages with the literal canonical command and passed the complete validation gate; CI independently repeated it | PASS |
| Rollback | Previous green Cloudflare version is known and rollback tested/documented | version IDs and dry drill | current `968d9590-25e6-4a6d-8ea6-e6b12febb9be`; rollback `c680b97d-7577-465c-93fd-31ddbda51e0f`; `docs/07-SECURITY-COST-AND-DEPLOYMENT.md` | `wrangler versions list` confirmed both retained versions; the target had already passed all 21 production browser paths before the final script-only deployment, so no traffic-changing rollback was performed | PASS |

## Judging-criterion evidence

### Technological Implementation

| Claim | Evidence needed | Status |
|---|---|---|
| Multimodal handwriting is converted into safe structured simulation parameters | `scripts/verify-production-ai.ts`; `src/shared/analysis-types.ts`; `src/shared/validation/bridge-analysis.ts`; `docs/evidence/m4/analysis-wrong.png` | PASS |
| Realtime collaboration is persistent and role-aware | `tests/e2e/realtime.spec.ts`; `tests/e2e/room-shell.spec.ts`; final 21-path production run | PASS |
| Physics is real and input-parameterized | `src/simulations/bridge/bridge-world.ts`; `tests/unit/bridge.test.ts`; `docs/evidence/m3/bridge-4.08-failure.png`; `docs/evidence/m3/bridge-9-success.png` | PASS |
| Failure paths are designed rather than hidden | `tests/e2e/failure-recovery.spec.ts`; `scripts/verify-production-fallback.ts`; `docs/evidence/m6/ai-disabled-manual-recovery.png` | PASS |
| Deployment is reproducible | `bunfig.toml`; CI `29824539151`; deploy `29824698851`; clean-clone M8 evidence | PASS |

### Design

| Claim | Evidence needed | Status |
|---|---|---|
| First action is obvious | Five-second first-impression review and first-screen capture | PENDING |
| Task, reasoning, consequence, and retry remain in one coherent feed | `docs/evidence/m5/hero-wrong-to-correct.png`; `scripts/verify-production-hero.ts` | PASS |
| Visual spectacle supports rather than obscures math | `docs/evidence/m4/analysis-wrong.png`; deterministic input/result text assertions in `tests/e2e/bridge-manual.spec.ts` | PASS |
| Cross-device and accessible states exist | `docs/evidence/m7/`; `scripts/verify-production-accessibility.ts`; `tests/e2e/accessibility.spec.ts` | PASS |
| Errors feel playful, not punitive | `docs/evidence/m3/bridge-4.08-failure.png`; `src/worker/domain/achievements.ts`; copy assertions in unit/E2E tests | PASS |

### Potential Impact

| Claim | Evidence needed | Status |
|---|---|---|
| Tutors can turn a known gap into targeted visual practice | production `/judge`; `docs/evidence/m7/desktop-first-screen.png`; `scripts/verify-production-hero.ts` | PASS |
| Learners can see and correct a specific misconception | `docs/evidence/m5/hero-wrong-to-correct.png`; final literal production judge run | PASS |
| The room supports live and between-session practice | `tests/e2e/realtime.spec.ts`; reload persistence in `scripts/verify-production-hero.ts` | PASS |
| Expansion is feasible across supported templates | Complete bridge, water, speed, and structure milestone rows; shared template/domain contracts | PASS |

Do not claim measured learning improvement without a study.

### Quality of the Idea

| Claim | Evidence needed | Status |
|---|---|---|
| “The math is the controller” is clearly demonstrated | Local 1:41.95 candidate at 0:00–1:41; production capture and varying submitted lengths; public URL pending | PASS locally; submission-wide proof pending upload |
| Error itself becomes a memorable experiment | `docs/evidence/m5/hero-wrong-to-correct.png`; disaster/progress achievement tests | PASS |
| AI use is necessary rather than decorative | Two-image live eval; strict structured interpretation card; teacher-layer exclusion tests | PASS |
| The product is not a generic worksheet or physics game | Persistent teacher context, learner canvas, causal explanation, and math-only simulation inputs in final production path | PASS |

## Codex collaboration evidence

Record without revealing private chain-of-thought:

| Evidence item | Target | Status |
|---|---|---|
| Primary build session identity | `/feedback` Session ID in private submission record | PENDING |
| Source-of-truth read confirmation | Initial Codex response or build log | PENDING |
| Milestone commits | README Codex mapping; `STATUS.md`; commits `7c5b502`, `0c39b42`, `b76eede`, `969f99d`, `80d93aa`, `3c9afce`, `b990abe`, `eef7c03` | PASS |
| Core functionality authored in session | Commit/file mapping | PENDING |
| Human decisions preserved | `docs/03-DECISION-LOG.md`; README human decisions and Codex collaboration sections; implemented deterministic/AI and cut boundaries | PASS |
| Codex validation behavior | `STATUS.md`; milestone evidence rows; CI/deploy run sequence; corrective commits after failed gates | PASS |
| Additional meaningful sessions | README disclosure: no additional implementation session or delegated agent was used | N/A |

The internal eligibility, rubric, and provisional first-impression review is
recorded in `docs/evidence/m9/internal-release-review.md`. It explicitly does
not substitute for the final independent review, public video, private Session
ID, or Devpost confirmation.

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
| Hook | `3/4 = 0.34` points to the short bridge | 0:00–0:11 |
| Problem | No-login shared tutoring room and precise gap | 0:11–0:21 |
| Input | Free-form prepared learner canvas | 0:11–0:26 |
| GPT-5.6 | Structured interpretation and likely error | 0:21–0:38 |
| Physics | Submitted value changes real bridge geometry | 0:38–0:54 |
| Correction | `0.75`, `9 m` | 0:54–1:08 |
| Success | Crossing and progress award | 1:08–1:22 |
| Collaboration | Separate teacher layer shown and explained | 1:08–1:15 |
| Reliability | Replay, reload, and manual fallback explained | 1:08–1:22 |
| Codex | Milestone workflow and deployed architecture explained | 1:22–1:41 |

The upload candidate was recorded page-only from Cloudflare version
`968d9590-25e6-4a6d-8ea6-e6b12febb9be` by
`scripts/capture-submission-video.ts`. It made exactly two real analysis
requests. `scripts/build-submission-video.sh` produced a 1280×720 H.264/AAC MP4
with an embedded English `mov_text` caption stream and a matching `.srt`
sidecar. `ffprobe` measured 101.950 seconds and 3,793,357 bytes. Sampled frames,
the title/end frames, binary string scan, narration, and captions were inspected;
no capability, secret, URL token, or personal data was found. Public YouTube
upload and incognito playback remain owner-controlled.

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
