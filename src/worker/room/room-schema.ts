export const ROOM_SCHEMA_ID = "room.v1" as const;

export const CREATE_ROOM_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS room_meta (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    room_id TEXT NOT NULL,
    schema_id TEXT NOT NULL,
    fixture_id TEXT NOT NULL,
    teacher_capability_hash TEXT NOT NULL,
    student_capability_hash TEXT NOT NULL,
    next_seq INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS room_events (
    seq INTEGER PRIMARY KEY,
    type TEXT NOT NULL,
    visible_to TEXT NOT NULL CHECK (visible_to IN ('all', 'teacher')),
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS canvas_operations (
    seq INTEGER PRIMARY KEY,
    client_operation_id TEXT NOT NULL UNIQUE,
    workspace_id TEXT NOT NULL,
    layer TEXT CHECK (layer IN ('student', 'teacher')),
    author_id TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT NOT NULL UNIQUE,
    task_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    source_canvas_seq INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS simulation_runs (
    id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL UNIQUE,
    room_seq INTEGER NOT NULL UNIQUE,
    template_id TEXT NOT NULL,
    template_version INTEGER NOT NULL,
    inputs_json TEXT NOT NULL,
    outcome_json TEXT NOT NULL,
    presentation_variant TEXT NOT NULL,
    random_seed TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS room_locks (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    active_attempt_id TEXT
  );

  INSERT OR IGNORE INTO room_locks (singleton, active_attempt_id)
  VALUES (1, NULL);

  CREATE TABLE IF NOT EXISTS analysis_attempts (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT NOT NULL UNIQUE,
    task_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    source_canvas_seq INTEGER NOT NULL,
    status TEXT NOT NULL,
    room_seq INTEGER NOT NULL,
    media_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS media_objects (
    id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL UNIQUE,
    r2_key TEXT NOT NULL UNIQUE,
    content_hash TEXT NOT NULL,
    content_type TEXT NOT NULL,
    byte_size INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS analysis_results (
    attempt_id TEXT PRIMARY KEY,
    result_json TEXT,
    failure_category TEXT,
    disagreement INTEGER NOT NULL,
    model_id TEXT,
    response_id TEXT,
    latency_ms INTEGER NOT NULL,
    used_repair INTEGER NOT NULL,
    completed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    scope TEXT NOT NULL,
    bucket_start TEXT NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (scope, bucket_start)
  );
`;
