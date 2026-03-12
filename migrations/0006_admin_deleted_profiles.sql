CREATE TABLE IF NOT EXISTS admin_deleted_profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  snapshot_json TEXT NOT NULL,
  deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  restore_until TEXT,
  deleted_by TEXT NOT NULL DEFAULT 'admin',
  delete_reason TEXT NOT NULL DEFAULT '',
  restored_at TEXT,
  purged_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_deleted_profiles_active
  ON admin_deleted_profiles (restored_at, purged_at, deleted_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_deleted_profiles_restore_until
  ON admin_deleted_profiles (restore_until);
