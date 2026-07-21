# 13 — Codex readiness review

Review date: 2026-07-21

## Frozen project summary

Lost Lessons Lab is an English-language Education web application for tutor-guided correction of specific mathematical knowledge gaps.

The protected end-to-end loop is:

```text
guided teacher room
→ supported bridge/fractions task
→ learner freehand work on shared canvas
→ GPT-5.6 structured interpretation
→ deterministic math and input validation
→ parameterized 2D physics consequence
→ explanation
→ corrected attempt
→ successful crossing
→ replay, reset, and persistence
```

The room has separate teacher and learner capability links, no registration, one continuous feed, realtime layered canvas operations, one active AI analysis, a template-specific manual fallback, and a new isolated room for every `/judge` visit.

## Source-of-truth consistency

| Check | Result |
|---|---|
| Product audience and problem consistent | pass |
| Hero task wording consistent and does not reveal `9 m` | pass |
| GPT and deterministic-code boundary consistent | pass |
| Teacher annotations excluded from learner analysis everywhere | pass |
| One active analysis, serial learner submission | pass |
| No application migration framework | pass |
| No link lifecycle, account, or recovery workflow | pass |
| One continuous feed across devices | pass |
| Planck/PixiJS 2D stack consistent | pass |
| Durable Object/R2 persistence boundary consistent | pass |
| Replay requires semantic, not frame-identical, outcome | pass |
| Apache-2.0 license consistent | pass |
| Supporting-family priority and cut order consistent | pass |
| Submission claims marked pending until evidence exists | pass |

## Implementation-plan readiness

| Requirement | Result |
|---|---|
| Every required milestone has an objective | pass |
| Affected files/components are listed | pass |
| Implementation steps are explicit | pass |
| Acceptance criteria are explicit | pass |
| Validation commands are explicit | pass |
| Expected UI/behavior is described | pass |
| Failure handling is described | pass |
| Dependencies are identified | pass |
| Commit message is specified | pass |
| Fallback/cut option is specified | pass |
| Evidence to record is specified | pass |
| Production deployment appears early | pass — M2 |
| Protected core and global cut line are explicit | pass |
| Definition of done is explicit | pass |
| Environment-variable list is explicit | pass |
| No secret value is present | pass |

## Packet validation

The design packet was checked for:

- all required files;
- UTF-8 readability;
- final newlines;
- balanced Markdown code fences;
- existing relative links;
- English-only repository content;
- exact Apache-2.0 license text;
- tagline length under 140 characters;
- absence of a room-delete API or capability-lifecycle scope;
- presence of the frozen hero and serial analysis rules.

Implementation tests have not run because application code does not exist yet. `STATUS.md` states this explicitly.

## Remaining risks

These are implementation measurements, not unresolved product decisions.

### R1 — External credentials

Cloudflare deployment and live GPT evaluation require:

- GitHub repository and Actions context;
- Cloudflare account, Worker resources, and scoped token;
- OpenAI API project/key and access to the configured model.

Impact: Codex can complete M1 locally without them. It must stop only at the first external validation that requires a missing credential.

### R2 — Handwriting accuracy and latency

The exact quality and p90 latency of the real prepared and varied handwriting corpus are unknown until M4 live evaluation.

Controls:

- clean student-only raster;
- visible interpretation;
- strict schema;
- deterministic semantic validation;
- one repair/retry maximum;
- template-specific manual fallback;
- measured threshold for moving only AI execution to Queue/Workflow.

### R3 — Physics performance on modest devices

The bridge is expected to be modest. Water, sand, and destruction body counts require measurement.

Controls:

- fixed timestep;
- continuous collision for critical fast bodies;
- pooled and capped bodies/particles;
- semantic correctness determined before physics;
- optional families cut as complete slices.

### R4 — Current platform details

OpenAI and Cloudflare documentation can change after packet creation.

Control: M1 and M4 explicitly require checking current official documentation, generated templates, SDK types, and bindings before fixing exact versions or API syntax.

### R5 — Schedule

The complete hero crosses AI, realtime, media, physics, accessibility, and production surfaces.

Control: M2 deploys early; M3 creates a full deterministic bridge before AI; supporting families are optional and cut first.

## Human actions before Codex

1. Create the dedicated GitHub repository.
2. Copy this packet to the repository root.
3. Run a secret scan.
4. Commit:

```text
chore: freeze Build Week product design and execution plan
```

5. Push the repository.
6. Open the correct Codex environment.
7. Start the primary session with `CODEX-KICKOFF.md`.
8. Add external credentials only through secure environment configuration when the relevant milestone needs them.
9. Record `/feedback` Session ID privately.

## Readiness verdict

# READY FOR CODEX

There is no unresolved product or architecture decision that should make the implementation agent reopen design. The remaining unknowns are handled by explicit measurements, failure paths, and cut rules.
