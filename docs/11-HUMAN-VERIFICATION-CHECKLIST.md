# 11 — Human verification checklist

This checklist covers actions that require the project owner, external accounts, judgment, or visual inspection. Codex must not claim completion without human confirmation.

## A — Administrative readiness

- [ ] Join the correct OpenAI Build Week Devpost event.
- [ ] Confirm eligibility and country requirements.
- [ ] Create the Education draft project.
- [ ] Create the dedicated GitHub repository.
- [ ] Create the dedicated Cloudflare Worker/project resources.
- [ ] Create the OpenAI API project/key and spending limits.
- [ ] Test the exact Codex surface and `/feedback` workflow.
- [ ] Store the Session ID securely.
- [ ] Confirm the absolute deadline in the user's timezone.

## B — First repository commit

- [ ] Copy the full design packet into the repository root.
- [ ] Confirm all files render correctly on GitHub.
- [ ] Confirm `LICENSE` is Apache-2.0.
- [ ] Confirm `.env.example` contains no values.
- [ ] Confirm `.gitignore` excludes `.dev.vars`, `.env`, build state, media, traces, and secrets.
- [ ] Run a secret scan.
- [ ] Commit with:

```text
chore: freeze Build Week product design and execution plan
```

- [ ] Push the first commit.

## C — Codex session start

- [ ] Open the correct repository in Codex.
- [ ] Configure only the credentials required for the current milestone.
- [ ] Start the primary build session.
- [ ] Paste or reference `CODEX-KICKOFF.md`.
- [ ] Confirm Codex read all source-of-truth documents.
- [ ] Confirm Codex summarized milestones and did not redesign the product.
- [ ] Confirm `STATUS.md` is updated before implementation.
- [ ] Keep the primary implementation in the same thread while it remains effective.
- [ ] Use another thread only for a real failure or clearly documented parallel task.

## D — After every milestone

- [ ] Review the diff.
- [ ] Verify no scope creep.
- [ ] Verify no secret, capability, personal data, or raw media is tracked.
- [ ] Review actual UI, not only tests.
- [ ] Run the milestone path in a clean browser.
- [ ] Confirm the production URL still works after deployment.
- [ ] Confirm the listed validation commands actually ran.
- [ ] Confirm `STATUS.md` is accurate.
- [ ] Confirm evidence references are exact.
- [ ] Confirm the milestone commit message matches the plan.
- [ ] Decide continue/cut before starting an optional scenario.

## E — Product behavior

### Entry

- [ ] `/` enters a guided room without a marketing gate.
- [ ] `/judge` creates a fresh room every time.
- [ ] No account, payment, CAPTCHA, or BYOK.
- [ ] First action is obvious within five seconds.
- [ ] Supported skill limits are visible.

### Roles and room

- [ ] Teacher link and learner link work.
- [ ] Teacher setup is absent from learner view.
- [ ] Teacher can preview learner view in one tab.
- [ ] Two real contexts share the room.
- [ ] Reload restores visible history.

### Canvas

- [ ] Mouse drawing is usable.
- [ ] Touch/stylus drawing is usable on an available device.
- [ ] Pen, highlighter, stroke eraser, undo/redo, and clear work.
- [ ] Teacher and learner marks are distinguishable without color alone.
- [ ] Teacher annotation appears in realtime.
- [ ] Teacher marks are absent from submitted learner analysis.
- [ ] A submitted attempt does not change after later drawing.
- [ ] Reconnect does not duplicate strokes.

### AI

- [ ] A real production call uses `gpt-5.6`.
- [ ] Prepared handwriting is read correctly.
- [ ] Analysis stages appear.
- [ ] Recognition card shows the actual interpretation.
- [ ] Strict and semantic validation are enabled.
- [ ] A second attempt is blocked during analysis.
- [ ] Timeout and failure preserve the work.
- [ ] Manual parameter fallback works.
- [ ] The client bundle contains no OpenAI secret.
- [ ] Logs contain no handwriting or capability.

### Physics

- [ ] `4.08 m` visibly creates a short bridge.
- [ ] The failure is safe and comic.
- [ ] `9 m` creates a successful crossing.
- [ ] The physical scene is not a prerecorded video.
- [ ] Correctness does not depend on a random collision.
- [ ] Replay works without another AI call.
- [ ] Skip, pause, 2×, mute, and transcript work.
- [ ] Reduced motion preserves meaning.
- [ ] Low-performance behavior remains usable.

### Learning tone

- [ ] Explanation directly connects the learner's value to the result.
- [ ] Copy never calls the learner stupid, bad, or incapable.
- [ ] Disaster discovery rewards exploration.
- [ ] Progress achievement reports an action, not mastery.
- [ ] Correct resolution is emotionally stronger than the failure.
- [ ] Teacher remains responsible for pedagogical judgment.

## F — Device and accessibility review

- [ ] Desktop viewport.
- [ ] Tablet viewport.
- [ ] Modest phone viewport.
- [ ] One continuous feed at every width.
- [ ] No accidental horizontal page overflow.
- [ ] Keyboard reaches every non-drawing control.
- [ ] Visible focus.
- [ ] Logical heading structure and landmarks.
- [ ] Live analysis/connection status announced appropriately.
- [ ] Canvas has accessible instructions/name.
- [ ] Simulation transcript is understandable without animation.
- [ ] Color is not the only state signal.
- [ ] Sound waits for interaction and can be muted.
- [ ] Reduced-motion mode avoids shake/excess particles.

## G — Security and privacy review

- [ ] No real learner names, ages, schools, or personal data in demo.
- [ ] PII warning visible near submission.
- [ ] Capability token is in fragment, not network URL.
- [ ] `Referrer-Policy: no-referrer`.
- [ ] Room/bootstrap is `no-store`.
- [ ] Invalid capability cannot read room.
- [ ] Learner capability cannot read teacher setup.
- [ ] Private R2 object cannot be fetched directly.
- [ ] Media type, dimensions, and size are validated.
- [ ] Rate limits do not disrupt judge.
- [ ] Abuse limits actually trigger.
- [ ] OpenAI project spend limit exists.
- [ ] `AI_ENABLED=false` works.
- [ ] Production debug logging is off.
- [ ] Repository history and source maps are secret-free.
- [ ] Asset licenses and provenance are documented.

## H — Release QA

- [ ] Clean clone follows README successfully.
- [ ] `bun install --frozen-lockfile`.
- [ ] `bun run validate`.
- [ ] `bun run test:live-ai`.
- [ ] `bun run deploy`.
- [ ] `bun run smoke:prod`.
- [ ] Full `JUDGING.md` path in incognito.
- [ ] AI-disabled path in controlled environment.
- [ ] Reset.
- [ ] Replay.
- [ ] Reload persistence.
- [ ] Two-context realtime.
- [ ] Production rollback target recorded.
- [ ] No P0/P1 issue.
- [ ] Optional broken family is cut, not hidden behind hope.

## I — Evidence and submission materials

- [ ] Fill every required row in `docs/08-SUBMISSION-EVIDENCE.md`.
- [ ] Run eligibility auditor.
- [ ] Run rubric grader.
- [ ] Run first-impression judge.
- [ ] Fix evidence and friction gaps.
- [ ] Finalize Devpost story from actual release.
- [ ] Finalize thumbnail and image gallery.
- [ ] Record public English/narrated video under 3:00.
- [ ] Add accurate captions.
- [ ] Verify video in incognito after HD processing.
- [ ] Verify repository access and README rendering.
- [ ] Record production URL, repository URL, video URL, commit, tag, and Session ID.
- [ ] Confirm submission materials contain no private room fragment.

## J — Final release

- [ ] Select exact submission commit.
- [ ] Update README and JUDGING with real URLs.
- [ ] Final full validation.
- [ ] Final production smoke.
- [ ] Create and push `build-week-submission`.
- [ ] Verify production corresponds to tag.
- [ ] Fill Devpost fields.
- [ ] Choose Education track.
- [ ] Press **Submit project**.
- [ ] Verify status **Submitted**, not Draft.
- [ ] Capture private confirmation screenshot.
- [ ] Open public project view and test all links.
- [ ] Avoid risky production changes after freeze.
