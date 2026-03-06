-- Create the likes table for portfolio projects
CREATE TABLE IF NOT EXISTS project_likes (
  project_id TEXT PRIMARY KEY,
  likes INTEGER DEFAULT 0
);
