# 12 — Submission checklist

Use this as the final concise gate. The detailed human QA is in `docs/11-HUMAN-VERIFICATION-CHECKLIST.md`.

## Product

- [x] Production URL works in incognito.
- [x] `/judge` creates a fresh isolated room.
- [x] No registration, payment, CAPTCHA, or BYOK.
- [x] Hero loop works: `4.08 m` failure → explanation → `9 m` success.
- [x] Real GPT-5.6 handwriting interpretation is visible.
- [x] Deterministic validation controls the outcome.
- [x] Manual fallback works.
- [x] Realtime teacher/learner canvas works.
- [x] Teacher marks are excluded from analysis.
- [x] Replay, Reset, and reload persistence work.
- [x] Text transcript and accessible controls work.
- [x] Any incomplete supporting family is cut and hidden.

## Validation

- [x] Clean clone succeeds.
- [x] `bun install --frozen-lockfile`.
- [x] `bun run validate`.
- [x] `bun run test:live-ai`.
- [x] `bun run smoke:prod`.
- [x] Full JUDGING path passes.
- [x] AI-disabled path passes.
- [x] Two-context collaboration passes.
- [x] No P0/P1 issues.
- [x] Rollback target recorded.

## Security and licenses

- [x] No secrets or capability links in repo, bundle, source maps, logs, or current screenshots; final video remains pending.
- [x] Private R2 authorization verified.
- [x] Teacher/learner permissions verified.
- [x] Application rate limits and kill switch configured and tested.
- [ ] OpenAI dashboard spending/rate limit confirmed by the owner.
- [x] No required personal data.
- [x] Apache-2.0 license present.
- [x] `THIRD_PARTY_NOTICES.md` complete.
- [x] All code, images, sound, fonts, and music have verified rights.

## Repository

- [ ] README has every required item except the pending public video URL.
- [x] JUDGING has exact URL and 3–6 steps.
- [x] STATUS accurately records done/cut scope.
- [ ] Evidence matrix has no unresolved required PENDING/FAIL.
- [x] Repository access is public and license metadata is Apache-2.0.
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
Production URL: https://lost-lessons-lab.sanocks.workers.dev
Judge URL: https://lost-lessons-lab.sanocks.workers.dev/judge
Repository URL: https://github.com/alexandr-panchenko/lost-lessons-lab
Video URL: pending owner upload
Submission commit: pending final evidence commit
Submission tag: build-week-submission (not created)
Cloudflare deployment/version: 968d9590-25e6-4a6d-8ea6-e6b12febb9be
Representative Codex Session ID (private): pending /feedback
Devpost project URL: pending owner draft
Submitted confirmation time: pending owner submission
```
