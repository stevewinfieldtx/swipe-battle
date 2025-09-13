-- Memory system enhancements: attributes, content_hash, source, and unique index
-- Run this SQL in your Supabase project's SQL editor (or psql) against the production DB.

-- 1) Add columns if they do not exist
ALTER TABLE IF EXISTS memory_nuggets
  ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- 2) Create a uniqueness guard to de-duplicate identical facts per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_memory_user_content_hash
ON memory_nuggets(user_id, content_hash)
WHERE content_hash IS NOT NULL;

-- 3) Optional: tighten category/type checks if needed (commented out by default)
-- NOTE: Only enable if your existing data conforms; otherwise migrate data first.
-- ALTER TABLE memory_nuggets
--   ADD CONSTRAINT memory_nuggets_category_check
--   CHECK (category IN ('personal','family','preferences','emotional','situational','general'));
-- ALTER TABLE memory_nuggets
--   ADD CONSTRAINT memory_nuggets_type_check
--   CHECK (type IN ('anchor','trigger'));

-- 4) Backfill existing rows with a simple hash if missing (optional)
-- WARNING: This uses a naive hash; feel free to replace with a stronger server-side function if available.
-- UPDATE memory_nuggets
-- SET content_hash = substr(encode(sha256((coalesce(model_name,'') || '|' || coalesce(category,'') || '|' || coalesce(type,'') || '|' || coalesce(content,''))::bytea), 'hex'), 1, 64)
-- WHERE content_hash IS NULL;


