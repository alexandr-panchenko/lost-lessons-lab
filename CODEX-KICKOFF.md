# Codex kickoff — Lost Lessons Lab

You are the primary implementation agent for the OpenAI Build Week 2026 Education project in this repository.

## Read first

Read these files completely, in order:

1. `AGENTS.md`
2. `docs/00-COMPETITION-CONSTRAINTS.md`
3. `docs/01-PRODUCT-BRIEF.md`
4. `docs/02-UX-AND-DEMO-FLOW.md`
5. `docs/03-DECISION-LOG.md`
6. `docs/04-TECHNICAL-DESIGN.md`
7. `docs/05-IMPLEMENTATION-PLAN.md`
8. `docs/06-TEST-PLAN.md`
9. `docs/07-SECURITY-COST-AND-DEPLOYMENT.md`
10. `docs/08-SUBMISSION-EVIDENCE.md`
11. `STATUS.md`

They are the source of truth. Do not redesign the product or expand scope.

## Before changing code

1. Inspect the current branch, Git status, and repository tree.
2. Confirm available Bun, Cloudflare, and test tooling.
3. Confirm there are no tracked secrets.
4. Summarize the frozen milestones and any real blockers.
5. If no real blocker exists, start Milestone 1 immediately; do not wait for separate confirmation.

Stop and ask the user only for a real blocker:

- a missing secret or external credential required for the next validation;
- an irreversible external action;
- a contradiction between source-of-truth documents;
- a requirement impossible with the frozen stack;
- a material privacy, secret-exposure, or uncontrolled-cost risk.

Do not stop for ordinary implementation choices. Use defaults from the decision log.

## Execution mode

Work milestone by milestone.

For each milestone:

1. Mark it `in progress` in `STATUS.md`.
2. Implement only that milestone.
3. Add or update tests.
4. Run every required validation command.
5. Fix failures before continuing.
6. Review the diff for scope creep, secrets, accessibility, and stale docs.
7. Update `STATUS.md` and evidence targets.
8. Commit with the implementation plan's exact commit message.
9. Record concrete evidence: files, tests, production URL, screenshot target, logs, or video target.
10. Proceed only when the milestone gate is green.

## Priority under time pressure

1. Working production deployment.
2. Complete bridge hero/judge flow.
3. Visible, substantive GPT-5.6 integration.
4. Realtime teacher–student canvas and persistence.
5. Validation, timeout, fallback, and reset.
6. Clear no-login UX and accessibility.
7. README, JUDGING, and submission evidence.
8. Polish.
9. Optional simulation families.

If time is short, cut optional families in the documented order. Never replace bridge physics, collaboration, or AI with a static mock.

## Non-negotiable engineering rules

- Never commit API keys, tokens, passwords, `.env`, or `.dev.vars`.
- Never place the OpenAI key in the browser bundle.
- Never present a fixture as a fresh AI response without a visible label.
- Never leave a `TODO` in the required judge path.
- Validate every model output that can affect state.
- Implement the documented timeout, bounded retry, and template-specific fallback.
- Keep one active AI analysis per room; disable new student submissions until it finishes.
- Preserve sample/judge state and Reset current task.
- Use semantic controls and accessible labels for automation.
- Do not require registration, BYOK, CAPTCHA, or a paid action.
- Do not add a dependency without need and license verification.
- Do not change architecture without updating the decision log.
- Keep a factual record of how Codex accelerated implementation and which decisions remained human-owned.

## Final verification

After the last milestone:

1. Run format, lint, typecheck, unit, integration, mocked E2E, live AI eval, and production build.
2. Verify the production URL in a clean browser context.
3. Follow `JUDGING.md` literally.
4. Verify AI timeout/failure fallback.
5. Verify Reset current task and a fresh `/judge` room.
6. Verify teacher/student realtime drawing in two browser contexts.
7. Verify teacher strokes are absent from AI input.
8. Inspect tracked files, logs, and browser bundles for secrets.
9. Update `docs/08-SUBMISSION-EVIDENCE.md` with only real evidence.
10. Record the exact submission commit.
11. Create tag `build-week-submission`.
12. Report implemented scope, cut scope, validation results, production URL, commit/tag, known risks, and video readiness.

Do not claim completion until the required judge path works end to end in production.
