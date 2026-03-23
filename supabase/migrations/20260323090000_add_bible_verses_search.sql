/*
  # Add Bible Verses Search

  1. New table
    - `bible_verses`
      - `translation_id` (text) - Translation code, e.g. BSB
      - `book` (text)
      - `chapter` (integer)
      - `verse` (integer)
      - `text` (text)
      - `created_at` (timestamptz)

  2. Search
    - Primary key on translation + reference
    - Expression GIN index for full-text search
    - RPC `search_bible_verses(query_text, translation_filter, match_count)`

  3. Security
    - Public read access for Bible verses
*/

CREATE TABLE IF NOT EXISTS bible_verses (
  translation_id text NOT NULL,
  book text NOT NULL,
  chapter integer NOT NULL CHECK (chapter > 0),
  verse integer NOT NULL CHECK (verse > 0),
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (translation_id, book, chapter, verse)
);

CREATE INDEX IF NOT EXISTS idx_bible_verses_reference
  ON bible_verses (translation_id, book, chapter, verse);

CREATE INDEX IF NOT EXISTS idx_bible_verses_text_fts
  ON bible_verses
  USING gin (to_tsvector('english', text));

ALTER TABLE bible_verses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read bible_verses" ON bible_verses;
CREATE POLICY "Anyone can read bible_verses"
  ON bible_verses
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION search_bible_verses(
  query_text text,
  translation_filter text DEFAULT 'BSB',
  match_count integer DEFAULT 30
)
RETURNS TABLE (
  translation_id text,
  book text,
  chapter integer,
  verse integer,
  text text,
  rank real
)
LANGUAGE sql
AS $$
  SELECT
    bv.translation_id,
    bv.book,
    bv.chapter,
    bv.verse,
    bv.text,
    ts_rank(
      to_tsvector('english', bv.text),
      websearch_to_tsquery('english', query_text)
    ) AS rank
  FROM bible_verses bv
  WHERE
    bv.translation_id = COALESCE(translation_filter, bv.translation_id)
    AND to_tsvector('english', bv.text) @@ websearch_to_tsquery('english', query_text)
  ORDER BY rank DESC, bv.book, bv.chapter, bv.verse
  LIMIT GREATEST(match_count, 1);
$$;
