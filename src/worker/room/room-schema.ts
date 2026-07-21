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
`;
