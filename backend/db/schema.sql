CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  description TEXT,
  job_url TEXT UNIQUE,
  application_url TEXT,
  source TEXT DEFAULT 'greenhouse',
  status TEXT NOT NULL DEFAULT 'NOT_STARTED',
  screenshot_path TEXT,
  failure_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
