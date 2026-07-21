# 06 — Test plan

## Purpose

Testing exists to prove the exact judge path, not merely code coverage.

The test strategy must answer:

1. Is the mathematical result correct?
2. Did GPT output pass strict and semantic validation?
3. Did teacher work stay out of the learner attempt?
4. Did the submitted value actually parameterize real physics?
5. Can the product recover from AI, network, storage, and renderer failure?
6. Can a clean browser complete the experience without login or credentials?
7. Does the production URL match the repository and submission claims?

## Test layers

```text
Pure unit tests
→ simulation contract tests
→ Worker and Durable Object integration tests
→ deterministic mocked browser E2E
→ live GPT-5.6 evaluation
→ production smoke and human QA
```

No single layer replaces another.

## Canonical commands

Milestone 1 must provide:

```bash
bun run test:unit
bun run test:integration
bun run test:e2e
bun run test:live-ai
bun run validate
bun run smoke:prod
```

`test:live-ai` must be opt-in and must never run automatically on an untrusted pull request.

## Unit tests

### Mathematical domain

For every enabled template:

- correct solution derivation;
- fractions and decimal normalization;
- unit normalization;
- percentages and proportions;
- finite-number checks;
- bounds;
- rounding policy;
- multiple required inputs;
- correct/incorrect outcome classification;
- explanation data;
- achievement progression.

Hero bridge cases:

| Case | Expected |
|---|---|
| `12 × 3/4` | `9 m`, correct |
| submitted `4.08 m` | incorrect, `bridge_far_too_short` |
| submitted `9 m` | correct, `bridge_correct` |
| `NaN`, `Infinity`, empty | rejected |
| negative bridge length | rejected |
| implausibly huge length | rejected or bounded by template |
| decimal comma recognized as text | normalized or marked ambiguous according to explicit policy |

Do not compare floating values with exact equality where a tolerance is appropriate.

### Task planner and template validation

- supported request maps only to an enabled template;
- unsupported request returns alternatives;
- unknown skill/template rejected;
- parameters stay inside visual and mathematical ranges;
- task has a unique expected answer;
- generated wording does not contain the answer;
- curated fallback pack always validates.

### OpenAI schemas

Test strict parsing for:

- valid `solution-analysis.v1`;
- unknown fields;
- missing nullable fields;
- invalid enums;
- excessive string/array length;
- non-finite values after parse;
- missing scenario input;
- wrong unit;
- contradictory final answer and scenario input;
- unreadable;
- ambiguous;
- refusal-safe response;
- repair success;
- repair failure.

### Canvas

- coordinate normalization;
- point simplification preserves endpoints;
- simplification caps point count;
- spline rendering is deterministic for a fixture;
- pressure normalization;
- finite coordinates only;
- add/delete/restore/clear reducers;
- duplicate `clientOperationId` ignored;
- server sequence ordering;
- layer filtering;
- student-only raster excludes teacher and system strokes;
- attempt cutoff reconstructs old student state after later edits;
- undo/redo creates valid operations rather than corrupting history.

### Capability permissions

- teacher and learner hashes verify correctly;
- raw token is never stored;
- invalid token rejected;
- learner cannot read private teacher events;
- learner cannot create tasks or teacher annotations;
- teacher preview can invoke learner commands through the explicit preview path;
- capability is not returned in logs or serialized room state.

### Room state machine

- valid transition sequence;
- attempt lock acquisition;
- second submission rejected while analysis active;
- lock release on success;
- lock release on timeout;
- lock release on thrown exception;
- reset returns to fixture/task start;
- stale status cannot overwrite a completed result;
- invalid or discarded-namespace rooms return a safe not-found response.

### Achievements

- disaster and progress categories remain separate;
- one event is not awarded twice after reconnect;
- one correct answer never creates a mastery claim;
- repeated-success thresholds are exact;
- intentional wrong attempts can earn discoveries without advancing progress thresholds.

## Simulation contract tests

Run the domain outcome and Planck world headlessly, without relying on a screenshot.

For each fixture:

1. validate task parameters;
2. derive correct solution;
3. validate submitted inputs;
4. classify semantic outcome;
5. construct the world;
6. advance a bounded number of fixed steps;
7. collect broad semantic and health assertions.

Required health assertions:

- no body transform contains `NaN` or infinity;
- body count stays below template cap;
- object positions stay within broad world bounds;
- scene reaches a terminal or settled state within its maximum duration;
- no critical fast body tunnels through required collision geometry;
- world teardown releases references;
- repeated construction does not leak timers or listeners.

Use broad outcome assertions:

```text
Good:
vehicle entered ravine recovery region
vehicle reached far-side success region
bulk water level exceeded overflow threshold
structure produced bounded fragment set

Bad:
wheel x coordinate equals 12.384942 at frame 723
every fragment follows the same exact path on every replay
```

### Bridge fixture matrix

At minimum:

- far too short;
- slightly short;
- exact correct;
- acceptable tolerance if intentionally defined;
- too long;
- minimum safe value;
- maximum permitted value;
- fast-vehicle CCD stress case;
- reduced-motion presentation;
- replay with and without optional seed.

### Supporting family gates

A family is disabled unless it has:

- mathematical unit tests;
- curated fixture validation;
- correct and misconception outcomes;
- physics health tests;
- accessible transcript tests;
- browser E2E;
- production smoke evidence.

## Worker and Durable Object integration tests

Use the current Cloudflare Workers Vitest integration.

### Room creation and bootstrap

- `/` creates and redirects;
- `/judge` creates from `judge-v1`;
- two `/judge` requests create different room IDs;
- teacher and learner capabilities retrieve filtered views;
- invalid token receives no state;
- bootstrap is `no-store`;
- room reload reconstructs feed.

### SQLite persistence

- room metadata persists across object re-instantiation;
- feed events keep order;
- operations keep sequence;
- duplicate operation remains idempotent;
- attempts are immutable;
- analysis and run references survive reload;
- current task and active lock survive constructor re-entry;
- room state does not rely on process memory.

### WebSocket

- unauthenticated socket receives no room state;
- successful teacher and learner authentication;
- accepted stroke acknowledged and broadcast;
- role permission rejection;
- reconnect with `lastSeenSeq`;
- delta response;
- snapshot fallback;
- duplicate resend;
- pending operation reconciliation;
- Hibernation attachment contains no raw capability;
- teacher hint reaches learner;
- private teacher setup never reaches learner.

If the Cloudflare test pool requires a single worker or disabled isolation for Durable Object WebSocket tests, create a dedicated documented command rather than skipping the test.

### Attempts and R2

- valid media content and dimensions;
- extension/MIME mismatch rejected;
- file over limit rejected;
- content hash stored;
- visible object written to R2;
- no analysis if R2 write fails;
- authorized media read;
- unauthorized media read denied;
- source sequence belongs to task/workspace;
- student layer only;
- active analysis lock enforced;
- manual fallback accepted through same template validator.

### AI orchestration with fixtures

- success;
- timeout;
- network error;
- 429;
- 5xx;
- malformed schema;
- schema-valid semantic invalidity;
- one repair success;
- one repair failure;
- ambiguous;
- unreadable;
- GPT/validator disagreement;
- `AI_ENABLED=false`;
- no automatic hidden retry beyond policy;
- `store: false` included;
- result and status events persist;
- lock releases in every terminal path;
- raw response body not logged.

### Rate limiting

- ordinary judge path is not limited;
- per-room limit;
- per-IP AI limit;
- room-creation limit;
- limit response preserves room state;
- configuration overrides work;
- limit cannot be bypassed by malformed request;
- kill switch works independently of limit.

## Browser E2E with Playwright

CI E2E uses deterministic model fixtures unless a test is explicitly in the live suite.

### E2E-01 — Full judge hero

1. Open `/judge`.
2. Confirm a unique room route opens directly in the real student capability.
3. Confirm the compact Student lesson / Teacher setup switch works in the same tab.
4. Confirm the task, empty canvas, and secondary **Load sample mistake** control.
5. Load the sample and press **Run my solution**.
6. Confirm staged statuses.
7. Confirm recognition card contains `0.34` and `4.08 m`.
8. Allow countdown.
9. Confirm failure simulation and text transcript.
10. Confirm disaster discovery.
11. Press **Try again**, then load or write the correction.
12. Submit after previous analysis is complete.
13. Confirm `0.75` and `9 m`.
14. Confirm successful crossing and progress achievement.
15. Replay failure and success.
16. Confirm Replay creates no OpenAI request.
17. Reload.
18. Confirm visible feed persists.
19. Reset.
20. Confirm task returns to fixture start.

### E2E-02 — Realtime teacher and learner

Use two isolated browser contexts:

1. teacher creates room;
2. learner opens student link;
3. learner draws one stroke;
4. teacher sees it;
5. teacher annotates;
6. learner sees annotation;
7. learner submits;
8. intercepted analysis media is inspected or hashed against expected student-only raster;
9. confirm teacher stroke is absent;
10. disconnect learner socket;
11. draw or queue locally according to supported behavior;
12. reconnect;
13. confirm no duplicate and final shared state.

### E2E-03 — AI fallback

Test at least:

- timeout;
- invalid structured result;
- `AI_ENABLED=false`.

Expected:

- canvas remains;
- concise error appears;
- bridge-length fallback appears;
- `4.08` failure runs;
- `9` success runs;
- no fake AI badge appears.

### E2E-04 — Unsupported topic

1. Enter unsupported request.
2. Confirm honest limitation.
3. Confirm two or three supported alternatives.
4. Select fractions.
5. Confirm real task appears.

### E2E-05 — Permissions

- learner cannot read teacher setup through DOM, HTTP, or WebSocket;
- learner cannot send teacher operation;
- invalid capability cannot fetch media;
- capability fragment does not appear in HTTP request URLs captured by Playwright.

### E2E-06 — Responsive and accessibility

Viewports:

- desktop;
- tablet;
- modest phone.

Checks:

- one vertical feed;
- no workflow tabs introduced;
- no horizontal document overflow;
- canvas controls remain reachable;
- semantic headings and landmarks;
- keyboard navigation;
- visible focus;
- live region updates;
- reduced motion;
- sound starts only after interaction;
- mute works;
- result transcript exists;
- color-independent labels.

### E2E-07 — Renderer failure

Inject renderer initialization failure:

- result classification and explanation remain;
- transcript remains;
- **Retry simulation** is available;
- room does not crash.

### E2E-08 — Persistence and fixture isolation

- `/judge` rooms are isolated;
- old room persists after new judge room creation;
- visible media loads after reload;
- archived simulations do not keep active render loops;
- replay reconstructs from stored inputs.

## Live GPT-5.6 evaluation

This suite uses real API calls and is run:

- during M4 tuning;
- before feature freeze;
- before the submission tag;
- after any prompt, schema, image-processing, or model-ID change.

It must not run automatically on public pull requests.

### Evaluation corpus

Create consent-safe or synthetic samples with no personal information:

- neat stylus handwriting;
- rough mouse handwriting;
- thick touch input;
- crossed-out value;
- correction written above a line;
- multiple rows;
- diagonal slash fraction;
- horizontal-bar fraction;
- decimal point;
- decimal comma;
- units close to value;
- units on separate line;
- alternate valid method;
- correct final answer with unclear intermediate work;
- wrong intermediate step with accidentally correct final answer;
- tiny handwriting;
- sparse handwriting;
- text clarification;
- intentionally unreadable work;
- student image with teacher annotation excluded before upload.

Do not use real identifiable student notebooks without explicit permission and an appropriate privacy decision.

### Metrics

Record per sample:

- transcription usable / not usable;
- required scenario inputs exact / acceptable / missing;
- final answer correct extraction;
- first-error diagnosis correct / plausible / wrong;
- verdict agreement with deterministic validator;
- schema-valid on first call;
- repair required;
- fallback required;
- latency;
- input and output tokens;
- reason for failure.

Aggregate:

- scenario-input exact accuracy;
- usable interpretation rate;
- first-call schema success;
- repair rate;
- fallback rate;
- p50 latency;
- p90 latency;
- cost estimate for observed usage.

### Initial release thresholds

These are engineering gates, not scientific claims:

- prepared judge handwriting: 100% across repeated release checks;
- required input extraction on the curated eval set: target at least 90%;
- no silent invalid simulation input;
- p90 analysis time: target no more than 20 seconds;
- timeout/fallback rate: target no more than roughly 5% on the stable curated set;
- every failure has working manual fallback.

If thresholds fail:

1. inspect crop and raster quality;
2. simplify schema and prompt;
3. compare low and medium reasoning effort;
4. tune image detail;
5. improve curated sample;
6. consider asynchronous Queue/Workflow transport if latency—not quality—is the blocker;
7. do not weaken deterministic validation.

The release can still be viable with a somewhat lower general handwriting score only if the prepared judge sample is fully reliable, the limitation is not overstated, and fallback is immediate.

## Production smoke test

`bun run smoke:prod` should automate safe checks and produce a report.

Minimum automated checks:

- production URL returns 200/redirect as expected;
- `/api/health`;
- `/judge` creates unique room;
- room bootstrap works;
- teacher/learner role filtering;
- WebSocket connects;
- deterministic fixture or configured live analysis completes;
- one simulation outcome renders;
- media authorization;
- Reset;
- no console-breaking error.

Do not create excessive rooms or AI calls in every smoke run. Use a purpose-built smoke mode or one controlled fixture.

## Human production QA

Perform in incognito or clean profile.

### Entry

- no login;
- no payment;
- no API key request;
- no CAPTCHA or WAF challenge;
- first action obvious in five seconds;
- product value visible before AI completes.

### Hero

- task wording does not reveal `9 m`;
- sample handwriting readable;
- real model identifier confirmed server-side;
- analysis stages visible;
- recognition card coherent;
- countdown cancel works;
- failure safe and comic;
- explanation causal;
- correction clear;
- success satisfying;
- Replay;
- Reset;
- reload persistence.

### Collaboration

- two real contexts;
- shared drawing;
- teacher annotations visually distinct;
- teacher marks excluded from attempt;
- learner cannot see private setup.

### Recovery

- AI disabled;
- API timeout;
- network interruption;
- WebSocket reconnect;
- renderer failure;
- low-performance mode;
- unsupported topic.

### Devices

- desktop;
- tablet/touch;
- modest phone;
- keyboard;
- reduced motion;
- sound muted.

### Security

- inspect URL and referrer;
- inspect client bundle;
- inspect source maps;
- inspect Worker logs;
- inspect R2 read access;
- inspect repository and Git history;
- ensure no private room link appears in screenshots or video.

## Clean-clone verification

Before release:

```bash
git clone <repo> lost-lessons-clean
cd lost-lessons-clean
bun install --frozen-lockfile
cp .env.example .dev.vars
# Insert only local test values outside Git.
bun run validate
```

A reviewer must follow README literally and record deviations.

## CI policy

### Pull requests

Required:

- frozen install;
- format check;
- lint;
- typecheck;
- unit;
- integration;
- build;
- mocked E2E;
- secret scan.

Optional:

- preview deploy;
- accessibility report;
- bundle-size report.

Never expose production OpenAI or Cloudflare secrets to untrusted pull-request code.

### Main

After all required checks:

- production deploy;
- production smoke;
- record deployment metadata.

### Release

Additionally:

- live AI eval;
- manual JUDGING run;
- security checklist;
- evidence matrix;
- clean clone;
- exact commit and tag.

## Defect severity

| Severity | Definition | Release effect |
|---|---|---|
| P0 | Secret exposure, data access bypass, destructive incident, production unavailable | Immediate stop and revoke/rollback |
| P1 | Judge cannot complete hero, AI fallback fails, correctness wrong, room role leaks | Blocks release |
| P2 | Supporting family failure, major visual/accessibility issue with workaround | Fix or cut affected optional scope |
| P3 | Cosmetic defect, minor copy issue, nonessential animation problem | May defer if documented |

No known P0 or P1 can remain at submission.

## Evidence output

Each validation must record:

- command;
- date/time;
- commit SHA;
- environment;
- pass/fail;
- artifact path or URL;
- notable metrics;
- issue link or resolution.

Update `docs/08-SUBMISSION-EVIDENCE.md`; do not rely on “tests passed” as an unsupported sentence.
