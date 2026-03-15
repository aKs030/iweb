-- Append-only event log for every like action
CREATE TABLE IF NOT EXISTS project_like_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  source_ip TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  request_id TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_like_events_project_id_created_at
ON project_like_events (project_id, created_at DESC);
