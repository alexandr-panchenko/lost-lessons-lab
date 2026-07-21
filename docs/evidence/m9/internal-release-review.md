# M9 internal release review

Date: 2026-07-21  
Production runtime: Cloudflare version
`968d9590-25e6-4a6d-8ea6-e6b12febb9be`  
Repository evidence through: M8 close `2b4e60b`

The M9 pre-freeze rerun passed 65 unit tests, 22 Worker/SQLite Durable
Object/R2 integration tests, build, secret audit, and 21 Chromium tests. Its
two live GPT-5.6 samples extracted the exact frozen values without repair in
6.17s and 4.42s; canonical production and security smoke passed immediately
afterward.

This is a skeptical evidence review performed inside the primary implementation
session. It is not labeled as an independent human review. The first-impression
section is therefore provisional and cannot close the independent-review row in
the evidence matrix.

## Eligibility audit

| Requirement | Result | Exact evidence or gap |
|---|---|---|
| Competition-period work | PASS through M8 | Public Git history from `07d27b5` through `2b4e60b`, dated 2026-07-21 |
| Substantive Codex use | UNVERIFIED for submission | README and milestone commits map the work, but the private representative `/feedback` Session ID is not yet recorded |
| Substantive GPT-5.6 use | PASS | `scripts/verify-production-ai.ts`, two-sample live eval, production model `gpt-5.6-sol`, strict schema and semantic validators |
| Education track | PASS technically | Production `/judge` implements tutor gap, learner reasoning, explanation, correction, and retry; owner must select Education in Devpost |
| Working/free product | PASS | Production hero, fallback, accessibility, security, and 21-path browser runs; no login, payment, challenge, or BYOK |
| Public video under 3:00 | UNVERIFIED | No public video URL exists |
| Repository and license | PASS | Public GitHub repository; Apache-2.0 metadata and root `LICENSE` |
| English materials | UNVERIFIED as a complete submission | Repository and UI are English; final video/captions and Devpost preview do not yet exist |
| Secrets/privacy | PASS for current repository/runtime evidence | M8 audit scanned tracked files, history, 27 build files, client bundle, and source-map exposure; final video still requires review |
| Third-party rights | PASS | `THIRD_PARTY_NOTICES.md`; original code-generated visuals and tones; no external media |
| Submission status | UNVERIFIED | Devpost project/track/submitted confirmation is owner-controlled and absent |

Hard blockers to the release tag:

1. public narrated English video under three minutes and incognito verification;
2. private representative `/feedback` Session ID;
3. Devpost Education draft, final fields, and submitted confirmation;
4. owner confirmation of the OpenAI project spending/rate limit;
5. an independent first-impression/eligibility review using the final video and
   Devpost preview.

No product P0/P1 was found. Unsupported submission-wide claims remain PENDING
rather than being promoted to PASS.

## Rubric review

| Category | Internal score | Strongest evidence | Remaining weakness |
|---|---:|---|---|
| Technological Implementation | 9/10 | Real GPT-5.6 vision, strict output plus deterministic validation, SQLite Durable Object, private R2, role-aware WebSockets, parameterized fixed-step physics, clean-clone/CI/deploy proof | Final public demo evidence is absent |
| Design | 8/10 | One continuous responsive feed, visible causal values, safe comic failure, native controls, keyboard/reduced-motion/text/sound alternatives | The always-visible manual form adds density below the primary action; no independent first-impression result |
| Potential Impact | 7/10 | Tutor-selected misconception, learner correction loop, persistent shared room, four complete templates | No tutor/learner study; copy must remain cautious |
| Quality of the Idea | 9/10 | The learner's submitted number directly controls real physics while GPT remains an interpreter rather than grader | The final video must make the causal mechanic unmistakable in its opening seconds |

Internal weighted impression: **8.25/10**. Likely objections are demo density,
the prepared nature of the judge handwriting, and lack of measured educational
outcomes. The repository addresses the first two with free-form canvas support,
live multimodal calls, alternate/failure tests, and cautious impact language; it
does not claim a learning study.

Memorable sentence: **The learner's math is the controller; the simulation is
evidence.**

Single highest-impact remaining change: produce a concise final video that
opens on the short bridge, then immediately shows the handwritten value and
GPT-5.6 interpretation that caused it.

## Provisional first impression

From `docs/evidence/m7/desktop-first-screen.png` and the first production step:

- Product: a shared tutoring room that turns handwritten math into a physical
  result.
- Audience: tutors and learners working on a specific math gap.
- Problem: ordinary practice hides the consequence of a misconception.
- Memorable mechanic: a submitted number changes the simulated world.
- Expected first action: choose **Preview as student**, then run the prepared
  solution.
- Trust signal: the first screen names the next action and explains that
  deterministic code checks every value.
- Possible hesitation: the interface is evidence-rich and becomes long after
  two attempts.
- AI appears necessary because it reads free-form multi-line handwriting and
  produces a visible structured interpretation; deterministic code still owns
  truth.
- The error tone is playful and non-punitive, with a disaster discovery followed
  by a stronger progress achievement.

This assessment is not independent because the reviewer knew the product and
implementation beforehand. A fresh reviewer must repeat the prompt against the
final thumbnail, first 20 seconds of video, first production screen, and 90-second
path before the release tag.
