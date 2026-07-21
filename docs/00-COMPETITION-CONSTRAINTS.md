# 00 — Competition constraints

Status: frozen for this repository design packet. Source rules were supplied and verified on 2026-07-20.

## Project identity

- Project slot: B
- Track: Education
- Working name: Lost Lessons Lab
- Primary professional user: math tutor or teacher
- Interactive learner: a person with a specific math knowledge gap
- Platform: web application
- Deployment: Cloudflare
- Implementation surface: one primary Codex build session when practical
- Repository: separate GitHub repository
- Submission language: English
- Hard deadline supplied by the project process: 2026-07-22 04:00 Asia/Tbilisi

## Eligibility and submission obligations

The project must:

- be new or contain substantial new work from the competition period;
- use Codex substantively to build core functionality;
- use GPT-5.6 substantively and visibly;
- enter exactly one track;
- be a working product consistent with the video and written claims;
- provide free judge access through a live URL, sandbox, or test build;
- avoid mandatory registration, payment, or a judge-provided API key;
- include a public narrated YouTube video shorter than three minutes;
- explain in the video what was built and how Codex and GPT-5.6 were used;
- provide a repository, public with a suitable license or private with organizer access;
- include setup, tests, sample state, Codex workflow, human decisions, and GPT-5.6 integration in the README;
- record the `/feedback` Session ID for the representative Codex build session;
- use English submission materials or provide English translation;
- comply with all software and asset licenses;
- exclude secrets, API keys, personal data, and private capability links from code, logs, screenshots, and video.

## Judging implications

The supplied competition process treats these second-stage criteria as equally important:

1. Technological Implementation
2. Design
3. Potential Impact
4. Quality of the Idea

First-stage eligibility may be evaluated as pass/fail and may include automated review. Therefore every important claim must have direct evidence: a production screen, file, test, commit, URL, or exact video timestamp.

## Product constraints derived from judging

- Value must be understandable in the first five to ten seconds.
- The direct judge route must work in a clean browser without prior state.
- A visible sample must exist before a long AI call.
- AI integration must be real and distinguishable from a prepared fallback.
- The main path must survive timeout or model failure.
- Key controls must be semantic and browser-agent friendly.
- Canvas and physics results need text equivalents.
- The application must provide a reset/restart path.
- Production must remain available throughout judging.

## Development process constraints

- Deploy a runnable vertical slice early.
- Keep production deployable after every completed slice.
- Freeze features before submission work.
- Build evidence in parallel with implementation.
- Prefer one complete, impressive flow over many incomplete features.
- Do not endanger a working submission to preserve a formal single-thread Codex history; document additional sessions honestly if needed.

## Release artifacts

Required repository artifacts:

- `AGENTS.md`
- `README.md`
- `JUDGING.md`
- `STATUS.md`
- `.env.example`
- `LICENSE`
- design documents under `docs/`
- exact evidence matrix
- Codex Session ID before submission
- submission commit and `build-week-submission` tag

Required external artifacts:

- working production URL;
- public YouTube video under three minutes;
- Devpost project in Education track;
- repository URL;
- screenshots/image gallery;
- accurate testing instructions;
- completed and submitted status, not draft.

## Claims policy

Do not publish a claim in README, Devpost, video, or screenshots unless it is demonstrated by the submission commit. Planned features must be labeled planned or removed from submission copy.
