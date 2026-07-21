# 03 — Decision log

This file resolves product and architecture ambiguity. All decisions are frozen unless implementation proves one impossible or unsafe. A change must record the replacement decision, reason, consequences, and date before code diverges.

Dates use ISO format.

## Product and audience decisions

| ID | Date | Decision | Reason | Consequence |
|---|---|---|---|---|
| D-001 | 2026-07-20 | Enter the Education track as a standalone project. | The product solves a concrete tutoring and learning problem. | Product claims, evidence, and judging focus on educational utility. |
| D-002 | 2026-07-20 | The primary professional user is a math tutor or teacher; the interactive user is the learner. | The tutor identifies the gap while the learner performs the core interaction. | Both roles exist, but the learner's work and simulation are the hero experience. |
| D-003 | 2026-07-20 | Organize content by knowledge gap and skill, not age, grade, or curriculum year. | Learners can have prerequisite gaps far below their formal grade. | Do not ask for age or infer difficulty from school year. |
| D-004 | 2026-07-20 | Use English only in the Build Week version. | Submission and judging are in English; localization expands QA. | Copy, sample tasks, docs, and evidence are English. |
| D-005 | 2026-07-20 | Primary use is individual tutoring in a shared room, also usable asynchronously. | Live guidance is valuable, while a judge or learner must be able to use it alone. | Room state persists; no simultaneous second person is required for judging. |
| D-006 | 2026-07-20 | The application does not declare that a learner has mastered a topic. | Mastery depends on context and teacher judgment. | Achievements report observable actions only. |
| D-007 | 2026-07-20 | List only currently supported skills and answer unsupported requests honestly. | The demo must not promise simulations it cannot run. | Unsupported requests offer nearby supported alternatives. |
| D-008 | 2026-07-20 | Errors are encouraged as experiments, including intentional wrong answers. | Producing an intentional error often requires understanding and makes the system playful. | Disaster discoveries are positive, while correct answers unlock the story resolution. |
| D-009 | 2026-07-20 | Use original visual language and do not mention or adapt a specific source work in submission copy. | The general “mistake changes the world” idea is broader than one inspiration. | No borrowed characters, scenes, names, or copyrighted assets. |

## Core product loop decisions

| ID | Date | Decision | Reason | Consequence |
|---|---|---|---|---|
| D-010 | 2026-07-20 | The math is the controller; learners do not directly drive the simulation. | The physical consequence must demonstrate the calculation. | Keyboard or game controls cannot change the educational result. |
| D-011 | 2026-07-20 | Accept free-form handwritten reasoning rather than a prescribed sequence of fields. | Strict worksheet formats reject valid creative methods. | GPT interprets the work before deterministic validation. |
| D-012 | 2026-07-20 | Always show the system's interpretation of the learner's work. | A recognition mistake must not be invisible. | The feed contains transcription, steps, inputs, and uncertainty. |
| D-013 | 2026-07-20 | Use a two-second cancelable countdown before simulation. | Most users should proceed quickly, while obvious recognition errors can be stopped. | Exact timing is a tunable UX constant, not a new product decision. |
| D-014 | 2026-07-20 | Corrections use new canvas work or a free-text clarification, not a strict formula editor. | The product must preserve natural reasoning. | A correction creates a later attempt. |
| D-015 | 2026-07-20 | Wrong and correct simulations are both replayable. | Catastrophes are part of the learning incentive and judging evidence. | Replay does not call GPT again. |
| D-016 | 2026-07-20 | Separate progress achievements from disaster discoveries. | A single score would confuse practice with proficiency. | Neither collection is a mastery rating. |
| D-017 | 2026-07-21 | Allow only one active learner analysis per room. | The user explicitly preferred simple serial behavior. | Submission and correction controls remain locked until analysis completes. |
| D-018 | 2026-07-20 | Use a template-specific manual parameter fallback. | AI must not be a single point of failure. | The same physics scene remains usable without handwriting diagnosis. |

## Hero and scope decisions

| ID | Date | Decision | Reason | Consequence |
|---|---|---|---|---|
| D-019 | 2026-07-20 | The frozen hero family is fractions and the bridge. | It makes handwriting, a common misconception, causality, physics, failure, and correction visible immediately. | Every required layer must work for this family before any supporting family. |
| D-020 | 2026-07-20 | Hero wording: a 12-meter bridge kit; deploy three quarters; ask how many meters. | The earlier wording accidentally revealed the `9 m` result. | The prompt never states the ravine length as the answer. |
| D-021 | 2026-07-20 | Prepared wrong work is `3/4 = 0.34`, `12 × 0.34 = 4.08 m`. | It represents a concrete, visually consequential fraction-conversion error. | The bridge is `4.08 m` and fails safely. |
| D-022 | 2026-07-20 | Prepared correct work is `3/4 = 0.75`, `12 × 0.75 = 9 m`. | It closes the same causal loop. | The bridge reaches the far side and the rescue succeeds. |
| D-023 | 2026-07-21 | Current scope has at most three supporting families: water/volume, speed/time/collision, structure/load/destruction. | The hero must remain complete while the design still supports an ambitious library. | Each family is a separate optional vertical slice. |
| D-024 | 2026-07-21 | Cut supporting families in order structure, then speed, then water. | Water is the highest-priority supporting spectacle after the bridge. | No incomplete family appears in the supported-skill UI. |
| D-025 | 2026-07-21 | Do not reduce realtime collaboration, real physics, AI interpretation, or fallback to preserve more scenarios. | The complete product loop matters more than breadth. | Breadth is the first schedule variable. |
| D-026 | 2026-07-21 | New features after freeze require an explicit scope swap. | Uncontrolled expansion threatens the working demo. | The kill list in the product brief and implementation plan is binding. |

## Entry, room, and layout decisions

| ID | Date | Decision | Reason | Consequence |
|---|---|---|---|---|
| D-027 | 2026-07-20 | Opening `/` immediately creates a guided, non-empty teacher room. | A create step costs time and an empty chat creates uncertainty. | Root redirects to a unique room URL. |
| D-028 | 2026-07-20 | The first block explains the next action, shows supported skill chips, and offers a free prompt. | The user must understand the product within five seconds. | No large catalog and no blank open question. |
| D-029 | 2026-07-20 | Create separate teacher and student capability links. | Roles should be easy to share without accounts. | Access is link-based. |
| D-030 | 2026-07-21 | Do not build link rotation, revocation, recovery, or resending workflows. | This is a demo product and the user explicitly requested simplicity. | Losing a link has no recovery path; creating a new room is the recovery. |
| D-031 | 2026-07-20 | The teacher can preview and act as the learner in one tab. | A judge cannot be expected to operate two users. | A role-view switch is the only tab-like global control. |
| D-032 | 2026-07-20 | Use one continuous vertical learning feed. | It preserves the causal sequence and adapts naturally to mobile. | No permanent dashboard columns or mobile workflow tabs. |
| D-033 | 2026-07-20 | Teacher setup chat is hidden from learner view; the teacher can see learner-facing activity. | The teacher needs private task setup and visible learner process. | Feed visibility is role-filtered. |
| D-034 | 2026-07-20 | The same feed model is used on desktop, tablet, and phone. | Separate responsive workflows add needless complexity. | Small-phone handwriting is best effort, not a comfort guarantee. |
| D-035 | 2026-07-20 | English visual copy uses a playful textbook/game hybrid, not a childish or photorealistic style. | It must work across learner ages and be inexpensive to author. | Simple 2D original assets and readable quantities are preferred. |

## Canvas and collaboration decisions

| ID | Date | Decision | Reason | Consequence |
|---|---|---|---|---|
| D-036 | 2026-07-20 | The main answer input is the built-in handwriting canvas. | It is immediately testable by a desktop judge and demonstrates multimodal interpretation. | Photo upload is a later slice, not a hero dependency. |
| D-037 | 2026-07-20 | Canvas tools are pen, highlighter, whole-stroke eraser, undo/redo, and clear. | These cover learner work and teacher annotation without building a whiteboard suite. | Shapes, layers UI, typed formula blocks, and rich editing are out of scope. |
| D-038 | 2026-07-20 | Store drawing as simplified stroke operations sent on pointer release. | It reduces traffic and matches the desired editor behavior. | The server stores points and style, not every pointer event. |
| D-039 | 2026-07-20 | The room Durable Object assigns a monotonically increasing sequence to accepted operations. | A single room actor can provide a simple canonical order without CRDT. | Clients reconcile optimistic strokes to server order. |
| D-040 | 2026-07-20 | Keep student, teacher, and system drawing layers logically separate. | Teacher hints must not alter the learner's answer. | AI rasterization includes only the student layer. |
| D-041 | 2026-07-20 | A submitted attempt is an immutable student-layer operation cutoff. | Live editing and historical reproducibility must coexist. | Later strokes cannot alter an earlier analysis. |
| D-042 | 2026-07-20 | Synchronize inputs and simulation launch, not every physics frame. | Frame-level multiplayer simulation adds complexity without educational value. | Different clients may show minor debris differences. |
| D-043 | 2026-07-20 | Erasing creates a tombstone operation rather than deleting history. | Undo and reconstruction of old attempts must remain deterministic. | Storage can reconstruct state at any sequence. |

## AI and deterministic-boundary decisions

| ID | Date | Decision | Reason | Consequence |
|---|---|---|---|---|
| D-044 | 2026-07-21 | Use OpenAI Responses API with model ID `gpt-5.6`. | It supports the required current multimodal and structured workflow. | Model ID remains server configuration. |
| D-045 | 2026-07-21 | Send text plus a clean student-work image and request strict Structured Output. | The application needs predictable fields for simulation. | All state-changing outputs pass schema validation. |
| D-046 | 2026-07-20 | GPT reads free-form work, extracts steps and parameters, identifies a likely first error, and writes an explanation. | These tasks require semantic interpretation beyond arithmetic parsing. | AI use is visible and substantive. |
| D-047 | 2026-07-20 | Deterministic code validates arithmetic, units, ranges, template inputs, correctness, and achievements. | Physics and app state must not depend on an unverified model claim. | GPT is not the final authority for outcome classification. |
| D-048 | 2026-07-20 | The teacher-agent may select a template, propose parameters within constraints, and generate flavor wording. | This creates personalization without executing generated code. | Validators reject unsupported or answer-revealing tasks and use curated fallback packs. |
| D-049 | 2026-07-20 | GPT never generates executable simulation JavaScript. | Reliability and security require a fixed template contract. | New simulation families are source-controlled code. |
| D-050 | 2026-07-21 | Permit at most one bounded AI retry and then use fallback. | Hidden retry loops threaten latency and demo reliability. | Timeout and retry values remain configurable. |
| D-051 | 2026-07-21 | Use a 24-second initial total AI budget, pending live measurement. | It fits the initial Cloudflare asynchronous execution design and provides a clear UX boundary. | Move only the AI job to a Queue/Workflow if measured p90 violates the threshold. |
| D-052 | 2026-07-21 | Show workflow statuses, not partially streamed structured JSON. | Partial fields are not safe until full schema and semantic validation. | The recognition card appears atomically after validation. |
| D-053 | 2026-07-21 | Send OpenAI requests server-side with `store: false`. | Keys must stay private and application state should remain in the room system. | No browser OpenAI SDK or OpenAI Conversations dependency. |
| D-054 | 2026-07-20 | On GPT/validator disagreement, run the validated inputs and label the explanation uncertain. | Contradictory green success and physical failure would destroy trust. | Both extracted values and validation result stay visible. |

## Physics and rendering decisions

| ID | Date | Decision | Reason | Consequence |
|---|---|---|---|---|
| D-055 | 2026-07-20 | Use flat 2D side-view scenes by default. | This is readable like a textbook diagram and supports classic physics-game spectacle. | Top-down 2D is allowed only when a specific task benefits. |
| D-056 | 2026-07-21 | Use PixiJS for rendering and Planck for 2D physics. | This is a direct, TypeScript-friendly, browser-native stack with Box2D-style collision handling. | Pixi and Planck are integrated imperatively under React. |
| D-057 | 2026-07-21 | Run physics at a fixed timestep and enable continuous collision handling for fast bodies. | Fast objects must not tunnel through thin geometry. | Scene contract tests cover extreme speeds and bounds. |
| D-058 | 2026-07-20 | Determine correctness before physics starts. | Random collisions must never grade the learner. | Physics visualizes a semantic outcome class. |
| D-059 | 2026-07-20 | Use hybrid physical bodies plus authored visual effects for water, sand, fire, smoke, and destruction. | Full scientific simulation is unnecessary and too expensive. | Mathematical volume/load remains deterministic; visual particles may vary. |
| D-060 | 2026-07-20 | Replay need only preserve the semantic result, not exact trajectories. | Exact frame replay has no product value. | Save template/version/inputs/presentation/optional seed, not physics frames or event logs. |
| D-061 | 2026-07-20 | Simulation controls include replay, pause/resume, 2×, skip to result, mute, and transcript. | Spectacle must not slow repeated practice or block accessibility. | Most scenes target 12–20 seconds, with about 30 seconds as a soft ceiling. |

## Cloudflare, data, and deployment decisions

| ID | Date | Decision | Reason | Consequence |
|---|---|---|---|---|
| D-062 | 2026-07-21 | Use one Cloudflare Worker deployment for the React SPA, API, media authorization, and room routing. | A single origin reduces CORS, secrets, and deployment coordination. | No separate backend service. |
| D-063 | 2026-07-21 | Use one SQLite-backed Durable Object per room. | A room is a natural coordination and persistence unit. | Room-local data does not need D1 or KV. |
| D-064 | 2026-07-21 | Use Durable Object Hibernation WebSockets for realtime room events. | The room needs long-lived collaboration without keeping every object active. | Constructor logic restores all authoritative state from storage. |
| D-065 | 2026-07-21 | Store visible binary media in a private R2 bucket. | Durable Object storage should hold structured state, not large media blobs. | The Worker serves media after capability checks. |
| D-066 | 2026-07-21 | Persist visible product history, not hidden model reasoning or a raw orchestration transcript. | Reload needs the user experience, not internal implementation artifacts. | Store tasks, attempts, visible messages, analyses, runs, and achievements. |
| D-067 | 2026-07-21 | If source media is visible in the feed, preserve it; if it is only a temporary processing input, it may be discarded. | Retention should match the visible product contract. | Visible canvas snapshots and displayed uploads have R2 references. |
| D-068 | 2026-07-21 | Do not build an application migration framework for demo rooms. | The user explicitly requested that incompatible demo data be discarded. | Use a fresh room namespace/class version or clear old demo data after incompatible schema changes. |
| D-069 | 2026-07-21 | Still include the one-time Cloudflare Durable Object class registration required by deployment. | Platform resource creation is unavoidable and distinct from application data migrations. | Do not expand that declaration into a general migration subsystem. |
| D-070 | 2026-07-21 | Use Bun locally and GitHub Actions as the production deployment gate. | It matches the preferred local workflow and provides repeatable validation. | Deploy main only after format, lint, typecheck, tests, build, and E2E pass. |
| D-071 | 2026-07-21 | Deploy a working production slice after every completed milestone. | The project must remain inspectable and recoverable at all times. | Each milestone records URL evidence and a commit. |
| D-072 | 2026-07-21 | Use Cloudflare rollback rather than risky forward repair during final freeze. | Submission stability matters more than live iteration. | Preserve the submission commit and tag. |

## Security, privacy, and reliability decisions

| ID | Date | Decision | Reason | Consequence |
|---|---|---|---|---|
| D-073 | 2026-07-21 | Store only hashes of room capabilities server-side and never log tokens. | Link access should not expose reusable secrets through storage or logs. | URLs use high-entropy values and `Referrer-Policy: no-referrer`. |
| D-074 | 2026-07-21 | Do not collect real names, ages, schools, or other required personal data. | The demo can prove value without child identity data. | Roles default to `Teacher` and `Learner`; UI warns against entering PII. |
| D-075 | 2026-07-21 | Apply one active AI request per room plus configurable per-room, per-IP, and room-creation limits. | A public demo needs cost and abuse protection without judge friction. | Initial defaults are documented in `.env.example`. |
| D-076 | 2026-07-21 | Include an `AI_ENABLED` server-side kill switch. | The product must remain demonstrable if AI is unavailable or spending must stop. | Fixture and template-specific manual fallback remain usable. |
| D-077 | 2026-07-21 | Log identifiers, timings, request IDs, usage, and error categories—but not handwriting content or media. | Operations need evidence without leaking learner work. | Debug body logging is disabled in production. |
| D-078 | 2026-07-21 | Use semantic HTML, keyboard controls, live regions, reduced motion, and a text simulation transcript. | Judges and automated agents must understand non-canvas state. | Accessibility is part of done, not post-submission polish. |
| D-079 | 2026-07-21 | Accept PNG, JPEG, and WebP up to configurable limits, validate content, and resize analysis copies. | This controls memory and model latency. | Initial defaults: 8 MB, 4096 px original edge, about 2048 px analysis edge. |
| D-080 | 2026-07-21 | The repository license is Apache License 2.0. | This is the user's standing preference. | Third-party dependencies and assets require compatible licensing and notices. |

## Judge, test, and evidence decisions

| ID | Date | Decision | Reason | Consequence |
|---|---|---|---|---|
| D-081 | 2026-07-21 | Every `/judge` visit creates a new room from `judge-v1`. | Judges must not share mutable demo state. | Redirect to the normal room URL after creation. |
| D-082 | 2026-07-21 | `judge-v1` is source-controlled and versioned. | The first impression must be repeatable without becoming a fake app. | Fixture content is prepared, while real analysis remains available. |
| D-083 | 2026-07-21 | CI uses deterministic OpenAI contract fixtures; live GPT-5.6 evaluation runs before release. | Every commit must be reliable without making external model calls. | Live eval evidence is required before submission freeze. |
| D-084 | 2026-07-21 | E2E covers one-tab judging and two-context realtime collaboration. | Both judge convenience and the actual shared-room promise need evidence. | Teacher annotations must be proven absent from AI input. |
| D-085 | 2026-07-21 | A milestone cannot advance with a failed required validation. | The process depends on a continuously working production slice. | Fix or explicitly cut the milestone before continuing. |
| D-086 | 2026-07-21 | Evidence claims stay `PENDING` until backed by a file, test, URL, screenshot, commit, or video timestamp. | Submission copy must not outrun the product. | The evidence matrix is updated during implementation. |
| D-087 | 2026-07-21 | Use one primary Codex build session when practical, but do not endanger the project to preserve one thread. | A coherent build trail is useful, but a failed session is not sacred. | Record the representative Session ID and disclose meaningful additional sessions. |
| D-088 | 2026-07-21 | Create the `build-week-submission` tag only after final production verification. | The tag must identify the exact judged release. | No tag is pre-created in the design packet. |
| D-089 | 2026-07-21 | Supersede the teacher-token preview in D-084 with a same-tab switch to the room's real student capability. | Human review found that copy/open-tab friction obscured the judge path and that a preview flag was weaker evidence than the actual learner role. | `/judge` presents one dominant learner action, retains a Teacher/Student control while the originating teacher capability is present, and preserves separate share links. |
| D-090 | 2026-07-21 | Hide water, speed, structure, and every unapproved scenario from the public rescue build without deleting implementation code. | Human review reopened the hero and suspended release readiness; public breadth must not outrun visual approval. | Public navigation and supported-topic messaging promise only the bridge/fractions flow; disabled scenario routes return to the bridge entry. |

## Change protocol

A frozen decision may change only when one of these is true:

- the selected platform or API cannot implement it;
- the decision creates a material security or privacy problem;
- a measured blocker makes the required path unreliable;
- the user explicitly changes scope.

Before changing code:

1. add a superseding row with a new ID and date;
2. name the old decision;
3. record evidence for the change;
4. update all affected source-of-truth documents;
5. update `STATUS.md`;
6. rerun the affected validation gate.

Normal implementation details do not require a decision-log entry when they stay inside these boundaries.
