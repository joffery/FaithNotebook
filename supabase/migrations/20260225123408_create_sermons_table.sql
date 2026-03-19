/*
  # Create Sermons Table

  1. New Tables
    - `sermons`
      - `id` (uuid, primary key)
      - `title` (text) - Sermon title
      - `speaker` (text) - Speaker name
      - `church` (text) - Church name
      - `book_reference` (text) - Bible book reference
      - `series_number` (int) - Series number
      - `word_count` (int) - Word count
      - `verses` (jsonb) - Array of verse references
      - `summary` (text) - Sermon summary
      - `tags` (jsonb) - Array of tags
      - `verse_insights` (jsonb) - Array of verse insights
      - `transcript_preview` (text) - Preview of transcript
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on `sermons` table
    - Add policy for authenticated users to read all sermons
*/

CREATE TABLE IF NOT EXISTS sermons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  speaker text NOT NULL,
  church text NOT NULL,
  book_reference text NOT NULL,
  series_number int NOT NULL,
  word_count int NOT NULL,
  verses jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  verse_insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  transcript_preview text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sermons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all sermons"
  ON sermons
  FOR SELECT
  TO authenticated
  USING (true);