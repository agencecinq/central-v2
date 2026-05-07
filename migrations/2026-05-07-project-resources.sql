-- Project resources — espace client : documents, pages HTML, liens externes
-- Run this against the CinqCentral V2 Postgres database.

BEGIN;

CREATE TABLE IF NOT EXISTS project_resources (
  id              SERIAL PRIMARY KEY,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type            VARCHAR(20) NOT NULL,           -- document | html_page | external_link
  name            VARCHAR(255) NOT NULL,
  filepath        VARCHAR(500),                   -- pour document & html_page (chemin relatif sous /uploads)
  url             VARCHAR(500),                   -- pour external_link
  mimetype        VARCHAR(255),
  size            INTEGER,
  created_by_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_resources_project_id_idx
  ON project_resources (project_id);

COMMIT;
