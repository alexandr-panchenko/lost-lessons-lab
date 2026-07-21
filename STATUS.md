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
| M5 — Complete hero and judge flow | in progress | On 2026-07-21, the final bridge RC passed ten consecutive correct and ten consecutive wrong headless worlds, 77 unit tests, 22 Worker/DO integration tests, build, secret audit, and all 22 local Chromium paths. The correct vehicle remained upright with no bridge break; the staged wrong run remained centered and bounded with a stable boat and moving water. | Production deployment, real wrong/correct GPT-5.6 attempts, production Chromium, performance capture, and human visual approval remain. | Commit and deploy the validated release candidate, then run the production hero and capture gates | R0 `662f28d`; R2 `0476c04`; R2.1 `ec04eb9` + `5818a60`; release candidate pending |
| S1 — Water and volume family | cut | Implementation code and internal integration coverage remain; local and production R0 navigation/route checks pass | Human review has not approved this scenario for the public product | Keep the production feature flag disabled | Historical implementation through `f436986`; hidden in production by `662f28d` |
| S2 — Speed, time, and collision family | cut | Implementation code and internal integration coverage remain; local and production R0 navigation/route checks pass | Human review has not approved this scenario for the public product | Keep the production feature flag disabled | Historical implementation through `fa857d3`; hidden in production by `662f28d` |
| S3 — Structure, load, and destruction family | cut | Implementation code and internal integration coverage remain; local and production R0 navigation/route checks pass | Human review has not approved this scenario for the public product | Keep the production feature flag disabled | Historical implementation through `5942254`; hidden in production by `662f28d` |
| M6 — Reliability, fallback, and controls | in progress | The RC now persists attempt/media before creating one `AnalysisWorkflow` instance keyed by attempt ID. A Cloudflare-runtime integration test discarded the initiating request and passed after a 31-second fake model delay; reload saw the completed persisted run. | Production Workflow provisioning and two real GPT-5.6 attempts remain to verify. | Verify Workflow provisioning and durable real analysis in production | Prior hardening `3c9afce` through `59e6f62`; Workflow release candidate pending |
| M7 — Visual polish and accessibility | done | On 2026-07-21, 65 unit, 22 Worker/SQLite DO/R2 integration, build, 21 local and 21 production Chromium tests, the production keyboard/responsive/reduced-motion verifier, a clean two-attempt real GPT-5.6 hero, CI `29822165434`, and deploy/smoke `29822327473` passed on Cloudflare version `14d54119-b3ac-464f-8745-aea8025dd08a`; client entry was 323.05 kB / 94.89 kB gzip | None | Begin M8 clean-browser, security, and deployment verification | `b990abe` (verifier correction `c2ab48a`) |
| M8 — E2E, security, and deployment verification | done | On 2026-07-21, a clean clone passed the literal frozen install and full validation; 65 unit, 22 Worker/SQLite DO/R2 integration, build, secret audit, 21 local and 21 production Chromium paths, two live GPT-5.6 samples, the literal two-attempt production judge path, private-media authorization, fallback, accessibility, and security audits passed; CI `29824539151` and deploy/smoke `29824698851` passed on Cloudflare version `968d9590-25e6-4a6d-8ea6-e6b12febb9be` | No P0/P1 issue found; owner-only submission assets and OpenAI dashboard spending-limit confirmation remain for M9 | Begin M9 evidence freeze without product changes | `eef7c03` (clean-install and audit corrections through `951c978`) |
| M9 — Evidence and release freeze | blocked | The engineering checkpoint remains recorded, but human review superseded submission readiness on 2026-07-21 | Release freeze, video upload, submission tag, and all submission work are suspended until the reopened hero milestone passes rescue review | Do not resume M9 during rescue checkpoints or start a release freeze | No final freeze commit or tag |

## Current blockers

GitHub CLI authentication, scoped Actions deployment secrets, the
`PRODUCTION_URL` repository variable, Cloudflare OAuth, Git push
authentication, and local `.dev.vars` are available. Secret values were not
printed. The active blocker is release-candidate production and human visual
approval. The local final bridge candidate is green, including both physical
outcomes and the durable Workflow test. It has not yet been committed, deployed,
exercised with two real production GPT-5.6 attempts, or captured for final human
review.

Credentials still reserved for later gates:

- OpenAI production Worker secret at M4;
- final production hostname if a custom domain is used.

## Cut rule

Never cut the bridge hero flow, GPT-5.6 interpretation, deterministic fallback, shared canvas, or real physics to preserve an optional scenario. Cut optional families in this order:

1. structure/load;
2. speed/time;
3. water/volume.
