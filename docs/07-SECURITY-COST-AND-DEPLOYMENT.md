# 07 — Security, cost, and deployment

## Scope and posture

Lost Lessons Lab is a public Build Week demo, not a production school information system or proctored assessment platform.

Security goals:

1. keep OpenAI and Cloudflare secrets server-side;
2. prevent casual unauthorized access to private room content;
3. keep teacher-only setup hidden from the learner link;
4. prevent public endpoints from creating uncontrolled AI cost;
5. avoid collecting unnecessary personal information;
6. keep media private;
7. support safe rollback and a stable judged release;
8. provide honest recovery when AI is unavailable.

The Build Week version does not promise:

- account recovery;
- enterprise identity;
- link revocation or rotation;
- regulatory certification;
- exam integrity;
- indefinite deletion/retention guarantees;
- protection against a participant intentionally altering their own client.

## Assets and trust boundaries

### Sensitive assets

- `OPENAI_API_KEY`;
- Cloudflare deployment token;
- `ROOM_TOKEN_PEPPER`;
- teacher and learner capability links;
- visible learner handwriting and optional photos;
- private teacher setup text;
- OpenAI request identifiers and usage;
- R2 object keys;
- GitHub repository secrets.

### Trust zones

```text
Untrusted browser
  ↕ validated HTTPS / authenticated WebSocket
Cloudflare Worker
  ↕ typed Durable Object RPC
Room Durable Object + SQLite
  ↕ private R2 binding
Private R2
  ↕ server-side API request
OpenAI API
```

All browser input is `unknown` until validated.

## Threat model

| Threat | Control |
|---|---|
| OpenAI key exposed in browser | Server-only Worker client; bundle and source-map scan |
| Capability token appears in HTTP referrer/log | URL fragment, `Referrer-Policy: no-referrer`, no analytics on room URLs |
| Learner reads teacher setup | Role-filtered Durable Object events and permission tests |
| Unauthenticated user reads private R2 object | Private bucket; authorized Worker route only |
| Duplicate WebSocket command | Idempotency keys and server acknowledgement |
| Out-of-order canvas state | Durable Object sequence and reconnect reconciliation |
| Model returns malformed or malicious structure | Strict schema, semantic validation, closed template allowlist |
| Model chooses unsupported simulation | Source-controlled enabled-template registry |
| Arbitrary executable code generated | Prohibited; GPT cannot generate or execute scene code |
| AI endpoint abused | One active analysis, per-room/IP limits, media caps, spend limits, kill switch |
| Sensitive learner work logged | Structured metadata-only logs; no request/response body debug in production |
| Room data lost after hibernation | SQLite is authoritative; constructor restores state |
| Old incompatible demo data breaks new release | New namespace/class or discard old demo rooms; no migration framework |
| Production regression near deadline | Validation gate, versioned deployment, rollback, frozen tag |
| Unlicensed media or code | License allowlist, original assets, third-party notice |
| WAF/CAPTCHA blocks judge | Test clean/incognito production; do not add interactive challenge to judge path |
| API failure dead-ends judge | Template-specific manual input and prepared fixture state |

## Capability-link design

Room creation produces two high-entropy random capabilities:

- teacher;
- learner.

Server storage contains only a cryptographic hash combined with a server-side pepper. The raw capability exists in the generated URL and browser memory.

Example:

```text
https://APP/r/ROOM_ID#token=RAW_CAPABILITY
```

The fragment is not sent with the document request. The SPA uses it to authenticate API and WebSocket access.

### Deliberate simplicity

The Build Week version does not implement:

- rotation;
- revocation;
- recovery;
- expiry;
- email delivery;
- account binding.

Creating a new room is the recovery for a lost or disclosed link.

No room-delete, trash, restore, link revocation, or link-recovery workflow is included. A fresh room is the only recovery path.

### Required headers

At minimum for room HTML/bootstrap:

```text
Referrer-Policy: no-referrer
Cache-Control: no-store
X-Content-Type-Options: nosniff
```

Set a practical Content Security Policy after measuring required Worker, image, WebSocket, and audio sources.

## Secrets and configuration

### Tracked file policy

Never commit:

- `.dev.vars`;
- `.env`;
- API keys;
- Cloudflare API tokens;
- raw capability links;
- production room URLs containing fragments;
- private OpenAI responses;
- user media;
- session IDs intended to remain private.

`.env.example` contains names and non-secret defaults only.

### Server environment

Required:

```text
OPENAI_API_KEY
OPENAI_MODEL=gpt-5.6
AI_ENABLED=true
ROOM_TOKEN_PEPPER
APP_ENV
PUBLIC_APP_ORIGIN
AI_TIMEOUT_MS
AI_MAX_RETRIES
AI_ROOM_LIMIT_PER_HOUR
AI_IP_LIMIT_PER_HOUR
ROOM_CREATE_IP_LIMIT_PER_HOUR
MAX_MEDIA_BYTES
MAX_MEDIA_EDGE_PX
ANALYSIS_MEDIA_EDGE_PX
```

Cloudflare resources are bindings, not string secrets:

```text
ROOMS
MEDIA
optional IP rate-limiter bindings
```

Optional metadata:

```text
GIT_COMMIT_SHA
SUBMISSION_TAG
```

### GitHub secrets

Use narrowly scoped secrets:

- `CLOUDFLARE_API_TOKEN`;
- `CLOUDFLARE_ACCOUNT_ID`.

The OpenAI key normally belongs in Cloudflare Worker secrets, not GitHub Actions, unless a protected release-only live-eval job requires it. Never expose it to pull requests from forks.

## OpenAI privacy boundary

### Request behavior

- call OpenAI from the Worker only;
- use `store: false`;
- do not use an OpenAI Conversation as application persistence;
- send only task context and the student-only work required for the current interpretation;
- do not send teacher annotations;
- do not send capability tokens, room URLs, real names, school information, or hidden room history;
- keep output concise and schema-bound.

OpenAI API data handling must be rechecked before release. `store: false` disables application-state storage for the response workflow but must not be described as a blanket Zero Data Retention guarantee.

### Learners and personal information

The demo must not require:

- name;
- age;
- school;
- address;
- email;
- account;
- parent contact;
- educational record.

Default labels are `Teacher` and `Learner`.

Visible UI should say, briefly:

> Do not include names or personal information in the work you submit. AI can misread handwriting; review the interpretation.

Before offering the product to real schools or processing identifiable child data, conduct a separate legal, consent, retention, and data-processing review. That is outside this demo scope.

## Media controls

### Accepted types

Initial allowlist:

- PNG;
- JPEG;
- WebP.

Validate actual content signature and decode metadata rather than trusting extension or client MIME alone.

Initial configurable limits:

```text
8 MiB maximum upload
4096 px maximum original long edge
about 2048 px maximum analysis-copy long edge
```

Reject:

- animated content;
- malformed dimensions;
- decompression bombs;
- unsupported formats;
- non-finite canvas points;
- excessive stroke/point counts.

### Storage

Private R2 key pattern:

```text
rooms/<room-id>/attempts/<attempt-id>/<sha256>.<ext>
```

Use immutable content hashes where practical.

The Durable Object stores:

- media ID;
- R2 key;
- content type;
- byte size;
- hash;
- visibility;
- creation time.

### Retention rule

If source media is rendered in the room feed, preserve it with the room. If it is only a temporary processing input and not visible, it may be discarded after analysis.

There is no automatic retention scheduler in the Build Week version. Do not claim a deletion SLA.

### Reads

The bucket remains private. Media is served only through a Worker endpoint that:

1. authenticates the room capability;
2. checks the requested media belongs to the room;
3. checks the media is visible to the role;
4. returns safe headers and private caching policy.

## Input and output validation

Use Zod or equivalent at every boundary:

- environment variables;
- route params;
- JSON body;
- multipart metadata;
- WebSocket envelope;
- canvas operations;
- room RPC;
- task plan;
- solution analysis;
- template parameters;
- simulation inputs.

General rules:

- reject unknown fields on state-changing structures;
- cap strings, arrays, strokes, points, and messages;
- reject `NaN`, infinity, or non-numeric values;
- normalize units only through an allowlist;
- encode untrusted text as text, never raw HTML;
- never interpolate model output into executable code, CSS, selectors, URLs, or SQL;
- use bound SQL parameters;
- use source-controlled template IDs.

## AI cost controls

### One-active-analysis lock

A Durable Object room can have at most one active analysis. While active:

- learner submission is disabled;
- correction cannot be sent;
- duplicate request returns the existing attempt state;
- teacher annotation can continue but cannot affect the snapshot.

The lock must release in all terminal paths.

### Initial limits

Configurable initial defaults:

```text
60 analyses per room per hour
120 AI requests per IP per hour
60 room creations per IP per hour
1 active analysis per room
```

These are intentionally generous for judging. Validate that a full judge path never approaches a limit.

Implementation may combine:

- Durable Object counters for room-local use;
- Cloudflare rate-limiting binding for IP-level checks;
- in-memory short-term optimization only when not authoritative.

### Model and retry controls

- server allowlist includes only the configured approved model;
- initial model: `gpt-5.6`;
- total target budget: 24 seconds;
- maximum retry: one;
- no retry for schema or semantic errors except the single explicit repair path;
- no unbounded SDK automatic retry;
- maximum input image dimensions;
- bounded output schema;
- `AI_ENABLED` kill switch;
- OpenAI project spend/rate limits.

### Queue/Workflow threshold

Do not add Cloudflare Queue or Workflow by default.

Move only the AI job if measured live evaluation shows:

- p90 analysis time above 20 seconds; or
- timeout/fallback rate above roughly 5% on the stable curated corpus; or
- `waitUntil` completion becomes unreliable.

The public API, room state, status events, and fallback must remain unchanged.

### M6 measured execution decision

On 2026-07-21, the release-gate wrong and correct handwriting samples completed
on their first `gpt-5.6-sol` responses in 5.16 seconds and 4.45 seconds. Earlier
recorded production release samples were also below 9 seconds. The prepared
judge sample remained exact, no repair was used, and no fallback was required.
This is comfortably below the 20-second p90 trigger, so M6 keeps AI execution in
the Worker and does not add Queue/Workflow failure surface. The configured total
timeout remains 24 seconds, retry remains bounded to one, reasoning effort
remains low, the input analysis edge remains 2048 pixels, and structured output
remains capped at 1,400 tokens.

M6 recovery controls are source-controlled and testable:

| Failure | Control and evidence target |
|---|---|
| AI disabled, timeout, invalid schema, refusal, network, or upstream status | Persist a terminal failure when an attempt exists and expose the template-specific manual form; unit AI fixtures and browser fallback tests cover the categories. |
| Worker interruption during analysis | Bootstrap, submit, and Reset expire a lock older than the configured timeout plus a 30-second delivery grace; a late completion cannot replace terminal state. |
| R2 write or attachment failure | Delete any partial object, persist `media_storage`, and explicitly release the lock if terminal persistence also fails. |
| Missing or unauthorized R2 read | Return a protected 404 or 401 without revealing the object key. |
| WebSocket disconnect | Preserve optimistic operations, show queued state, reconnect, resume from sequence, and resend idempotently. |
| Renderer failure | Preserve the deterministic title and transcript and expose **Retry simulation**. |
| Low-performance device or reduced motion | Use resolution 1, disable antialiasing, and reduce decorative water droplets without changing Planck bodies or classification. |
| Rate limit | Keep the room/canvas and expose manual controls; Cloudflare bindings are backed by authoritative per-hour DO counters. |
| Operational logging | Emit strict allowlisted metadata and error class only; never include exception messages, handwriting, media, or capabilities. |

## Logging and observability

Use structured Cloudflare logs.

Allowed:

```text
timestamp
environment
deployment commit
hashed room ID
attempt ID
template ID/version
model ID
OpenAI request/response ID
latency
token usage
schema validation status
semantic validation status
fallback category
rate-limit category
Worker/DO/R2/renderer error class
```

Forbidden:

```text
raw capability
full room URL fragment
raw media
base64 image
full handwriting transcription
full teacher or learner message
OpenAI key
Cloudflare token
full model request/response body
private Session ID
```

Keep SDK debug logging off in production.

### Health endpoint

`GET /api/health` may return:

- service version;
- commit;
- environment;
- static status;
- binding-presence booleans without values.

It must not make a costly OpenAI request or reveal resource names/secrets.

## Browser security

### Content Security Policy

Implement and test a policy that permits only required sources. A conceptual starting point:

```text
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';  # remove unsafe-inline if build permits
img-src 'self' data: blob:;
connect-src 'self' wss:;
font-src 'self';
media-src 'self' blob:;
object-src 'none';
base-uri 'none';
frame-ancestors 'none';
form-action 'self';
```

Adapt to the generated build. Do not claim CSP is complete until production validation passes.

### Other controls

- no third-party analytics by default;
- no external fonts required;
- use local/original assets;
- no service-worker caching of capability-bearing room responses unless carefully designed;
- disable browser caching for bootstrap/AI state;
- sanitize file names and never use user file names as R2 paths;
- avoid exposing source maps publicly if they contain sensitive configuration; verify actual output;
- do not put a bot challenge on `/judge`.

## Cloudflare topology

One Worker deployment:

```text
Static Assets
Hono API
Room creation
OpenAI calls
R2 authorization
Durable Object routing
```

Bindings:

```text
ROOMS → RoomDurableObject
MEDIA → private R2 bucket
```

Do not add:

- D1;
- KV;
- separate API Worker;
- separate media origin;
- external auth;
- Queue/Workflow unless the measured threshold requires it.

## Durable Object platform registration

Cloudflare requires a declaration that registers the initial SQLite Durable Object class. Conceptual configuration:

```jsonc
{
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
  ]
}
```

Despite the platform key name, do not build application-level room migrations. For an incompatible demo schema, use a new class/namespace/version and allow old rooms to be discarded.

## Development and production environments

Minimum:

- local;
- production.

A preview/staging environment is useful if it can be created without delaying the first deployment.

Separate:

- Worker names;
- R2 buckets;
- OpenAI project/key or at least environment limits;
- room capability pepper;
- origin;
- logs.

Never copy production room data into development.

## GitHub Actions

### Pull request workflow

Run:

```text
bun install --frozen-lockfile
format check
lint
typecheck
unit
Worker/DO integration
production build
mocked Playwright E2E
secret scan
```

Do not expose production secrets to untrusted PR code.

### Main workflow

After all checks:

1. build;
2. deploy with official Wrangler action or pinned Wrangler CLI;
3. capture deployment version and commit;
4. run production smoke;
5. fail visibly if smoke fails.

Do not configure two competing production deploy mechanisms.

### Release workflow

Before the submission tag:

- live GPT-5.6 eval;
- human production QA;
- JUDGING literal run;
- clean clone;
- evidence matrix;
- repository/license audit;
- rollback target verification.

## Deployment commands

The exact scripts are established in M1, conceptually:

```bash
bun run validate
bun run deploy
bun run smoke:prod
```

`bun run deploy` must use the pinned project tooling. Do not depend on a globally installed Wrangler version.

## Rollback

Before every milestone deploy:

- record the working commit;
- record Cloudflare deployment/version ID;
- keep the previous green version available.

Near feature freeze:

1. stop feature changes;
2. deploy only a fully validated commit;
3. run production smoke;
4. on regression, use Cloudflare version rollback;
5. do not attempt an untested hotfix directly in production;
6. record the rollback in `STATUS.md` and evidence.

The `build-week-submission` Git tag identifies the exact release after final verification.

## Cost expectations

This is a low-traffic demo. Exact pricing is not a product blocker, but controls are still required.

Primary variable costs:

- OpenAI image/text analysis;
- R2 stored media and operations;
- Worker/Durable Object requests and storage;
- optional egress outside platform assumptions.

Keep cost predictable through:

- one analysis at a time;
- cropped/resized image;
- concise structured output;
- one retry maximum;
- curated judge state;
- per-room/IP limits;
- OpenAI project spending limit;
- `AI_ENABLED` kill switch;
- no background polling;
- Hibernation WebSockets;
- no full-frame simulation synchronization;
- no automatic mass room generation.

Record observed per-attempt usage during live eval. Do not publish a cost claim without current billing evidence.

## License policy

Project source: Apache License 2.0.

Preferred dependency licenses:

- Apache-2.0;
- MIT;
- BSD-2-Clause;
- BSD-3-Clause;
- ISC.

A copyleft or unclear dependency requires explicit review before addition.

Assets:

- original;
- permissively licensed with attribution;
- public-domain/CC0 when provenance is clear.

Do not use:

- copied film/game characters;
- scraped images with unclear terms;
- commercial fonts without redistribution rights;
- music without explicit license;
- trademark-heavy visual assets not needed for explanation.

Update `THIRD_PARTY_NOTICES.md` with exact package and asset versions before release.

## Pre-deployment security checklist

- [ ] `.dev.vars` and `.env` ignored.
- [ ] No secret in Git history.
- [ ] No OpenAI key in browser bundle or source map.
- [ ] No raw capability in logs.
- [ ] Room responses use `no-store` and no-referrer.
- [ ] Teacher setup denied to learner capability.
- [ ] R2 denied without valid room capability.
- [ ] Media size/type/dimensions validated.
- [ ] HTML output encoded.
- [ ] Structured Outputs and semantic validation active.
- [ ] One analysis lock releases on every path.
- [ ] Rate limits configured.
- [ ] OpenAI spend/rate limits configured.
- [ ] `AI_ENABLED` tested.
- [ ] Debug logging disabled.
- [ ] Clean incognito judge path has no challenge.
- [ ] Production rollback version recorded.
- [ ] Third-party licenses reviewed.

## Incident actions

### Secret exposure

1. disable affected production path;
2. revoke/rotate secret immediately;
3. inspect logs and Git history;
4. remove secret from current and historical tracked content as required;
5. redeploy clean configuration;
6. verify bundle/logs;
7. document without publishing the secret.

### Capability-link exposure

Because no rotation exists:

1. stop using the room;
2. create a fresh room;
3. remove exposed link from public material;
4. ensure no submission screenshot/video contains fragments.

### AI cost spike

1. set `AI_ENABLED=false`;
2. lower Cloudflare/OpenAI limits;
3. inspect metadata logs;
4. keep deterministic judge fallback live;
5. restore only after the cause is fixed.

### Broken production release

1. roll back to the previous green Cloudflare version;
2. restore docs/URL consistency;
3. rerun smoke;
4. update status/evidence;
5. avoid feature work until release is stable.

## Official references to recheck during implementation

- OpenAI production practices: <https://developers.openai.com/api/docs/guides/production-best-practices>
- OpenAI data controls: <https://developers.openai.com/api/docs/guides/your-data>
- OpenAI under-18 guidance: <https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance>
- OpenAI JavaScript SDK: <https://github.com/openai/openai-node>
- Cloudflare secrets: <https://developers.cloudflare.com/workers/configuration/secrets/>
- Cloudflare Durable Objects: <https://developers.cloudflare.com/durable-objects/>
- Durable Object lifecycle: <https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/>
- Durable Object WebSockets: <https://developers.cloudflare.com/durable-objects/best-practices/websockets/>
- R2 Worker API: <https://developers.cloudflare.com/r2/api/workers/workers-api-usage/>
- Worker `waitUntil`: <https://developers.cloudflare.com/workers/runtime-apis/context/>
- Rate limiting binding: <https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/>
- GitHub Actions deployment: <https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/>
- Wrangler rollback/version commands: <https://developers.cloudflare.com/workers/wrangler/commands/>
