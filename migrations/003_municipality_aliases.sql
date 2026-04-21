-- ============================================================
-- Migration 003 — Municipality aliases
--
-- Lets one municipality be matched by multiple dispatch names.
-- Example: "Monroe" = "Palm Tree", "Blooming Grove" = "BG",
-- "Kiryas Joel" = "KJ".
--
-- This is distinct from `municipalities.display_name`, which is the
-- user-facing nickname shown in the client portal. Aliases are
-- backend-only — n8n uses them to resolve incoming dispatch payloads
-- back to the canonical municipality row.
-- ============================================================

-- 1. Aliases table (one row per alternate name)
CREATE TABLE IF NOT EXISTS municipality_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Aliases are globally unique (case-insensitive) so dispatch matches
-- can never be ambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS idx_municipality_aliases_alias_unique
  ON municipality_aliases (lower(alias));

CREATE INDEX IF NOT EXISTS idx_municipality_aliases_municipality
  ON municipality_aliases (municipality_id);

-- 2. municipality_lookup view — n8n queries this to resolve a dispatch
--    name (primary OR alias) to a municipality_id.
--    Returns one row per searchable name; `is_primary` flags the canonical.
DROP VIEW IF EXISTS municipality_lookup;
CREATE VIEW municipality_lookup AS
SELECT
  m.id           AS municipality_id,
  m.name         AS lookup_name,
  true           AS is_primary,
  m.is_active
FROM municipalities m
WHERE m.name IS NOT NULL AND m.name <> ''
UNION ALL
SELECT
  a.municipality_id,
  a.alias        AS lookup_name,
  false          AS is_primary,
  m.is_active
FROM municipality_aliases a
JOIN municipalities m ON m.id = a.municipality_id;

-- 3. RLS: admins read aliases via the admin app (service role); authenticated
--    users (clients) don't need access.
ALTER TABLE municipality_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aliases readable by authenticated" ON municipality_aliases;
CREATE POLICY "Aliases readable by authenticated"
  ON municipality_aliases FOR SELECT
  USING (auth.role() = 'authenticated');
-- Writes happen only through service_role (admin actions / n8n).
