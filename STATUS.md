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
| M5 — Complete hero and judge flow | done | On 2026-07-21, 42 unit, 15 Worker/DO/R2 integration, build, 12 local and 12 production Chromium tests, both live samples, a two-attempt real production hero run, private media checks, replay, reload, reset, CI `29810106237`, and deploy/smoke `29810212998` passed on Cloudflare version `3143b924-6be1-4436-aa62-167e4ef25e1d` | None | Consider S1 only while the frozen hero remains green | `80d93aa` (verification through `892791e`) |
| S1 — Water and volume family | not started | — | Optional after hero is green | Implement only if full hero remains stable | — |
| S2 — Speed, time, and collision family | not started | — | Optional after S1 | Implement as an independent tested slice | — |
| S3 — Structure, load, and destruction family | not started | — | Lowest-priority supporting family | Implement only if all earlier gates remain green | — |
| M6 — Reliability, fallback, and controls | not started | — | Depends on real measurements | Finish limits, error paths, media, kill switch, and persistence QA | — |
| M7 — Visual polish and accessibility | not started | — | Must not delay core | Apply final visual system, reduced motion, sound controls, semantic review | — |
| M8 — E2E, security, and deployment verification | not started | — | Requires production deployment | Run full clean-browser and failure-path audit | — |
| M9 — Evidence and release freeze | not started | — | Requires final production build | Fill evidence, tag release, and freeze | — |

## Current blockers

No active credential blocker remains. GitHub CLI authentication, scoped Actions deployment secrets, the `PRODUCTION_URL` repository variable, Cloudflare OAuth, Git push authentication, and local `.dev.vars` are available. Secret values were not printed.

Credentials still reserved for later gates:

- OpenAI production Worker secret at M4;
- final production hostname if a custom domain is used.

## Cut rule

Never cut the bridge hero flow, GPT-5.6 interpretation, deterministic fallback, shared canvas, or real physics to preserve an optional scenario. Cut optional families in this order:

1. structure/load;
2. speed/time;
3. water/volume.
