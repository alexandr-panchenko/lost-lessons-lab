# 04 — Technical design

Status: frozen implementation design. Current platform assumptions were checked against official OpenAI and Cloudflare documentation on 2026-07-21.

## Stack decision

| Layer | Decision |
|---|---|
| Language | TypeScript |
| Local runtime and package manager | Bun |
| Client UI | React |
| Build | Vite with the Cloudflare Vite plugin |
| Worker routing | Hono |
| Deployment | One Cloudflare Worker with Static Assets |
| Realtime and room persistence | One SQLite-backed Durable Object per room |
| Realtime transport | Durable Object WebSocket Hibernation API |
| Visible binary media | Private Cloudflare R2 bucket |
| Canvas | Native `<canvas>` with Pointer Events and a source-controlled stroke model |
| 2D rendering | PixiJS |
| Physics | Planck |
| AI | OpenAI Responses API, server-side `gpt-5.6` |
| AI output | Strict Structured Output plus application semantic validation |
| Unit and integration tests | Vitest with the Cloudflare Workers test pool |
| Browser tests | Playwright |
| CI/CD | GitHub Actions and Wrangler |
| License | Apache-2.0 |

Pin exact dependency versions in `bun.lock`. Do not copy volatile version numbers from this design document into claims without checking the lockfile.

## Why this stack

### React + Vite + Cloudflare Worker

The product is primarily a responsive document-like feed with canvas and simulation islands. It does not need server rendering, React Server Components, or a full-stack meta-framework. One Worker can serve the SPA, API, media authorization, and Durable Object routing from one origin.

### PixiJS + Planck

React owns feed structure and accessible controls. PixiJS owns the simulation renderer. Planck owns the physical world.

This separation avoids forcing the physics loop through React reconciliation. Planck's Box2D-style rigid bodies, joints, fixed-step model, and continuous collision options fit the required side-view scenes. Pixi provides efficient sprites, graphics, camera movement, and particles.

### Durable Object per room

The room is the natural consistency boundary:

- one teacher;
- one learner link;
- a single ordered canvas operation stream;
- one active AI analysis;
- one visible learning history;
- realtime WebSockets;
- room-local persistence.

A single actor can order operations without a CRDT or global relational database.

### Private R2 media

Structured room state stays in Durable Object SQLite. Visible canvas snapshots, visible uploaded photos, and other binary artifacts live in private R2. The Worker checks the room capability before reading media.

## Alternatives rejected

### Matter.js

Rejected as the primary engine because the hero scenes rely on reliable high-speed collision behavior. Workarounds based only on more substeps or thicker colliders add risk.

### Rapier 2D

Technically viable and retained as an emergency alternative only if Planck proves a measured blocker. Its WASM initialization and bundling surface are unnecessary for the frozen scenes.

### Phaser

Useful for game-first products, but this application's primary shell is an accessible learning feed, not a game scene. Direct Pixi integration keeps the boundary clearer.

### D1, KV, CRDT, separate backend

Not needed for room-local state. Adding them would increase deployment, consistency, and testing surfaces without helping the hero flow.

## Runtime architecture

```text
┌───────────────────────────────────────────────────────────────┐
│ Browser                                                       │
│                                                               │
│ React learning feed                                           │
│ ├─ semantic task / analysis / outcome blocks                  │
│ ├─ native shared handwriting canvas                           │
│ ├─ PixiJS + Planck simulation islands                         │
│ └─ teacher / learner view                                     │
└─────────────────────────────┬─────────────────────────────────┘
                              │ HTTPS + WebSocket
                              ▼
┌───────────────────────────────────────────────────────────────┐
│ Cloudflare Worker                                             │
│                                                               │
│ Static Assets + Hono API                                      │
│ ├─ create rooms and judge fixtures                            │
│ ├─ verify capability tokens                                   │
│ ├─ route room RPC and WebSocket upgrade                       │
│ ├─ accept and validate visible media                          │
│ ├─ call OpenAI server-side                                    │
│ └─ authorize R2 reads                                         │
└───────────────┬──────────────────┬────────────────────────────┘
                │                  │
                ▼                  ▼
┌──────────────────────────┐   ┌────────────────────────────────┐
│ Room Durable Object      │   │ Private R2 bucket              │
│                          │   │                                │
│ SQLite authority         │   │ visible canvas PNGs            │
│ Hibernation WebSockets   │   │ visible photo uploads          │
│ ordered room events      │   │ future visible audio           │
│ task / attempt history   │   │ optional result thumbnails     │
└──────────────────────────┘   └────────────────────────────────┘
                ▲
                │ validated analysis result
                │
┌───────────────┴───────────────────────────────────────────────┐
│ OpenAI Responses API                                          │
│ `gpt-5.6`, text + image input, strict structured result       │
└───────────────────────────────────────────────────────────────┘
```

## Target repository layout

Codex may refine file names without changing boundaries.

```text
src/
  client/
    app/
      App.tsx
      router.tsx
      providers.tsx
    feed/
      LearningFeed.tsx
      blocks/
    room/
      room-client.ts
      room-reducer.ts
      capabilities.ts
    canvas/
      DrawingCanvas.tsx
      stroke-model.ts
      stroke-simplify.ts
      stroke-render.ts
      student-raster.ts
    simulation/
      SimulationPlayer.tsx
      pixi-host.ts
      runtime.ts
      templates/
        bridge/
        water/
        speed/
        structure/
    accessibility/
      live-region.tsx
      SimulationTranscript.tsx
    styles/
  worker/
    index.ts
    routes/
      rooms.ts
      judge.ts
      attempts.ts
      media.ts
      health.ts
    room/
      RoomDurableObject.ts
      room-schema.ts
      room-events.ts
      room-rpc.ts
      websocket.ts
    ai/
      openai-client.ts
      task-planner.ts
      solution-analyzer.ts
      schemas.ts
      semantic-validation.ts
      repair.ts
    domain/
      skills.ts
      tasks.ts
      attempts.ts
      achievements.ts
      templates/
    security/
      capabilities.ts
      rate-limit.ts
      validation.ts
      logging.ts
  shared/
    protocol.ts
    types.ts
    constants.ts
fixtures/
  judge-v1/
tests/
  unit/
  integration/
  e2e/
```

Do not create empty directories or speculative abstractions before a milestone uses them.

## HTTP route surface

Initial target:

```text
GET    /                         create teacher room and redirect
GET    /judge                    create room from judge-v1 and redirect
GET    /r/:roomId                serve SPA route
POST   /api/rooms                explicit room creation for future/internal use
GET    /api/rooms/:roomId/bootstrap
GET    /api/rooms/:roomId/socket
POST   /api/rooms/:roomId/tasks
POST   /api/rooms/:roomId/attempts
POST   /api/rooms/:roomId/attempts/:attemptId/correction
POST   /api/rooms/:roomId/attempts/:attemptId/manual-input
GET    /api/rooms/:roomId/media/:mediaId
POST   /api/rooms/:roomId/reset-current-task
GET    /api/health
```

No room-delete, trash, restore, or capability lifecycle is included in the Build Week version.

## Capability links

### Generation

Room creation generates:

- high-entropy teacher capability;
- high-entropy learner capability.

The Durable Object stores only salted or peppered cryptographic hashes.

### Transport

The redirect URL uses a fragment:

```text
/r/ROOM_ID#token=CAPABILITY
```

Fragments are not sent as part of the HTTP request. After the SPA loads, the client sends the capability in:

- an authorization header for HTTP API requests;
- the first authenticated WebSocket message or a short-lived connection credential obtained through HTTP.

Never place capability tokens in logs, analytics, error reports, screenshots, fixture files, or submission evidence.

Set:

```text
Referrer-Policy: no-referrer
Cache-Control: no-store
```

on room documents and bootstrap responses.

### Permissions

| Action | Teacher capability | Learner capability |
|---|:---:|:---:|
| Read learner-facing feed | yes | yes |
| Read private teacher setup | yes | no |
| Create/select task | yes | no |
| Add teacher annotation | yes | no |
| Add student stroke | student preview only | yes |
| Submit learner attempt | student preview only | yes |
| Send teacher hint | yes | no |
| Replay visible run | yes | yes |
| Reset current task | yes | no |

“Student preview” is a teacher UI mode that deliberately invokes learner-permitted commands while retaining the teacher capability on the server.

## Durable Object persistence

### No application migration framework

This demo does not preserve incompatible historical room schemas. Do not build forward-only application migrations, a migration service, or compatibility shims.

The Cloudflare configuration still requires a one-time Durable Object class registration declaration for a new SQLite class. Treat that as platform resource registration, not a general application migration system.

If a later development version becomes incompatible:

1. deploy a new room class or namespace identifier;
2. route newly created rooms to it;
3. discard old demo rooms when safe;
4. update fixture version and docs.

### SQLite tables

An initial schema may use these tables:

```sql
CREATE TABLE room_meta (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  room_id TEXT NOT NULL,
  schema_id TEXT NOT NULL,
  teacher_capability_hash TEXT NOT NULL,
  student_capability_hash TEXT NOT NULL,
  next_seq INTEGER NOT NULL,
  active_task_id TEXT,
  active_analysis_attempt_id TEXT,
  created_at TEXT NOT NULL,
);

CREATE TABLE participants (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  display_label TEXT NOT NULL,
  last_seen_at TEXT
);

CREATE TABLE room_events (
  seq INTEGER PRIMARY KEY,
  type TEXT NOT NULL,
  actor_id TEXT,
  visible_to TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE canvas_workspaces (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE canvas_operations (
  seq INTEGER PRIMARY KEY,
  client_operation_id TEXT NOT NULL UNIQUE,
  workspace_id TEXT NOT NULL,
  layer TEXT NOT NULL CHECK (layer IN ('student', 'teacher', 'system')),
  author_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  template_version INTEGER NOT NULL,
  wording TEXT NOT NULL,
  parameters_json TEXT NOT NULL,
  expected_solution_json TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  source_canvas_seq INTEGER NOT NULL,
  source_media_id TEXT,
  follow_up_text TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE analyses (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL UNIQUE,
  schema_version TEXT NOT NULL,
  model_id TEXT NOT NULL,
  response_id TEXT,
  result_json TEXT NOT NULL,
  validation_json TEXT NOT NULL,
  latency_ms INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE simulation_runs (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  template_version INTEGER NOT NULL,
  inputs_json TEXT NOT NULL,
  presentation_json TEXT NOT NULL,
  random_seed TEXT,
  result_class TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE media_refs (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  visible INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE achievement_awards (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  achievement_key TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('progress', 'disaster')),
  created_at TEXT NOT NULL
);
```

The exact SQL may be simplified during implementation, but it must preserve:

- ordered room events;
- ordered canvas operations;
- immutable attempts;
- one active analysis lock;
- visible persistence;
- replay parameters;
- capability hashes.

### Room events

Events render the product feed and support realtime updates:

```text
room.created
teacher.practice-requested
task.created
teacher.hint-added
canvas.operation-added
attempt.captured
analysis.started
analysis.completed
analysis.failed
simulation.started
simulation.completed
achievement.awarded
retry.requested
task.reset
```

Do not store private chain-of-thought, raw hidden prompts, or unneeded SDK objects.

## WebSocket protocol

### Envelope

Use a versioned JSON envelope:

```ts
type RoomEnvelope<T = unknown> = {
  v: 1;
  type: string;
  requestId?: string;
  clientId: string;
  roomSeq?: number;
  payload: T;
};
```

Every state-changing client command carries:

- `requestId`;
- `clientId`;
- either `clientOperationId` or `idempotencyKey`.

Server responses:

```text
auth.accepted
auth.rejected
command.ack
command.rejected
room.snapshot
room.delta
presence.changed
canvas.operation
feed.event
analysis.status
analysis.completed
simulation.launch
```

### Authentication

No room data is sent before capability authentication.

For Hibernation:

- serialize minimal participant metadata into WebSocket attachment;
- treat SQLite as authoritative after constructor re-entry;
- never rely on process memory surviving hibernation.

### Ordering and idempotency

For a mutation:

1. validate capability and command schema;
2. reject a duplicate idempotency key or return the previous acknowledgement;
3. start a SQLite transaction;
4. assign the next room sequence;
5. persist entity changes and the room event;
6. commit;
7. acknowledge sender;
8. broadcast accepted event.

The authoring client may draw optimistically before acknowledgement.

### Reconnect

The client stores `lastSeenSeq` and pending unacknowledged commands.

After reconnect:

```json
{
  "v": 1,
  "type": "room.resume",
  "clientId": "CLIENT_ID",
  "payload": {
    "lastSeenSeq": 137
  }
}
```

The Durable Object sends:

- a delta after sequence 137; or
- a current snapshot if the delta is too large or no longer available.

Pending commands are resent with the same idempotency identifiers.

## Canvas operation model

```ts
type StrokePoint = {
  x: number;          // normalized 0..1
  y: number;          // normalized 0..1
  pressure?: number;  // normalized when available
};

type AddStrokeOperation = {
  operation: "stroke.add";
  strokeId: string;
  clientOperationId: string;
  workspaceId: string;
  layer: "student" | "teacher" | "system";
  authorId: string;
  tool: "pen" | "highlighter";
  points: StrokePoint[];
  width: number;
  opacity: number;
};

type DeleteStrokeOperation = {
  operation: "stroke.delete";
  targetStrokeId: string;
  clientOperationId: string;
};

type RestoreStrokeOperation = {
  operation: "stroke.restore";
  targetStrokeId: string;
  clientOperationId: string;
};

type ClearLayerOperation = {
  operation: "layer.clear";
  layer: "student" | "teacher";
  clientOperationId: string;
};
```

### Stroke processing

On pointer release:

1. collect raw pointer points locally;
2. normalize coordinates;
3. simplify points with a bounded error tolerance;
4. smooth the rendered path with a Catmull–Rom or equivalent spline;
5. cap total points and validate finite values;
6. display optimistically;
7. send the operation.

The stored model should retain simplified control points, not a rendered bitmap.

### Layer filtering

The function that creates AI media must accept an explicit layer filter and default to:

```ts
layers: ["student"]
```

Teacher and system strokes must be absent from the raster. Unit and E2E tests must prove this.

## Attempt snapshot and media lifecycle

### Capture

When the learner presses **Run my solution**:

1. the client stops accepting another submission;
2. it records the latest acknowledged student operation sequence;
3. it renders a clean PNG from student strokes only;
4. it sends image, content hash, source sequence, task ID, and an idempotency key to the Worker;
5. the Worker validates media and asks the room Durable Object to atomically acquire the analysis lock and create the immutable attempt;
6. the Worker stores visible PNG in R2;
7. the R2 reference is attached to the attempt;
8. analysis starts asynchronously;
9. progress events reach the feed over WebSocket.

If media storage fails, the analysis must not start. The local canvas remains available.

### Trust boundary

The browser creates the raster because Cloudflare Workers do not provide a general browser canvas rendering environment. The server still verifies:

- the room and attempt;
- source sequence;
- content type and dimensions;
- content hash;
- size limits;
- one-active-analysis lock.

This is a learning demo, not an examination security system. A malicious learner could alter their own submitted image; that is not a frozen threat.

### R2 keys

Use content-addressed or immutable keys:

```text
rooms/<room-id>/attempts/<attempt-id>/<sha256>.png
```

Do not expose the bucket publicly. Media is served through an authorized Worker route.

## Domain model

### Skills

Source-controlled IDs, for example:

```text
fractions.decimal-conversion
percentages.basic
proportions.basic
measurement.units
area.basic
volume.container
linear-equations.simple
motion.speed-time-distance
```

The UI only advertises skills with at least one production-ready template.

### Task template contract

```ts
interface TaskTemplate<TTaskParameters, TSimulationInputs> {
  id: string;
  version: number;
  supportedSkillIds: readonly string[];
  taskParameterSchema: Schema<TTaskParameters>;
  simulationInputSchema: Schema<TSimulationInputs>;

  validateTaskParameters(
    input: unknown
  ): ValidationResult<TTaskParameters>;

  deriveCorrectSolution(
    parameters: TTaskParameters
  ): CorrectSolution;

  validateExtractedInputs(
    parameters: TTaskParameters,
    input: unknown
  ): ValidationResult<TSimulationInputs>;

  classifyAttempt(
    parameters: TTaskParameters,
    inputs: TSimulationInputs
  ): SimulationOutcome;

  createSimulation(
    outcome: SimulationOutcome,
    presentation: PresentationVariant
  ): SimulationDefinition;

  describeOutcome(
    outcome: SimulationOutcome
  ): AccessibleOutcome;

  getAchievements(
    outcome: SimulationOutcome,
    history: AttemptHistory
  ): AchievementAward[];

  curatedFixtures: readonly TaskFixture[];
}
```

A template cannot be enabled until it has:

- at least one correct fixture;
- representative misconception fixtures;
- boundary fixtures;
- deterministic domain tests;
- headless simulation contract tests;
- an accessible outcome transcript;
- a browser path;
- production verification.

### Task planning output

```ts
type TaskPlan = {
  schemaVersion: "task-plan.v1";
  supportStatus: "supported" | "unsupported";
  skillId: string | null;
  templateId: string | null;
  parameterCandidate: Record<string, number | string | boolean> | null;
  wording: string | null;
  suggestedAlternatives: string[];
};
```

Application validation checks:

- skill and template exist and are enabled;
- template supports the skill;
- parameter values are finite and in range;
- the task has a unique intended answer;
- units are coherent;
- wording does not reveal the answer;
- the scene can visually represent the range;
- unsupported requests return alternatives.

On failure, select a curated pack.

## GPT-5.6 integration

### Server-only client

The OpenAI key is a Worker secret. Never import a server client into browser code.

Initial configuration:

```text
OPENAI_MODEL=gpt-5.6
AI_ENABLED=true
AI_TIMEOUT_MS=24000
AI_MAX_RETRIES=1
```

Use the Responses API with:

```text
store: false
```

### Solution analysis input

The model receives:

- exact task wording;
- source-controlled skill and template context;
- known quantities and units;
- clean student-only work image;
- optional learner clarification;
- a concise list of required simulation input names;
- strict output schema instructions.

Use high image detail by default after cropping empty margins and producing an analysis copy around the configured maximum edge. Only experiment with a higher-detail retry if live evaluation proves it necessary.

### Strict output

```ts
type SolutionAnalysis = {
  schemaVersion: "solution-analysis.v1";
  transcription: string;
  steps: Array<{
    text: string;
    normalizedExpression: string | null;
    regionId: string | null;
    status: "valid" | "suspected_error" | "uncertain";
  }>;
  finalAnswers: Array<{
    name: string;
    value: number | null;
    unit: string | null;
  }>;
  scenarioInputs: Record<string, number | string | null>;
  verdict: "correct" | "incorrect" | "ambiguous" | "unreadable";
  firstError: {
    summary: string;
    regionId: string | null;
  } | null;
  confidence: number;
  studentFacingExplanation: string;
};
```

Schema requirements:

- strict JSON schema;
- no unknown fields;
- all enum values closed;
- finite numbers only after application parsing;
- bounded array and string lengths;
- explicit nullable fields rather than omitted shape changes.

### Semantic validation

After schema parsing, deterministic code verifies:

- template-required input names;
- numeric finiteness;
- units;
- value ranges;
- arithmetic identities;
- task solution;
- no unsupported simulation parameter;
- explanation length;
- consistency between claimed answer and extracted inputs.

At most one repair call may receive a concise validation error. If repair fails, use the template-specific manual fallback.

### Responsibility boundary

GPT is responsible for:

- reading handwriting;
- understanding free-form layout and alternate methods;
- transcribing steps;
- extracting candidate values;
- identifying a likely first error;
- writing a short explanation;
- mapping teacher language to supported skills/templates.

Deterministic code is responsible for:

- arithmetic;
- unit normalization;
- valid ranges;
- correct solution;
- scenario input contract;
- correct/incorrect classification;
- physical outcome class;
- achievements;
- authorization;
- persistence.

### Conflict state

If GPT's prose and deterministic validation disagree:

- do not show a green “correct” state from GPT;
- show the extracted inputs used by the simulation;
- show deterministic calculation;
- label the AI explanation uncertain;
- invite a learner clarification after analysis completes.

Suggested copy:

> The simulation used these extracted values. The AI explanation is uncertain. Add a correction if this is not what you meant.

### Analysis lifecycle

```text
attempt captured
  → upload complete
  → analysis lock acquired
  → reading handwriting
  → extracting steps
  → checking values
  → structured result parsed
  → semantic validation
  → optional single repair
  → result stored
  → analysis lock released
  → countdown / fallback
```

### Timing and retries

Initial policy:

- one primary call;
- total target budget: 24 seconds;
- SDK automatic retries disabled for this endpoint;
- at most one bounded retry for 429, 5xx, or network error;
- no retry if the remaining budget is insufficient;
- best-effort `AbortController`;
- template fallback after budget.

The analysis starts under `ctx.waitUntil()` after the HTTP response acknowledges attempt capture. If live evaluation shows p90 above 20 seconds or timeout/fallback rate above roughly 5%, move only the execution transport to a Cloudflare Queue or Workflow. Preserve the API, room state machine, and UX.

### Status events

Do not stream partial structured fields. Send application statuses:

```text
uploading
reading
extracting
validating
preparing
complete
failed
```

### Region highlighting

For the first production slice, identify the problematic line in the recognition card.

A later safe enhancement may:

1. group strokes geometrically into labeled regions;
2. send a second annotated copy with region labels;
3. ask GPT for a `regionId`;
4. highlight the corresponding student stroke group.

Do not require pixel-perfect model bounding boxes for hero completion.

## Simulation architecture

### Separation of concerns

```text
React:
  feed lifecycle
  semantic controls
  accessible transcript
  loading and errors

PixiJS:
  rendering
  camera
  sprites
  graphics
  particles and authored effects

Planck:
  bodies
  fixtures
  joints
  contacts
  fixed-step physics
```

### Physics runtime

Use a fixed simulation step, initially:

```text
1 / 60 second
```

The render loop:

1. accumulates elapsed real time;
2. caps excessive accumulated time;
3. executes a bounded number of physics steps;
4. interpolates visual transforms when useful;
5. reduces decorative quality under performance pressure;
6. never changes mathematical correctness due to dropped frames.

Use `bullet` or the engine's continuous collision option for fast hero bodies. Give critical success/failure geometry generous margins rather than testing exact edge contacts.

### Correctness before physics

Before the scene is created:

```ts
type SimulationOutcome = {
  resultClass: string;
  isMathematicallyCorrect: boolean;
  submittedInputs: Record<string, number | string>;
  correctInputs: Record<string, number | string>;
  errorMagnitude?: number;
  explanationData: Record<string, number | string>;
};
```

The physical scene receives an outcome class such as:

```text
bridge_far_too_short
bridge_slightly_short
bridge_correct
bridge_excessively_long
```

Physics displays the result; it does not grade it.

### Bridge template

Task parameters:

```ts
type BridgeTaskParameters = {
  kitLengthMeters: number;      // hero: 12
  numerator: number;            // hero: 3
  denominator: number;          // hero: 4
  presentationVariant: string;
};
```

Required simulation input:

```ts
type BridgeSimulationInputs = {
  deployedLengthMeters: number;
  fractionAsDecimal?: number | null;
};
```

Correct solution:

```text
12 × (3 / 4) = 9
```

The scene scales the deployed bridge length from the extracted input. Outcome thresholds must be broad enough that minor floating-point and rendering variation cannot change classification.

### Water and sand

Use a hybrid model:

- deterministic volume/level calculation;
- stable filled shape or mesh for bulk liquid;
- bounded Planck bodies for visible droplets, overflow, and larger grains;
- pooled Pixi particles for tiny droplets, dust, and spray;
- quality tiers and body caps.

### Destruction

Use authored breakpoints:

1. stable intact body;
2. threshold based on deterministic outcome or a broad physical trigger;
3. replace with a prepared set of rigid fragments;
4. add visual dust/spark effects.

Do not generate arbitrary fracture geometry at runtime.

### Replay

Store:

- template ID;
- template version;
- validated inputs;
- presentation variant;
- optional random seed;
- result class.

Do not store:

- per-frame transforms;
- collision logs;
- particle positions;
- exact debris trajectories.

Replay must produce the same semantic outcome and accessible transcript. Visual micro-details may differ.

### Pixi lifecycle

Each simulation feed block owns its Pixi application and Planck world.

On unmount or archive:

- stop animation frame;
- detach event and audio listeners;
- destroy Pixi application;
- release generated textures;
- clear pools and world references;
- ensure no timers remain.

Only the active or visible player should run. Archived runs show a lightweight result/thumbnail until Replay.

## Main state transitions

```text
ROOM_CREATED
  → TEACHER_SELECTING_GAP
  → TASK_PLANNING
      → UNSUPPORTED_ALTERNATIVES
      → TASK_READY
  → LEARNER_WORKING
  → ATTEMPT_CAPTURED
  → MEDIA_STORING
      → UPLOAD_FAILED
      → ANALYSIS_RUNNING
          → ANALYSIS_READY
          → ANALYSIS_AMBIGUOUS
          → ANALYSIS_FAILED
  → CANCELABLE_COUNTDOWN
      → LEARNER_CORRECTING
      → SIMULATION_RUNNING
  → SIMULATION_RESULT
      → RETRY_AVAILABLE
      → NEXT_TASK_AVAILABLE
```

The `active_analysis_attempt_id` lock prevents a second learner submission during `ANALYSIS_RUNNING`. Teacher annotations can continue because they are separate operations and cannot alter the attempt snapshot.

## Client state

Use React Context plus pure reducers unless measured complexity proves otherwise.

Separate:

- server-authoritative room state;
- local UI state;
- optimistic pending canvas operations;
- active Pixi/Planck instance state.

Do not add Redux or another store by default.

The room client reducer consumes versioned `RoomEvent`s. Persist only server state; local expanded/collapsed controls may remain browser state.

## Caching

- hashed static assets: long immutable public cache;
- room HTML/bootstrap: `no-store`;
- AI responses: never shared-cache;
- authorized immutable media: private browser cache using immutable content-hash keys;
- capability-bearing URLs: no analytics or referrer leakage.

## Rate limiting and budget controls

Initial configurable defaults:

```text
one active AI analysis per room
60 analyses per room per hour
120 AI requests per IP per hour
60 room creations per IP per hour
```

Use:

- room-local counters in the Durable Object where appropriate;
- Cloudflare rate-limiting binding or Worker controls for IP-level protection;
- OpenAI project spending limits;
- `AI_ENABLED` kill switch;
- server-side model allowlist;
- maximum media, message, stroke, and point limits.

The limits are protective defaults, not product promises. Tune them only from measured judge and practice behavior.

## Observability

Structured events may include:

- deployment commit;
- hashed room ID;
- attempt ID;
- template ID/version;
- model ID;
- OpenAI response/request ID;
- total and stage latency;
- token usage;
- schema validation result;
- semantic validation result;
- fallback category;
- Worker, Durable Object, R2, and renderer error category.

Never log:

- capability token;
- raw media;
- full handwriting transcription;
- full teacher/learner messages;
- API key;
- full OpenAI request/response body.

Expose a minimal `/api/health` that does not reveal secrets.

## Accessibility contract

The canvas and simulation are not the sole source of meaning.

Every attempt exposes:

- task as text;
- submitted image with an accessible description;
- recognized steps as text;
- extracted inputs;
- result classification;
- causal explanation;
- simulation event transcript;
- achievement description.

All controls are native semantic controls with visible focus. Use a polite live region for connection and analysis status. Reduced-motion preserves the result while suppressing shake and reducing particles.

## Deployment configuration shape

The exact generated file depends on the current Cloudflare Vite template, but it must include bindings conceptually like:

```jsonc
{
  "name": "lost-lessons-lab",
  "main": "src/worker/index.ts",
  "compatibility_date": "PIN_AT_IMPLEMENTATION",
  "durable_objects": {
    "bindings": [
      {
        "name": "ROOMS",
        "class_name": "RoomDurableObject"
      }
    ]
  },
  "migrations": [
    {
      "tag": "rooms-v1",
      "new_sqlite_classes": ["RoomDurableObject"]
    }
  ],
  "r2_buckets": [
    {
      "binding": "MEDIA",
      "bucket_name": "lost-lessons-lab-media"
    }
  ]
}
```

The `migrations` key above is the Cloudflare platform declaration required to register the class. It does not authorize building an application room-data migration framework.

## Official implementation references

Re-verify during Milestone 1 because platform documentation can change:

- GPT-5.6 Sol model: <https://developers.openai.com/api/docs/models/gpt-5.6-sol>
- OpenAI Responses API: <https://developers.openai.com/api/docs/guides/migrate-to-responses>
- Structured Outputs: <https://developers.openai.com/api/docs/guides/structured-outputs>
- OpenAI image inputs: <https://platform.openai.com/docs/guides/images-vision>
- OpenAI data controls: <https://developers.openai.com/api/docs/guides/your-data>
- Cloudflare React guide: <https://developers.cloudflare.com/workers/framework-guides/web-apps/react/>
- Cloudflare Vite plugin: <https://developers.cloudflare.com/workers/vite-plugin/>
- Durable Objects overview: <https://developers.cloudflare.com/durable-objects/>
- SQLite-backed Durable Objects: <https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/>
- WebSocket Hibernation API: <https://developers.cloudflare.com/durable-objects/best-practices/websockets/>
- R2 Worker API: <https://developers.cloudflare.com/r2/api/workers/workers-api-usage/>
- `waitUntil`: <https://developers.cloudflare.com/workers/runtime-apis/context/>
- Cloudflare rate limiting binding: <https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/>
- GitHub Actions deployment: <https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/>
