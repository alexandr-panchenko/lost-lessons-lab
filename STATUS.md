# Project status

Last updated: 2026-07-21

States: `not started`, `in progress`, `blocked`, `done`, `cut`.

| Milestone | State | Last validation | Known issues | Next action | Commit |
|---|---|---|---|---|---|
| Design packet and scope freeze | done | Required files, links, UTF-8, code fences, license, and frozen-scope consistency reviewed on 2026-07-21 | None | Preserve frozen scope during implementation | `07d27b5` |
| M1 — Repository and reproducible environment | done | Frozen install plus format, lint, typecheck, 2 unit, 2 Worker/DO integration, build, 2 Chromium E2E, diff, history, tracked-file, and final-bundle secret checks passed on 2026-07-21 | No product room behavior by design until M2 | Begin deployable guided room shell | `chore: establish reproducible Cloudflare application environment` |
| M2 — Deployable room shell | not started | — | No production URL | Create Durable Object room shell, CI, and first deployment | — |
| M3 — Realtime canvas and deterministic bridge | not started | — | No application code | Implement room state, canvas operation log, and manual bridge simulation | — |
| M4 — GPT-5.6 handwriting integration | not started | — | OpenAI secret required | Add Responses API, Structured Outputs, validation, and fallback | — |
| M5 — Complete hero and judge flow | not started | — | Depends on M3–M4 | Complete wrong/correct retry, achievements, replay, and `/judge` | — |
| S1 — Water and volume family | not started | — | Optional after hero is green | Implement only if full hero remains stable | — |
| S2 — Speed, time, and collision family | not started | — | Optional after S1 | Implement as an independent tested slice | — |
| S3 — Structure, load, and destruction family | not started | — | Lowest-priority supporting family | Implement only if all earlier gates remain green | — |
| M6 — Reliability, fallback, and controls | not started | — | Depends on real measurements | Finish limits, error paths, media, kill switch, and persistence QA | — |
| M7 — Visual polish and accessibility | not started | — | Must not delay core | Apply final visual system, reduced motion, sound controls, semantic review | — |
| M8 — E2E, security, and deployment verification | not started | — | Requires production deployment | Run full clean-browser and failure-path audit | — |
| M9 — Evidence and release freeze | not started | — | Requires final production build | Fill evidence, tag release, and freeze | — |

## Current blockers

No active blocker remains. Local `.dev.vars`, Cloudflare OAuth, and Git remote push authentication are available; secret values were not printed. The standalone GitHub CLI credential is stale, but M1 confirmed that the configured origin can be pushed. Credentials are used only when their milestone reaches the corresponding external gate:

- OpenAI API key;
- Cloudflare account/API token and account context;
- GitHub repository and Actions secrets;
- final production hostname if a custom domain is used.

## Cut rule

Never cut the bridge hero flow, GPT-5.6 interpretation, deterministic fallback, shared canvas, or real physics to preserve an optional scenario. Cut optional families in this order:

1. structure/load;
2. speed/time;
3. water/volume.
