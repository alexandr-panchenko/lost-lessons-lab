# 01 — Product brief

## One-sentence value

Lost Lessons Lab turns a learner's free-form handwritten math solution into a playful physical consequence inside a shared teacher–student room, making mistakes visible, memorable, and worth correcting.

## Problem

Tutors and teachers often notice a precise prerequisite gap while working on a different topic: a learner may be solving equations but still confuse `3/4` with `0.34`, mix units, misunderstand percentage, or fail to connect speed, time, and distance. Creating a personalized visual demonstration in the moment takes time.

Conventional practice products usually reduce the attempt to “correct” or “incorrect.” Repeated failure can lower confidence and make the learner avoid the topic. The abstract calculation remains disconnected from a visible consequence.

## Audience and context

### Primary professional user

A math tutor or teacher working one-to-one or with a very small group.

The tutor:

- identifies a specific knowledge gap;
- describes it to the teacher agent in ordinary language;
- receives a supported visual exercise;
- watches the learner work;
- annotates the shared canvas;
- judges learning outside the application.

### Interactive learner

A learner who needs practice with a specific mathematical skill. The product does **not** target an age or grade. A learner's current knowledge may differ substantially from their formal school year.

### Primary use context

A live individual tutoring session in a shared room, with the same room also usable asynchronously as practice between sessions.

## Supported skill boundary

Initial content is organized by skills rather than curriculum grade:

- fractions and decimal conversion;
- percentages and proportions;
- measurement units;
- area and volume;
- simple linear equations and equation construction;
- speed, time, and distance.

Possible later content includes selected geometry, areas of composite shapes, Pythagorean relationships, and visual intuition for more advanced concepts. These are not part of the frozen Build Week core.

Very elementary counting and basic arithmetic are not a priority for the demo. Exact generated angle geometry, derivatives, and integrals are out of the first implementation slices.

## Product promise

The product promises to:

- accept naturally written mathematical work;
- show how it was interpreted;
- convert supported values into a deterministic simulation contract;
- make a wrong answer produce an understandable physical consequence;
- help the learner correct and retry;
- preserve a visible room history for tutor and learner.

The product does not promise to:

- determine that a learner has mastered a topic;
- replace a tutor;
- cover all school mathematics;
- generate arbitrary executable simulations;
- provide an accredited assessment.

## Central product loop

```text
tutor identifies a gap
→ teacher agent selects a supported template
→ learner receives a real problem
→ learner writes a free-form solution
→ GPT-5.6 interprets steps and likely error
→ deterministic code validates scenario inputs
→ physics shows the consequence
→ learner corrects the work
→ successful simulation and progress achievement
```

## Emotional design

The application reverses the usual failure loop:

```text
ordinary practice:
mistake → disappointment → avoidance

Lost Lessons Lab:
mistake → surprising consequence → curiosity → explanation → retry
```

Wrong answers are not insults or punishments. They unlock **Disaster discoveries** such as a comically short bridge or an overflowing tank. Correct outcomes unlock separate **Progress achievements** such as `Fixed It`, `First-Try Landing`, or `Five Safe Crossings`.

Intentional wrong answers are allowed and can be encouraged as experimentation. Creating a deliberate error often requires understanding the correct relationship. Progress rewards still require successful outcomes.

## Frozen hero scenario

### Task

> Engineers have a 12-meter bridge kit. To cross the ravine, they must deploy three quarters of the kit. How many meters of bridge should they deploy?

The problem does not reveal that the required bridge length is `9 m`.

### Wrong attempt

```text
3/4 = 0.34
12 × 0.34 = 4.08 m
```

GPT-5.6 reads the work, extracts `4.08 m`, and identifies the likely first error: reading `3/4` as decimal digits rather than as division.

The simulation constructs a `4.08 m` bridge. A small original vehicle and rescue character fail to cross and land safely in a comic padded area. The scene must be visibly parameterized, not a prerecorded animation.

### Correct retry

```text
3/4 = 0.75
12 × 0.75 = 9 m
```

The bridge reaches the other side, the vehicle crosses, and the learner receives a progress achievement.

## Required end-to-end scope

The frozen core includes:

1. `/` creates a guided no-login teacher room.
2. `/judge` creates a separate real room from a versioned fixture.
3. Teacher and student have separate capability links.
4. Teacher can preview student view in one tab.
5. The room is one continuous responsive learning feed.
6. The shared canvas synchronizes operations in realtime.
7. Student and teacher strokes are separate layers.
8. The learner explicitly submits the current student work.
9. GPT-5.6 visibly interprets the handwriting.
10. Strict schema and deterministic validation produce bridge inputs.
11. A cancelable countdown launches the wrong simulation.
12. The feed explains the causal error and awards a Disaster discovery.
13. The learner submits a correction after analysis completes.
14. The correct simulation runs and awards a Progress achievement.
15. Both simulations support replay without a new model call.
16. Reload restores the visible feed.
17. AI failure reaches a template-specific manual input fallback.
18. Reset current task restores the judge fixture state.

## Supporting features

At most three supporting simulation families may be implemented after the hero is green.

### S1 — Water and volume

- volume, flow rate, time, underfill, overflow;
- deterministic liquid level plus bounded rigid-body droplets and authored splashes;
- at least three curated parameter packs and contract tests.

### S2 — Speed, time, and collision

- speed, time, distance, meeting or safe-passing calculations;
- correct outcome determined before physics;
- controlled comic collision or safe crossing.

### S3 — Structure, load, and destruction

- simple equation, scale, load, counterweight, or element count;
- prepared fragments for controlled destruction;
- no procedural fracture requirement.

Each family is an independent vertical slice. It remains hidden until its task generation, validation, physics, explanation, tests, and production deployment are complete.

## Scope cut order

Cut optional scope in this order:

1. structure/load;
2. speed/time;
3. water/volume.

Never cut the following to preserve breadth:

- real bridge physics;
- GPT-5.6 handwriting analysis;
- deterministic fallback;
- teacher–student room and shared canvas;
- wrong-to-correct retry loop;
- production deployment and judge route.

## Kill list

Do not add without an explicit scope swap:

- accounts, login, recovery, link lifecycle;
- classroom roster or full multiplayer classroom;
- mastery scores and automated pedagogical diagnosis;
- LMS integrations, payments, marketplace, public leaderboard;
- 3D, isometric rendering for decoration, soft-body/scientific fluid simulation;
- AI-generated executable simulation code;
- user simulation editor;
- full voice pipeline, mandatory photo workflow, formula editor;
- complex curriculum mapping or multilingual UI;
- data migration framework, CRDT, separate backend, D1, or KV;
- fifth simulation family before release freeze.

## Definition of done

The frozen product is done only when all are true:

- production works in a clean browser without login;
- `/judge` creates an isolated room;
- the task and next action are understandable without narration;
- one user can inspect teacher and student roles in one tab;
- two browser contexts synchronize strokes;
- teacher strokes never enter student analysis;
- real GPT-5.6 reads the prepared handwritten solution;
- the wrong answer produces a parameterized physical failure;
- the corrected answer produces a successful physical outcome;
- correction, replay, reset, and reload work;
- AI failure has a usable manual path;
- required automated tests and production smoke tests pass;
- submission copy contains only verified behavior.
