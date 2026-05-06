-- Auto-Resolve feature — phase 1 schema additions
-- Run this against the CinqCentral V2 Postgres database.

BEGIN;

-- ── projects: champs auto-resolve ──────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS repo_default_branch  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS auto_resolve_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS detected_stack       JSONB,
  ADD COLUMN IF NOT EXISTS detected_stack_at    TIMESTAMP;

-- Activer par défaut sur les repos hébergés sous github.com/agencecinq/*
UPDATE projects
SET auto_resolve_enabled = TRUE
WHERE github_url ILIKE 'https://github.com/agencecinq/%'
  AND auto_resolve_enabled = FALSE;

-- ── tickets: statut auto-resolve ───────────────────────────
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS auto_resolve_status      VARCHAR(20),
  ADD COLUMN IF NOT EXISTS auto_resolve_pr_url      VARCHAR(500),
  ADD COLUMN IF NOT EXISTS auto_resolve_skip_reason TEXT,
  ADD COLUMN IF NOT EXISTS auto_resolve_run_id      VARCHAR(36);

-- ── auto_resolve_runs: nouvelle table ──────────────────────
CREATE TABLE IF NOT EXISTS auto_resolve_runs (
  id             VARCHAR(36) PRIMARY KEY,
  ticket_id      INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  status         VARCHAR(20) NOT NULL,
  started_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  finished_at    TIMESTAMP,
  branch_name    VARCHAR(200),
  commit_sha     VARCHAR(40),
  pr_number      INTEGER,
  pr_url         VARCHAR(500),
  slack_ts       VARCHAR(50),
  tokens_input   INTEGER,
  tokens_output  INTEGER,
  cost_usd       NUMERIC(10, 4),
  agent_summary  TEXT,
  error          TEXT
);

CREATE INDEX IF NOT EXISTS auto_resolve_runs_ticket_id_idx
  ON auto_resolve_runs (ticket_id);

COMMIT;
