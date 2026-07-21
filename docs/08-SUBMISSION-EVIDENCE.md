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
| Judge URL | `https://lost-lessons-lab.sanocks.workers.dev/judge` | PASS for M2 room shell; full hero pending |
| Repository URL | `https://github.com/alexandr-panchenko/lost-lessons-lab` | PASS |
| Public video URL | pending | PENDING |
| Submission commit | pending | PENDING |
| Submission tag | `build-week-submission` pending | PENDING |
| Cloudflare deployment/version | M2 bootstrap `d5fc84fe-f6e8-4f66-b755-5c16a71c1dc4`; final M2 version pending | PENDING |
| Representative Codex Session ID | store in private submission checklist; pending | PENDING |
| OpenAI model ID observed in production | `gpt-5.6` planned; pending runtime evidence | PENDING |
| License | `LICENSE`, Apache-2.0 | PASS for design packet only |

## Milestone implementation evidence

| Milestone | Exact evidence | Verification | Status |
|---|---|---|---|
| M1 — reproducible environment | `package.json`; `bun.lock`; `wrangler.jsonc`; `.github/workflows/ci.yml`; `src/client/App.tsx`; `src/worker/index.ts`; `src/worker/room/RoomDurableObject.ts`; `tests/unit/environment.test.ts`; `tests/integration/worker.test.ts`; `tests/e2e/shell.spec.ts`; `scripts/finalize-build.ts` | On 2026-07-21, `bun install --frozen-lockfile` and every documented M1 command passed; `bun run validate` covered format, lint, strict types, 2 unit tests, 2 Cloudflare Worker/SQLite DO integration tests, production build, and 2 Chromium E2E tests. `git diff --check`, non-Markdown tracked/history scans, generated `.dev.vars` removal, actual-value artifact scan, and client-bundle scan passed. | PASS |
| M2 — deployable room shell | `src/worker/routes/rooms.ts`; `src/worker/room/RoomDurableObject.ts`; `src/worker/security/capabilities.ts`; `src/shared/protocol.ts`; `fixtures/judge-v1/fixture.ts`; `src/client/room/`; `src/client/feed/`; `tests/unit/capabilities.test.ts`; `tests/integration/rooms.test.ts`; `tests/e2e/room-shell.spec.ts`; `scripts/smoke-prod.ts`; `.github/workflows/deploy.yml` | On 2026-07-21, `bun run validate` passed 5 unit, 6 Worker/SQLite DO integration, and 3 Chromium E2E tests. Production smoke passed isolated `/judge` creation, teacher/student filtering, invalid-capability rejection, and security headers at the recorded URL. Final production browser run, commit, and deployment version pending. | PENDING |

## Eligibility and submission matrix

| Requirement / criterion | Claim | Exact evidence target | URL / file / video timestamp | Verification | Status |
|---|---|---|---|---|---|
| New or substantially new work | Core application is built during the competition period | Git history from initial design commit through submission tag | repository commit range | Compare timestamps and diff; summarize in README | PENDING |
| Education track fit | Product addresses tutor-guided correction of a specific math gap | Implemented teacher request, learner attempt, correction flow | production `/judge`; `docs/01-PRODUCT-BRIEF.md` is rationale only | Human judge run and video | PENDING |
| Substantive Codex use | Primary Codex session implements the majority of core functionality | Codex Session ID, commit authorship/log, milestone history, README build log | private Devpost field; README; Git history | Cross-check Session ID and commits | PENDING |
| Substantive GPT-5.6 use | GPT-5.6 reads free-form handwriting, returns structured steps and likely error | Production server config, real response ID, analysis card, live eval | source path; redacted log; video timestamp | Confirm model ID and real network path | PENDING |
| Working product | Production judge path completes wrong and correct attempts | Playwright production trace and manual capture | production URL; report path | Run in clean browser | PENDING |
| Free testing path | No login, payment, or BYOK | `/judge` in incognito; UI screenshot | JUDGING; video | Verify no credentials or payment | PENDING |
| Live URL | Cloudflare URL remains accessible | HTTP/smoke report | production URL | Independent clean request | PENDING |
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
| Fresh judge room | Every `/judge` visit creates a different real room | E2E test comparing two room IDs | `tests/e2e/*judge*`; production trace | Run twice in clean contexts | PENDING |
| Guided first screen | User understands next action within five seconds | First-screen screenshot and first-impression review | production `/judge`; review output | Independent reviewer response | PENDING |
| One-tab role flow | Teacher can preview learner without second browser | E2E and screen capture | production; video | Complete hero in one tab | PENDING |
| Real shared room | Separate teacher and learner links observe the same state | Two-context E2E trace | test report | Inspect synchronized events | PENDING |
| Realtime canvas | Learner stroke appears for teacher and teacher annotation appears for learner | Two-context Playwright test | report/video | Visual plus event assertions | PENDING |
| Teacher layer exclusion | Teacher annotations do not enter AI input | Unit raster fixture and intercepted/hashed E2E media | test file and report | Compare expected student-only raster | PENDING |
| Immutable attempt | Later strokes do not modify earlier attempt | unit/integration test and reload evidence | report | Reconstruct at source sequence | PENDING |
| One active analysis | Correction cannot submit until prior analysis finishes | integration/E2E test | report | Attempt duplicate/parallel request | PENDING |
| Real handwriting input | Prepared free-form work is an image rendered from canvas | visible attempt and media reference | production; source | Inspect UI and R2 metadata | PENDING |
| Visible interpretation | Recognition card shows transcription, steps, inputs, likely error | production screenshot/video | timestamp | Compare against structured result | PENDING |
| Strict Structured Output | Model response is parsed through closed schema | exact source and schema tests | source path/report | Code review plus invalid fixture test | PENDING |
| Deterministic validation | Arithmetic and units are checked outside GPT | bridge domain tests and source | source/report | Model-conflict fixture | PENDING |
| Wrong parameter controls physics | `4.08 m` creates actual short bridge geometry | source, physics test, production capture | timestamp/test | Inspect geometry/input and no video asset | PENDING |
| Safe comic failure | Vehicle enters recovery area without harmful presentation | production capture and transcript | timestamp | Human review | PENDING |
| Causal explanation | UI states how `0.34` created `4.08 m` | screenshot/video | timestamp | Read exact text | PENDING |
| Correction | Learner changes to `0.75` / `9 m` | production trace | timestamp | Complete second attempt | PENDING |
| Correct physics outcome | `9 m` produces successful crossing | physics test and production capture | timestamp/report | Inspect semantic outcome | PENDING |
| Achievements | Separate disaster and progress awards appear | source/test/screenshots | report/timestamps | Verify categories and no mastery claim | PENDING |
| Replay | Wrong and correct scenes replay without OpenAI request | Playwright network assertion | report | Replay and inspect requests | PENDING |
| Reset | Reset returns current judge task to fixture start | E2E and production test | report | Run button/path | PENDING |
| Persistence | Reload reconstructs visible feed and media | E2E plus production reload | report | Reload same room | PENDING |
| Manual fallback | AI-disabled or failed path accepts bridge length and runs same scene | failure E2E and production capture | report/timestamp | Disable AI in controlled env | PENDING |
| Text transcript | Simulation outcome is available as text | DOM assertion/screenshot | report | Disable renderer or inspect transcript | PENDING |
| Responsive feed | Desktop/tablet/phone use one continuous flow | viewport screenshots and E2E | report | Check no workflow tabs/overflow | PENDING |
| Accessible controls | Semantic controls, keyboard path, focus, reduced motion | accessibility E2E and manual check | report | Keyboard and reduced-motion run | PENDING |

## Technical implementation evidence

| Requirement / criterion | Claim | Exact evidence target | URL / file / video timestamp | Verification | Status |
|---|---|---|---|---|---|
| Cloudflare deployment | React SPA and API run in one Worker | Worker config and deployed headers | source; URL | Inspect config and production response | PENDING |
| Durable Object room | One SQLite-backed Durable Object owns room state | binding/config, source, integration tests | source/report | Object re-instantiation test | PENDING |
| Hibernation WebSockets | Realtime uses Durable Object Hibernation API | source and reconnect test | source/report | Code review and integration run | PENDING |
| Private R2 | Visible media stored privately and served through authorized Worker | binding, source, authorization test | source/report | Attempt unauthorized read | PENDING |
| Operation-log canvas | Strokes are simplified operations ordered by room sequence | source/unit/integration tests | source/report | Inspect stored event/delta | PENDING |
| Parameterized physics | PixiJS renders Planck world built from submitted values | source, tests, production | source/report/timestamp | Code review and varying-input capture | PENDING |
| Fixed-step and CCD | Simulation uses fixed step and continuous collision for fast body | source and stress test | source/report | Run extreme fixture | PENDING |
| Semantic replay | Replay reconstructs from template/version/inputs, not frames | source, persisted run, network test | source/report | Inspect data and replay | PENDING |
| Server-side OpenAI | Key and SDK remain in Worker code only | dependency graph, bundle scan | report/source | Search built client | PENDING |
| `store: false` | Responses call disables application-state storage | source and mocked request assertion | source/report | Test exact request options | PENDING |
| Timeout/retry policy | 24-second configurable budget and one bounded retry | source and failure tests | source/report | Inject timeout/429/5xx | PENDING |
| Kill switch | `AI_ENABLED=false` exposes honest deterministic fallback | config, test, screenshot | report/timestamp | Controlled production/preview drill | PENDING |
| Rate limits | Public endpoints have configured room/IP controls without judge friction | source/tests/config | report | Limit and normal path tests | PENDING |
| Metadata-only logging | Logs omit work content, media, and capabilities | logging source and redacted sample | source/report | Manual log inspection | PENDING |
| CI gate | Main deploy follows required checks | GitHub Actions run | workflow URL | Inspect job dependencies | PENDING |
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
