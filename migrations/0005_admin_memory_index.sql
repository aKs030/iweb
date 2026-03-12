CREATE TABLE IF NOT EXISTS admin_user_profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'anonymous',
  memory_count INTEGER NOT NULL DEFAULT 0,
  latest_memory_at INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_memory_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  memory_key TEXT NOT NULL,
  memory_value TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'note',
  priority INTEGER NOT NULL DEFAULT 20,
  timestamp INTEGER NOT NULL,
  expires_at INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, memory_key, memory_value)
);

CREATE TABLE IF NOT EXISTS admin_name_mappings (
  name TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  raw_value TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'linked',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_user_profiles_latest_memory
  ON admin_user_profiles (latest_memory_at DESC, memory_count DESC, user_id);

CREATE INDEX IF NOT EXISTS idx_admin_memory_entries_user
  ON admin_memory_entries (user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_admin_memory_entries_key
  ON admin_memory_entries (memory_key, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_admin_name_mappings_user
  ON admin_name_mappings (user_id, status, name);
