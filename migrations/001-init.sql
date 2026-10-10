-- Migration 001: Initial schema
-- Run this migration first on a fresh database

-- Entries table - core service entries
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identity_key TEXT NOT NULL UNIQUE, -- e.g., "host:0.0.0.0:3000" or "docker:abc123"
  source TEXT NOT NULL, -- 'host', 'docker', 'manual', 'infrastructure', or comma-separated like 'host,docker'
  type TEXT NOT NULL, -- 'web_app', 'tcp_listener', 'udp_listener', 'docker_container', 'infrastructure', 'manual'
  friendly_name TEXT, -- User-assigned name
  detected_name TEXT, -- Auto-detected name (process name, container name, etc.)
  address TEXT, -- Bind address (0.0.0.0, 127.0.0.1, ::, etc.)
  port INTEGER, -- Port number
  scheme TEXT CHECK (scheme IN ('http', 'https', 'tcp', 'udp')), -- For health checks
  path TEXT DEFAULT '/', -- HTTP probe path
  url TEXT, -- Clickable URL (may differ from health check target)
  category_id INTEGER NOT NULL DEFAULT 1, -- FK to categories, defaults to "Uncategorized"
  description TEXT,
  hidden INTEGER DEFAULT 0, -- 0 = visible, 1 = hidden
  removed INTEGER DEFAULT 0, -- 0 = active, 1 = removed (but kept for history)
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  last_seen_at INTEGER, -- Last time this entry was observed by a collector
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET DEFAULT
);

-- Categories table - user-defined organizational groups
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER DEFAULT 0,
  is_system INTEGER DEFAULT 0, -- System categories cannot be deleted
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

-- Entry tags junction table
CREATE TABLE IF NOT EXISTS entry_tags (
  entry_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (entry_id, tag_id),
  FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Observations table - transient health/discovery observations
CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'tcp_listener', 'http_probe', 'docker_state', 'docker_health', 'infrastructure'
  value TEXT NOT NULL, -- JSON string with observation details
  observed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  source TEXT NOT NULL, -- Collector source: 'host', 'docker', 'http_probe', 'infrastructure'
  FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
);

-- Settings table - key-value application settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

-- Scan history table
CREATE TABLE IF NOT EXISTS scan_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id TEXT NOT NULL UNIQUE, -- UUID
  status TEXT NOT NULL, -- 'running', 'completed', 'failed', 'partial'
  started_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  completed_at INTEGER,
  stats TEXT, -- JSON string with scan statistics
  error TEXT
);

-- Migrations table - track applied migrations
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_entries_identity_key ON entries(identity_key);
CREATE INDEX IF NOT EXISTS idx_entries_category ON entries(category_id);
CREATE INDEX IF NOT EXISTS idx_entries_hidden ON entries(hidden);
CREATE INDEX IF NOT EXISTS idx_entries_removed ON entries(removed);
CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type);
CREATE INDEX IF NOT EXISTS idx_entries_last_seen ON entries(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_observations_entry ON observations(entry_id);
CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(type);
CREATE INDEX IF NOT EXISTS idx_observations_observed_at ON observations(observed_at);
CREATE INDEX IF NOT EXISTS idx_scan_history_status ON scan_history(status);

-- Seed the Uncategorized category (system category, cannot be deleted)
INSERT OR IGNORE INTO categories (id, name, display_order, is_system) VALUES (1, 'Uncategorized', 0, 1);

-- Record this migration
INSERT OR IGNORE INTO migrations (name) VALUES ('001-init');