-- =============================================================
-- 003_sermon_pipeline.sql
-- Extends sermons table + adds sermon_chunks, sermon_timestamps,
-- and hybrid search RPC for the RAG pipeline.
-- =============================================================

-- -------------------------------------------------------
-- 0. Ensure pgvector extension exists
-- -------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- -------------------------------------------------------
-- 1. Extend sermons table with new pipeline columns
-- -------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sermons' AND column_name='region') THEN
    ALTER TABLE sermons ADD COLUMN region TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sermons' AND column_name='content_type') THEN
    ALTER TABLE sermons ADD COLUMN content_type TEXT DEFAULT 'sermon';
  END IF;

  -- Full transcript (the old migration dropped this; add it back)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sermons' AND column_name='transcript') THEN
    ALTER TABLE sermons ADD COLUMN transcript TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sermons' AND column_name='youtube_url') THEN
    ALTER TABLE sermons ADD COLUMN youtube_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sermons' AND column_name='video_id') THEN
    ALTER TABLE sermons ADD COLUMN video_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sermons' AND column_name='duration_seconds') THEN
    ALTER TABLE sermons ADD COLUMN duration_seconds INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sermons' AND column_name='processed_at') THEN
    ALTER TABLE sermons ADD COLUMN processed_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- Unique constraint on video_id (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sermons_video_id_key' AND conrelid = 'sermons'::regclass
  ) THEN
    ALTER TABLE sermons ADD CONSTRAINT sermons_video_id_key UNIQUE (video_id);
  END IF;
END $$;

-- -------------------------------------------------------
-- 2. sermon_timestamps — raw SRT segments per sermon
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS sermon_timestamps (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sermon_id        UUID NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  start_seconds    INTEGER NOT NULL,
  end_seconds      INTEGER NOT NULL,
  verse_reference  TEXT,
  transcript_segment TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sermon_timestamps_sermon_id
  ON sermon_timestamps(sermon_id);

-- -------------------------------------------------------
-- 3. sermon_chunks — RAG chunks with embeddings
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS sermon_chunks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sermon_id        UUID NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  chunk_index      INTEGER NOT NULL,
  content          TEXT NOT NULL,
  verse_references TEXT[] DEFAULT '{}',
  start_seconds    INTEGER,
  end_seconds      INTEGER,
  embedding        VECTOR(768),
  metadata         JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sermon_chunks_sermon_id
  ON sermon_chunks(sermon_id);

-- IVFFlat index for approximate nearest-neighbor search
-- (Requires at least a few thousand rows before it helps;
--  safe to create now, Postgres will use seq-scan on small tables.)
CREATE INDEX IF NOT EXISTS idx_sermon_chunks_embedding
  ON sermon_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- GIN index for full-text keyword search
CREATE INDEX IF NOT EXISTS idx_sermon_chunks_content_fts
  ON sermon_chunks USING gin(to_tsvector('english', content));

-- -------------------------------------------------------
-- 4. RLS policies for new tables
-- -------------------------------------------------------
ALTER TABLE sermon_timestamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE sermon_chunks     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read sermon_timestamps" ON sermon_timestamps;
CREATE POLICY "Authenticated users can read sermon_timestamps"
  ON sermon_timestamps FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read sermon_chunks" ON sermon_chunks;
CREATE POLICY "Authenticated users can read sermon_chunks"
  ON sermon_chunks FOR SELECT TO authenticated USING (true);

-- -------------------------------------------------------
-- 5. Hybrid search RPC
--    Combines: semantic (cosine), keyword (FTS), verse match
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION search_sermon_chunks(
  query_text        TEXT,
  query_embedding   VECTOR(768),
  match_count       INT     DEFAULT 10,
  filter_church     TEXT    DEFAULT NULL,
  filter_content_type TEXT  DEFAULT NULL,
  filter_verse      TEXT    DEFAULT NULL,
  semantic_weight   FLOAT   DEFAULT 0.6,
  keyword_weight    FLOAT   DEFAULT 0.3,
  verse_weight      FLOAT   DEFAULT 0.1
)
RETURNS TABLE (
  chunk_id         UUID,
  sermon_id        UUID,
  content          TEXT,
  verse_references TEXT[],
  start_seconds    INTEGER,
  end_seconds      INTEGER,
  metadata         JSONB,
  similarity       FLOAT,
  combined_score   FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Semantic similarity via cosine distance
  semantic AS (
    SELECT
      sc.id,
      sc.sermon_id,
      sc.content,
      sc.verse_references,
      sc.start_seconds,
      sc.end_seconds,
      sc.metadata,
      (1 - (sc.embedding <=> query_embedding))::FLOAT AS sem_score
    FROM sermon_chunks sc
    WHERE
      (filter_church       IS NULL OR sc.metadata->>'church'       = filter_church)
      AND (filter_content_type IS NULL OR sc.metadata->>'content_type' = filter_content_type)
      AND sc.embedding IS NOT NULL
    ORDER BY sc.embedding <=> query_embedding
    LIMIT match_count * 3
  ),
  -- Keyword (BM25-style via ts_rank)
  keyword AS (
    SELECT
      sc.id,
      ts_rank(to_tsvector('english', sc.content),
              plainto_tsquery('english', query_text))::FLOAT AS kw_score
    FROM sermon_chunks sc
    WHERE to_tsvector('english', sc.content) @@ plainto_tsquery('english', query_text)
  ),
  -- Verse match bonus
  verse_match AS (
    SELECT sc.id
    FROM sermon_chunks sc
    WHERE filter_verse IS NOT NULL
      AND filter_verse = ANY(sc.verse_references)
  )
  SELECT
    s.id,
    s.sermon_id,
    s.content,
    s.verse_references,
    s.start_seconds,
    s.end_seconds,
    s.metadata,
    s.sem_score,
    (
      s.sem_score * semantic_weight
      + COALESCE(k.kw_score, 0) * keyword_weight
      + (CASE WHEN vm.id IS NOT NULL THEN 1.0 ELSE 0.0 END) * verse_weight
    )::FLOAT AS combined_score
  FROM semantic s
  LEFT JOIN keyword    k  ON s.id = k.id
  LEFT JOIN verse_match vm ON s.id = vm.id
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;
