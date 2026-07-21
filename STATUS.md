# Project status

Last updated: 2026-07-21

States: `not started`, `in progress`, `blocked`, `done`, `cut`.

| Milestone | State | Last validation | Known issues | Next action | Commit |
|---|---|---|---|---|---|
| Design packet and scope freeze | done | Required files, links, UTF-8, code fences, license, and frozen-scope consistency reviewed on 2026-07-21 | None | Preserve frozen scope during implementation | `07d27b5` |
| M1 — Repository and reproducible environment | done | Frozen install plus format, lint, typecheck, 2 unit, 2 Worker/DO integration, build, 2 Chromium E2E, diff, history, tracked-file, and final-bundle secret checks passed on 2026-07-21 | No product room behavior by design until M2 | Begin deployable guided room shell | `7c5b502` |
| M2 — Deployable room shell | done | On 2026-07-21, local validation, 3 production Chromium tests, CI run `29802489533`, and gated deployment/smoke run `29802536234` passed | None | Begin M3 realtime canvas and deterministic bridge | `0c39b42` (delivery fixes through `c906082`) |
| M3 — Realtime canvas and deterministic bridge | done | On 2026-07-21, the local gate, CI run `29804635232`, deployment/smoke run `29804696808`, and 11 strengthened production Chromium tests passed; the browser gate requires real PixiJS canvases under strict CSP | None | Begin M4 GPT-5.6 handwriting interpretation | `b76eede` (CSP delivery fix `cb80021`) |
| M4 — GPT-5.6 handwriting integration | done | On 2026-07-21, 39 unit, 13 Worker/DO/R2 integration, build, 12 mocked Chromium, and the two-sample live gate passed; CI `29807921144`, deploy/smoke `29807995100`, and repeated real production analysis on version `4df2792d-c731-4f05-946b-000671de227e` passed with exact hero inputs, private media, persisted analysis/run, and a clean rendered card | None | Begin M5 complete hero and judge flow | `969f99d` (Worker fetch fix `42ae639`) |
| M5 — Complete hero and judge flow | in progress | Rescue Checkpoint R0 passed the complete local gate on 2026-07-21: format, lint, strict types, 65 unit, 22 Worker/SQLite DO/R2 integration, build, secret audit, and 22 Chromium tests. Commit `662f28d` passed CI `29835167517`, was deployed by gated run `29835329470`, and is live as Cloudflare version `bcb988b1-b4c4-4a58-9633-cb56a847e904`. Baseline smoke, seven focused production Chromium cases, and the R0 production verifier passed. The latter proved the dominant same-tab transition uses the existing room's real student capability, keeps Teacher/Student return control, preserves state, opens no new tab, filters teacher setup, places the task and Run control in the desktop viewport, and generated two visually inspected 1280×900 production frames. The first immediate post-deploy smoke encountered the prior edge state; the rerun passed after all three route checks returned the deployed redirects. | The central bridge consequence still lacks the required visual impact and is explicitly deferred beyond R0. | Stop for human review without beginning R1 | R0 implementation `662f28d`; production evidence recorded by `fb08505` |
| S1 — Water and volume family | cut | Implementation code and internal integration coverage remain; local and production R0 navigation/route checks pass | Human review has not approved this scenario for the public product | Keep the production feature flag disabled | Historical implementation through `f436986`; hidden in production by `662f28d` |
| S2 — Speed, time, and collision family | cut | Implementation code and internal integration coverage remain; local and production R0 navigation/route checks pass | Human review has not approved this scenario for the public product | Keep the production feature flag disabled | Historical implementation through `fa857d3`; hidden in production by `662f28d` |
| S3 — Structure, load, and destruction family | cut | Implementation code and internal integration coverage remain; local and production R0 navigation/route checks pass | Human review has not approved this scenario for the public product | Keep the production feature flag disabled | Historical implementation through `5942254`; hidden in production by `662f28d` |
| M6 — Reliability, fallback, and controls | done | On 2026-07-21, 65 unit, 22 Worker/SQLite DO/R2 integration, build, 19 local and 19 production Chromium tests, exact first-response live GPT-5.6 samples in 5.16s and 4.45s, an injected AI-disabled manual recovery, the two-attempt real production hero, CI `29820119859`, and deploy/smoke `29820306932` passed on Cloudflare version `7171964a-e712-442a-8051-ae52c3fd6ec3` | None | Begin M7 visual polish and accessibility without changing the green hero logic | `3c9afce` (delivery corrections through `59e6f62`) |
| M7 — Visual polish and accessibility | done | On 2026-07-21, 65 unit, 22 Worker/SQLite DO/R2 integration, build, 21 local and 21 production Chromium tests, the production keyboard/responsive/reduced-motion verifier, a clean two-attempt real GPT-5.6 hero, CI `29822165434`, and deploy/smoke `29822327473` passed on Cloudflare version `14d54119-b3ac-464f-8745-aea8025dd08a`; client entry was 323.05 kB / 94.89 kB gzip | None | Begin M8 clean-browser, security, and deployment verification | `b990abe` (verifier correction `c2ab48a`) |
| M8 — E2E, security, and deployment verification | done | On 2026-07-21, a clean clone passed the literal frozen install and full validation; 65 unit, 22 Worker/SQLite DO/R2 integration, build, secret audit, 21 local and 21 production Chromium paths, two live GPT-5.6 samples, the literal two-attempt production judge path, private-media authorization, fallback, accessibility, and security audits passed; CI `29824539151` and deploy/smoke `29824698851` passed on Cloudflare version `968d9590-25e6-4a6d-8ea6-e6b12febb9be` | No P0/P1 issue found; owner-only submission assets and OpenAI dashboard spending-limit confirmation remain for M9 | Begin M9 evidence freeze without product changes | `eef7c03` (clean-install and audit corrections through `951c978`) |
| M9 — Evidence and release freeze | blocked | The engineering checkpoint remains recorded, but human review superseded submission readiness on 2026-07-21 | Release freeze, video upload, submission tag, and all submission work are suspended until the reopened hero milestone passes rescue review | Do not resume M9 during R0 or start a release freeze | No final freeze commit or tag |

## Current blockers

GitHub CLI authentication, scoped Actions deployment secrets, the
`PRODUCTION_URL` repository variable, Cloudflare OAuth, Git push
authentication, and local `.dev.vars` are available. Secret values were not
printed. The active blocker is product quality: human review found inadequate
visual impact in the hero and avoidable same-tab judge-flow friction. Rescue
Checkpoint R0 addresses only judge flow and public scope. Visual reconstruction
is deferred to a later explicitly authorized checkpoint.

Credentials still reserved for later gates:

- OpenAI production Worker secret at M4;
- final production hostname if a custom domain is used.

## Cut rule

Never cut the bridge hero flow, GPT-5.6 interpretation, deterministic fallback, shared canvas, or real physics to preserve an optional scenario. Cut optional families in this order:

1. structure/load;
2. speed/time;
3. water/volume.
