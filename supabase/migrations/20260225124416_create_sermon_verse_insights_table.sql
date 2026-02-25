/*
  # Create Sermon Verse Insights Table

  1. New Tables
    - `sermon_verse_insights`
      - `id` (uuid, primary key)
      - `sermon_id` (uuid, foreign key to sermons)
      - `verse` (text) - Verse reference like "John 14:1"
      - `insight` (text) - The insight content
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on `sermon_verse_insights` table
    - Add policy for authenticated users to read all insights
*/

CREATE TABLE IF NOT EXISTS sermon_verse_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sermon_id uuid NOT NULL REFERENCES sermons(id) ON DELETE CASCADE,
  verse text NOT NULL,
  insight text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sermon_verse_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all sermon verse insights"
  ON sermon_verse_insights
  FOR SELECT
  TO authenticated
  USING (true);