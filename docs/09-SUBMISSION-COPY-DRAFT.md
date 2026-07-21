# 09 — Submission copy draft

> **Draft only.** Replace every bracketed item and remove every claim that is not backed by `docs/08-SUBMISSION-EVIDENCE.md` on the exact submission release.

## Project name

### Recommended

**Lost Lessons Lab**

Why it works:

- “Lost lessons” describes prerequisite gaps without tying them to age or grade.
- “Lab” suggests experiments, simulations, and retries.
- It works for teachers and learners.
- It does not copy a specific existing story or character.

### Alternatives

- Math Consequence Lab
- Oops Physics
- Errorverse Math Lab
- Fix the World
- Math Mayhem Lab

Do not change the final name after screenshots and video unless every asset is updated.

## Tagline

**Turn handwritten math mistakes into playful physics—and make every retry worth doing.**

Character count: **85** including spaces and punctuation.

## Short description

Lost Lessons Lab is a shared tutoring room where a learner solves a real math problem in free-form handwriting. GPT-5.6 interprets the work, validated values control a playful 2D physics simulation, and the learner can see exactly how an error changed the world before correcting it and trying again.

## Track

**Education**

## Track rationale

Tutors often identify a specific prerequisite gap—such as confusing `3/4` with `0.34`—while helping a learner with a broader topic. Lost Lessons Lab turns that gap into targeted visual practice. The teacher chooses or describes the skill, the learner works naturally, and the room preserves attempts, explanations, simulations, and teacher annotations. The application does not claim to measure mastery; it gives teachers a clearer, more engaging way to observe and discuss a misconception.

## Technology tags

Use only tags that are implemented in the submission release:

- OpenAI
- GPT-5.6
- Responses API
- Structured Outputs
- Codex
- TypeScript
- React
- Vite
- Cloudflare Workers
- Durable Objects
- WebSockets
- R2
- PixiJS
- Planck
- Bun
- Vitest
- Playwright

Remove any tag for a cut or replaced technology.

# Devpost story draft

## Inspiration

A wrong answer in a conventional exercise usually ends with a red mark. That is especially discouraging for learners who already believe they are “bad at math.”

But a mathematical answer is also a prediction about a world. If a learner converts `3/4` to `0.34`, a bridge built from that value should become visibly too short. If a volume is too large, the tank should overflow. If speed is miscalculated, the vehicles should arrive at the wrong time.

We wanted to make the mistake itself worth exploring.

## What it does

Lost Lessons Lab is a no-login shared room for a tutor and learner.

The tutor starts with a concrete gap, such as:

> My learner treats three quarters as 0.34.

The room selects a supported task and gives the learner a normal mathematical problem. The learner writes a free-form solution on a shared canvas rather than filling a prescribed worksheet.

GPT-5.6 reads the handwriting, reconstructs the learner's steps, extracts candidate values, and identifies a likely first error. Deterministic code validates the arithmetic, units, and simulation inputs. Those values then control a real 2D physics scene.

In the hero scenario, engineers have a 12-meter bridge kit and need to deploy three quarters of it. The prepared wrong solution produces `4.08 m`, so the simulated bridge is genuinely too short and the rescue vehicle falls into a safe comic recovery area. The learner changes the conversion to `0.75`, gets `9 m`, and the vehicle crosses.

The application connects the calculation and consequence in the same feed:

```text
task
→ handwriting
→ interpretation
→ physical result
→ explanation
→ correction
→ successful retry
```

The tutor can annotate the learner's canvas in realtime. Teacher annotations are stored separately and never enter the learner's AI analysis.

## How we built it

The web application is written in TypeScript with React and Vite and deployed as a Cloudflare Worker.

Each room is owned by a SQLite-backed Durable Object. It stores the ordered learning feed, task state, immutable attempts, simulation inputs, and a realtime WebSocket operation log for the shared canvas. Visible attempt media is stored privately in R2 and served only through the authorized Worker.

The canvas sends simplified stroke operations after pointer release. The Durable Object assigns a canonical sequence. Student and teacher strokes are separate layers, so a teacher can draw over a solution without changing the submitted learner attempt.

The simulation renderer uses PixiJS and Planck. Correctness is calculated before physics starts; physics visualizes the result rather than grading the learner. Replay reconstructs a scene from the saved template and inputs, so debris can vary while the mathematical outcome remains stable.

GPT-5.6 is called server-side through the Responses API with text and a student-only handwriting image. Its result must match a strict Structured Output schema, then pass template-specific semantic validation. If analysis fails or handwriting is unreadable, the room offers a deterministic input form that launches the same real simulation.

## How we used GPT-5.6

GPT-5.6 performs the part that a rigid answer form cannot:

- reads free-form handwritten mathematics;
- understands multiple lines and alternative solution styles;
- transcribes the learner's steps;
- extracts values needed by the current simulation template;
- identifies a likely first mathematical error;
- explains the result in learner-facing language;
- maps a teacher's natural-language request to a supported skill and task.

GPT-5.6 does not directly control the physics engine and does not generate executable scene code. Deterministic code validates numbers, units, expected answers, allowed templates, and the physical outcome class.

This boundary lets the learner write naturally without allowing an unverified model output to mutate arbitrary application state.

## How we used Codex

[Replace with evidence from the actual build.]

Draft:

Codex was the primary implementation agent for the repository. Before coding, we supplied a frozen product brief, UX flow, decision log, technical design, milestone runbook, test plan, security/deployment design, and evidence matrix.

The primary Codex session worked milestone by milestone:

1. established the reproducible Cloudflare environment;
2. deployed a persistent no-login room;
3. built the realtime layered canvas and deterministic bridge simulation;
4. connected GPT-5.6 with strict validation and fallback;
5. completed the judge flow;
6. hardened failure paths and accessibility;
7. ran release and evidence checks.

For each milestone, Codex updated `STATUS.md`, added tests, ran the required commands, deployed a green slice, reviewed its diff, committed the milestone, and recorded evidence. The representative `/feedback` Session ID is included in the Devpost submission.

Add exact commits, files, and any additional meaningful sessions. Do not claim that one session built all core functionality unless the Git history and Session evidence support it.

## Human decisions

The human product owner made the decisions that define the product:

- focus on specific knowledge gaps rather than age or school grade;
- make the tutor the professional user and the learner the interactive user;
- use a shared room without registration;
- use one continuous learning feed rather than a dashboard;
- accept free-form reasoning instead of forcing a worksheet format;
- keep teacher annotations out of learner analysis;
- use GPT for interpretation and deterministic code for validation;
- let mathematical values parameterize real physics;
- make wrong answers fun and replayable;
- reserve mastery judgments for the teacher;
- prioritize one complete bridge scenario over a broad but unreliable library;
- use original 2D side-view visuals;
- deploy and test each scenario as an independent slice.

## Challenges

[Keep only challenges proven by implementation evidence.]

Likely challenge areas:

### Free-form handwriting versus reliable state

The learner needed freedom to solve naturally, while the simulation needed strict parameters. We separated interpretation and validation: GPT-5.6 produces a structured candidate; deterministic template code validates it before the scene starts.

### Live canvas versus immutable attempts

The room needed a canvas that remained editable, but a submitted attempt could not change after the fact. We store ordered stroke operations and freeze an attempt at a student-layer sequence cutoff. Teacher annotations remain live in a separate layer.

### Physics spectacle versus mathematical correctness

A dynamic scene can vary by frame rate or debris behavior. We decide correctness first and pass a semantic outcome to the physics scene. The scene may look slightly different on replay, but it cannot change whether the answer is correct.

### AI latency and failure

The first screen explains the value before the model call. Analysis shows meaningful stages, has a bounded retry policy, and falls back to a template-specific input form without losing the learner's work.

## Accomplishments

Replace with verified items, for example:

- [ ] A clean judge can complete the wrong-to-correct bridge loop in under 90 seconds.
- [ ] GPT-5.6 reliably extracts `0.34`, `4.08 m`, `0.75`, and `9 m` from the prepared handwriting.
- [ ] Teacher and learner strokes synchronize in realtime.
- [ ] Teacher annotations are proven absent from AI input.
- [ ] Changing the submitted number changes real bridge geometry.
- [ ] Replay does not make another AI call.
- [ ] AI-disabled fallback completes the same physics flow.
- [ ] Reload restores the room.
- [ ] Production passes unit, integration, E2E, live-AI, and smoke checks.
- [ ] [Any finished supporting family.]

Remove unchecked accomplishments from final copy.

## What we learned

[Rewrite from actual implementation.]

Draft themes:

- A model is most useful here as an interpreter between human expression and a strict domain contract, not as an unbounded controller.
- Small deterministic validators can make a multimodal experience far more trustworthy.
- Durable Objects fit a room-centric collaboration model because one actor can order strokes and persist a conversation without a separate CRDT service.
- Educational feedback becomes more memorable when a number changes a visible system rather than merely changing a score.
- Reliability and evidence are product features in a judged demo.

## What's next

Do not promise these as current functionality.

Potential next steps:

- expand the tested simulation library across fractions, volume, proportions, motion, area, and equations;
- add optional photo capture for notebook work;
- add carefully designed voice explanation;
- let tutors author parameter packs within safe template constraints;
- evaluate the interaction with tutors and learners;
- study whether visible consequences improve retry behavior and conceptual recall;
- conduct the privacy, consent, and compliance work required for real school use.

## Potential impact

Use cautious language:

Lost Lessons Lab is designed to help a tutor turn a known misconception into a visual, discussable experiment without preparing a custom animation. It may help learners connect symbols to consequences and approach a retry with curiosity rather than shame.

The Build Week demo proves the interaction and technical architecture. It does **not** prove improved grades, long-term retention, or mastery. Those outcomes require user research and educational evaluation.

## Novelty

The novelty is not simply “AI generates a math question” or “a physics game teaches math.”

The central model is:

```text
teacher-identified gap
→ free-form learner reasoning
→ multimodal structured interpretation
→ deterministic mathematical validation
→ parameterized physical consequence
→ guided retry
```

The learner's mathematics is the only controller. The simulation is an observable consequence of the submitted reasoning.

# Testing instructions draft

Replace placeholders with final production details.

1. Open **[PRODUCTION_URL]/judge**. No account or credentials are required.
2. Select **Student view**.
3. Press **Run my solution** on the prepared `3/4 = 0.34` handwriting.
4. Review the GPT-5.6 interpretation and watch the `4.08 m` bridge fail safely.
5. Apply the prepared correction to `0.75`, submit, and watch the `9 m` bridge succeed.
6. Press **Replay** or refresh the page to verify persistence.
7. To test failure recovery, use **[exact controlled fallback instruction]** or the manual input offered after an analysis failure.

Expected result:

- wrong input creates a physically short bridge;
- correct input creates a successful crossing;
- recognition and explanation remain visible;
- no login, payment, or user API key is required.

# Thumbnail and image plan

## Recommended thumbnail

A clean 3:2 frame:

- left: handwritten `3/4 = 0.34`;
- center: a bright red causal arrow or visual connection;
- right: a bridge ending halfway over a comic ravine with the rescue character;
- short title: **“Your math changes the world.”**

Avoid:

- tiny UI screenshot;
- dense text;
- logos as the main subject;
- copyrighted characters;
- a frame that looks like a generic worksheet;
- showing a private room token.

## Gallery shot list

1. Guided first room.
2. Tutor skill request and generated task.
3. Shared learner canvas with separate teacher annotation.
4. GPT-5.6 recognition card.
5. Short bridge failure.
6. Error explanation and disaster discovery.
7. Correct bridge crossing and progress achievement.
8. Manual fallback.
9. Any finished supporting simulation.
10. Responsive phone/tablet feed.

# Provisional video script

> Rewrite after the final product exists. Target about 2:00–2:20 and never exceed 3:00.

## 0:00–0:08 — Hook

**Visual:** The `4.08 m` bridge ends early; the rescue vehicle falls into the safe comic recovery area.

**Voice:**

> This bridge failed because a learner wrote that three quarters equals 0.34. In Lost Lessons Lab, the math is the controller.

## 0:08–0:24 — Problem

**Visual:** Teacher room and the prompt “What does your learner struggle with?”

**Voice:**

> Tutors often spot a precise gap, but turning it into a personalized visual explanation takes time. A red “incorrect” also gives a discouraged learner little reason to try again.

## 0:24–0:42 — Teacher to task

**Visual:** Teacher request about fraction conversion, supported skill, task appears.

**Voice:**

> The tutor describes the gap in ordinary language. The room selects a supported simulation and creates a real task without asking for an account.

## 0:42–1:03 — Handwriting and GPT-5.6

**Visual:** Learner writes on canvas; status stages; recognition card.

**Voice:**

> The learner solves it naturally on a shared canvas. GPT-5.6 reads the handwriting, reconstructs the steps, and finds the likely error. Strict validation then converts the interpretation into safe simulation inputs.

## 1:03–1:20 — Physical consequence

**Visual:** Show `4.08 m` input controlling the bridge, failure, explanation, disaster discovery.

**Voice:**

> The submitted value does not select a prerecorded animation. It changes the actual bridge geometry in a 2D physics scene, and the room explains exactly why it failed.

## 1:20–1:37 — Retry and success

**Visual:** Correct `0.34` to `0.75`; recognize `9 m`; successful crossing.

**Voice:**

> The learner corrects the conversion, gets nine meters, and tries again. This time the world works—and the progress achievement describes what happened without pretending to measure mastery.

## 1:37–1:51 — Collaboration and reliability

**Visual:** Teacher annotation in a second context; Replay; manual fallback.

**Voice:**

> Teacher notes sync in realtime but stay out of the learner's AI analysis. Replay needs no new model call, and a deterministic form keeps the same simulation usable if AI is unavailable.

## 1:51–2:09 — Architecture and Codex

**Visual:** Brief architecture diagram, tests, milestone commits, deployed URL.

**Voice:**

> Codex built the project milestone by milestone from a frozen design packet. The application runs on Cloudflare Workers, Durable Objects, R2, React, PixiJS, and Planck, with GPT-5.6 through the Responses API.

## 2:09–2:18 — Close

**Visual:** Successful rescue and title.

**Voice:**

> Lost Lessons Lab makes a mistake visible, memorable, and worth correcting. Fix the math to fix the world.

# Final-copy gate

Before publishing:

- [ ] Every “built” statement is true on the tagged release.
- [ ] Every technology tag exists in the lockfile or deployment.
- [ ] Every AI claim has real model evidence.
- [ ] Every screenshot is from production.
- [ ] No room capability or personal content is visible.
- [ ] Video timestamps are final.
- [ ] Codex Session ID is recorded correctly.
- [ ] No learning-impact claim exceeds evidence.
- [ ] Cut simulation families are absent.
- [ ] Production, README, JUDGING, Devpost, and video agree.
