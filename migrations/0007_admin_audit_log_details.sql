ALTER TABLE admin_audit_log
  ADD COLUMN actor TEXT NOT NULL DEFAULT 'admin';

ALTER TABLE admin_audit_log
  ADD COLUMN source_ip TEXT NOT NULL DEFAULT '';

ALTER TABLE admin_audit_log
  ADD COLUMN before_json TEXT;

ALTER TABLE admin_audit_log
  ADD COLUMN after_json TEXT;

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor
  ON admin_audit_log (actor, created_at DESC);
