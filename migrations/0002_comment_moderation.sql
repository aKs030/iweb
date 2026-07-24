ALTER TABLE blog_comments ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'
  CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE blog_comments ADD COLUMN moderated_at DATETIME;
ALTER TABLE blog_comments ADD COLUMN moderated_by TEXT;
ALTER TABLE blog_comments ADD COLUMN spam_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_comments_status_created_at
ON blog_comments (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_post_status_created_at
ON blog_comments (post_id, status, created_at DESC);
