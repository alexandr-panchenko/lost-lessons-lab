# 12 — Submission checklist

Use this as the final concise gate. The detailed human QA is in `docs/11-HUMAN-VERIFICATION-CHECKLIST.md`.

## Product

- [ ] Production URL works in incognito.
- [ ] `/judge` creates a fresh isolated room.
- [ ] No registration, payment, CAPTCHA, or BYOK.
- [ ] Hero loop works: `4.08 m` failure → explanation → `9 m` success.
- [ ] Real GPT-5.6 handwriting interpretation is visible.
- [ ] Deterministic validation controls the outcome.
- [ ] Manual fallback works.
- [ ] Realtime teacher/learner canvas works.
- [ ] Teacher marks are excluded from analysis.
- [ ] Replay, Reset, and reload persistence work.
- [ ] Text transcript and accessible controls work.
- [ ] Any incomplete supporting family is cut and hidden.

## Validation

- [ ] Clean clone succeeds.
- [ ] `bun install --frozen-lockfile`.
- [ ] `bun run validate`.
- [ ] `bun run test:live-ai`.
- [ ] `bun run smoke:prod`.
- [ ] Full JUDGING path passes.
- [ ] AI-disabled path passes.
- [ ] Two-context collaboration passes.
- [ ] No P0/P1 issues.
- [ ] Rollback target recorded.

## Security and licenses

- [ ] No secrets or capability links in repo, bundle, source maps, logs, screenshots, or video.
- [ ] Private R2 authorization verified.
- [ ] Teacher/learner permissions verified.
- [ ] Rate limits, spend limit, and kill switch configured.
- [ ] No required personal data.
- [ ] Apache-2.0 license present.
- [ ] `THIRD_PARTY_NOTICES.md` complete.
- [ ] All code, images, sound, fonts, and music have verified rights.

## Repository

- [ ] README has value, live URL, judge path, expected result, video, setup, tests, architecture, GPT-5.6, Codex, human decisions, and license.
- [ ] JUDGING has exact URL and 3–6 steps.
- [ ] STATUS accurately records done/cut scope.
- [ ] Evidence matrix has no unresolved required PENDING/FAIL.
- [ ] Repository access is correct.
- [ ] Representative Codex Session ID recorded for submission.
- [ ] Submission commit selected.
- [ ] `build-week-submission` tag pushed.

## Video and Devpost

- [ ] Public YouTube video is under 3:00.
- [ ] English narration or translation and accurate captions.
- [ ] Product appears immediately.
- [ ] Full hero flow shown.
- [ ] Codex and GPT-5.6 use explained concretely.
- [ ] Production matches video.
- [ ] Name, tagline, story, technology tags, screenshots, URLs, and testing instructions are final.
- [ ] Education track selected.
- [ ] Submission status is **Submitted**, not Draft.
- [ ] Public project view and all links verified in incognito.

## Final identifiers

```text
Production URL:
Judge URL:
Repository URL:
Video URL:
Submission commit:
Submission tag:
Cloudflare deployment/version:
Representative Codex Session ID (private):
Devpost project URL:
Submitted confirmation time:
```
