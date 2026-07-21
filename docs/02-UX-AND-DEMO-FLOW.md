# 02 — UX and demo flow

## UX thesis

Lost Lessons Lab is not a dashboard, course catalog, or game controller. It is a continuous learning conversation in which each substantial message can contain a real task, a shared handwriting canvas, an interpretation, a physics simulation, an explanation, or a next attempt.

The interface must make the next action obvious within five seconds.

Core principles:

1. **Start inside the product.** No marketing gate, account flow, or empty chat precedes the first useful action.
2. **The work stays visible.** Task, handwriting, interpretation, consequence, and correction remain in one scrollable feed.
3. **Math controls the scene.** The learner never drives the vehicle or manipulates the outcome with game controls.
4. **Errors are interesting, not humiliating.** Failure is safe, comic, explanatory, and replayable.
5. **The teacher guides; the product does not diagnose mastery.**
6. **Free-form reasoning is accepted.** The interface does not force a prescribed worksheet sequence.
7. **Every long operation has progress, recovery, and a deterministic fallback.**

## Routes

### `/`

Opening the root route creates a fresh teacher room and redirects to its unique room URL.

The first room block is already populated. It contains:

- a one-sentence explanation;
- the prompt **“What does your learner struggle with?”**;
- a prominent recommended sample;
- compact supported-skill chips;
- a free-form teacher request field.

There is no separate “Create room” step.

### `/judge`

Every visit creates a new real room from versioned fixture `judge-v1` and redirects to the normal room route.

This is not a mock application. The route uses the same room state, AI endpoint, validation, simulation, persistence, and controls as ordinary rooms. The fixture only provides reliable starting content and sample handwriting.

The judge entry opens directly in the real **Student lesson** capability with an empty canvas. A compact persistent role control can return to **Teacher setup** in the same tab without changing rooms or losing state.

### `/r/:roomId`

The canonical room route. A capability token in the URL fragment identifies teacher or learner access without placing the token in the HTTP request URL.

Example shape:

```text
/r/ROOM_ID#token=CAPABILITY
```

The browser passes the capability to the Worker through an authorization header and the WebSocket authentication handshake.

## Room entry and links

The room creates two links exactly once:

- **Teacher link** — opens teacher view and permits teacher-only actions.
- **Student link** — opens learner view.

There is no registration, link rotation, revocation, recovery, or resending workflow in the Build Week version.

The persistent **Student lesson / Teacher setup** view control changes the same tab between the room's real capabilities; it does not create a second user, duplicate state, open another tab, or require copying a link. A separately opened student link never receives the teacher capability or the return control.

## One continuous learning feed

The page is a vertically scrollable feed. It is not split into permanent task, chat, canvas, and simulation columns.

Possible feed blocks:

```text
Teacher setup message
Supported-skill suggestion
Generated task
Learner work canvas
Submitted-attempt snapshot
Recognition and reasoning card
Cancelable launch countdown
Simulation player
Outcome explanation
Achievement card
Teacher hint
Correction input
Next task suggestion
```

On a wide screen, content inside one block may use a two-column internal layout when useful. The global document remains one feed.

### Persistence behavior

Reloading the same link reconstructs the same visible feed. The implementation stores the product state needed to render visible blocks, not an unnecessary raw model transcript or hidden reasoning history.

Archived attempt canvases can render as saved images until the user opens their editable stroke history. This avoids maintaining many active canvas and physics instances in a long room.

## Teacher flow

1. The teacher opens `/` and is immediately inside a guided room.
2. The first block explains the product and offers supported skills.
3. The teacher clicks a skill or describes a gap in free text.
4. The agent maps the request to a supported template or clearly offers alternatives.
5. A task appears in the room.
6. The judge path already begins in the real student capability. The compact control can return to teacher setup, and the separate student link remains available there for real collaboration.
7. During learner work, the teacher sees the learner-facing feed and may add annotations or a short hint.
8. Teacher marks remain a separate layer and never enter learner analysis.
9. The teacher sees attempts, interpretations, simulations, and achievements.
10. The teacher makes any real pedagogical judgment outside the application's achievement system.

## Learner flow

1. The learner opens the student link and sees the assigned task.
2. The learner writes freely on the shared canvas.
3. The learner presses **Run my solution**.
4. The submitted student layer becomes an immutable attempt snapshot.
5. While analysis runs, the attempt controls are locked. A second attempt cannot be sent until analysis ends.
6. The feed shows meaningful progress stages.
7. A recognition card shows what the system read, the extracted values, and the likely first error.
8. A short countdown begins. The learner may cancel it to correct an obvious recognition problem.
9. The simulation runs using validated parameters.
10. The feed explains the direct connection between the written value and the physical result.
11. The learner can replay the scene, add a correction, or solve the next task.

## Canvas

### Tools

Required tools:

- pen;
- highlighter;
- whole-stroke eraser;
- undo;
- redo;
- clear.

Pointer, touch, and stylus input use Pointer Events. Keyboard-accessible controls surround the canvas.

### Layers

At minimum:

- `student`;
- `teacher`;
- `system`.

Visual distinction must not rely on color alone. Default presentation may use dark/blue student ink, red/orange teacher annotations, and a separate highlighted system style, accompanied by labels or patterns.

### Realtime behavior

Points are collected locally while drawing. On pointer release, the client simplifies the stroke, creates a smooth spline representation, renders it optimistically, and sends one operation to the room Durable Object.

The Durable Object assigns a monotonically increasing room sequence and broadcasts the accepted operation. Minor temporary z-order differences before acknowledgement are acceptable.

### Attempt boundary

Pressing **Run my solution** freezes the current student-layer operation sequence as the attempt source.

Teacher marks are never rasterized into the AI input. Strokes added after submission cannot silently change the earlier attempt. A correction creates a later attempt.

## Analysis experience

### Progress states

The feed reports real workflow stages rather than streaming partial JSON:

1. Uploading work
2. Reading handwriting
3. Extracting steps
4. Checking values
5. Preparing simulation

### Recognition card

The validated card contains:

- a readable transcription;
- recognized mathematical steps;
- final answer and unit;
- the values that will control the simulation;
- the probable first error or an uncertainty statement;
- a short learner-facing explanation.

It never exposes raw JSON, hidden reasoning, or internal prompts.

### Launch countdown

Default behavior is a two-second cancelable countdown after the recognition card appears.

This preserves a fast flow while giving an attentive learner a chance to stop a visibly incorrect interpretation. Exact timing may be tuned by usability testing without changing the product model.

### Correction

A learner can:

- edit or add to the canvas and submit a new attempt;
- send a short free-text clarification such as **“I meant 0.75 here, not 0.34.”**

There is no required equation editor.

## Simulation player

The simulation is an inline feed block.

Required controls:

- Pause / Resume;
- Replay;
- 2× speed;
- Skip to result;
- Mute;
- accessible text transcript.

Typical scenes last 12–20 seconds. A visually meaningful destruction sequence may last up to about 30 seconds. No scene should force a user to wait through spectacle repeatedly.

Replay reconstructs the scene from its template, version, validated inputs, presentation variant, and optional seed. Exact debris trajectories may change. The mathematical and semantic result must not.

## Hero task

### Prompt

> Engineers have a 12-meter bridge kit. To cross the ravine, they must deploy three quarters of the kit. How many meters of bridge should they deploy?

The prompt does not reveal `9 m`.

### Prepared wrong work

```text
3/4 = 0.34
12 × 0.34 = 4.08 m
```

### Prepared correction

```text
3/4 = 0.75
12 × 0.75 = 9 m
```

### Wrong outcome

The simulation creates `4.08 m` of bridge. The rescue vehicle cannot cross and falls into a clearly safe, comic recovery area. The feed explains that the learner's decimal conversion directly produced the short bridge.

### Correct outcome

The simulation creates `9 m` of bridge. The vehicle crosses and the recurring character is rescued. The learner earns a progress achievement.

## Target 90-second judge path

| Time | Judge action and visible evidence |
|---:|---|
| 0–8 s | Open `/judge`; a fresh room loads directly into the student lesson with product context, the task, and an empty handwriting canvas. |
| 8–15 s | Select **Student view** and press **Run my solution**. |
| 15–30 s | See staged analysis and the validated interpretation `3/4 = 0.34`, `4.08 m`. |
| 30–48 s | Watch the short bridge and comic safe failure. Read the causal explanation. |
| 48–58 s | Use the prepared correction or amend `0.34` to `0.75`; submit. |
| 58–72 s | See `9 m` recognized and launch the corrected scene. |
| 72–84 s | Watch the successful crossing and progress achievement. |
| 84–90 s | Replay a run, switch role, or reload to verify room persistence. |

The judge must understand the product before the first model response. The task, sample handwriting, and intended next action are visible immediately.

## Failure and recovery UX

| Failure | User-visible recovery |
|---|---|
| Unsupported teacher topic | State the current limitation and offer two or three supported nearby skills. |
| Upload failure | Keep the local canvas intact and offer **Retry upload**. |
| AI timeout, network failure, or invalid response | Show a concise explanation and the template-specific manual parameter form. |
| Unreadable handwriting | Ask for clearer work, a short text clarification, or manual parameters. |
| GPT explanation and deterministic validator disagree | Show the extracted values, use the validated simulation inputs, and label the explanation uncertain. |
| WebSocket disconnect | Continue local drawing, show connection state, and reconcile pending strokes after reconnect. |
| Renderer failure | Show the outcome card and text transcript; offer **Retry simulation**. |
| Low performance | Reduce decorative particles while preserving physics bodies and the semantic outcome. |
| Rate limit | Explain the temporary limit without losing the room or canvas. |

## Deterministic fallback

The fallback is specific to the selected task template.

For the bridge:

```text
Bridge length: [____] meters
```

An optional supporting field may request the decimal form of the fraction. The simulation only requires the minimum validated parameters.

The fallback:

- uses the same real simulation;
- uses the same deterministic outcome classification;
- clearly states that detailed handwriting feedback is unavailable;
- never presents a fixture as a fresh AI result.

## Achievements

Achievements describe observable behavior, not inferred mastery.

Two collections:

### Progress achievements

Examples:

- `Fixed It`
- `First-Try Crossing`
- `Five Safe Crossings`

### Disaster discoveries

Examples:

- `The World's Shortest Bridge`
- `Unexpected Indoor Swimming Pool`
- `Traffic Geometry Experiment`

The copy must celebrate experimentation without insulting the learner. A correct result unlocks the more meaningful story resolution or rescue.

## Visual style

A flat, playful textbook/game hybrid:

- simple 2D side view;
- thick readable silhouettes;
- visible units and quantities;
- restrained color palette;
- original characters and assets;
- comic motion without cruelty;
- no direct imitation of an existing film, game, or character.

## Responsive behavior

The same feed model works everywhere:

- desktop — centered wide feed;
- tablet — touch-friendly feed with generous canvas;
- phone — single-column feed with vertically stacked internals.

There are no mobile task/work/simulation tabs. A small phone is supported on a best-effort basis; long handwriting is not promised to be comfortable.

## Accessibility

Required baseline:

- native buttons, form controls, headings, and landmarks;
- keyboard operation for all non-drawing actions;
- descriptive accessible name and instructions for the canvas;
- visible focus;
- status updates through polite live regions;
- reduced-motion behavior that removes camera shake and reduces particles without hiding the result;
- sound only after user interaction, with mute;
- text task, recognized steps, simulation inputs, outcome, and event transcript available outside the canvas;
- role, correctness, and warnings conveyed by text or shape as well as color.
