/*
  # Create note_likes table

  1. Purpose
    - Allow each signed-in user to like a shared note once
    - Support community note hearts without creating duplicate likes

  2. Safety
    - Additive only
    - Does not recreate or modify users, notes, or shared_notes rows
*/

CREATE TABLE IF NOT EXISTS note_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id uuid NOT NULL REFERENCES shared_notes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_note_likes_note_id
  ON note_likes (note_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_note_likes_user_note_unique
  ON note_likes (user_id, note_id);

ALTER TABLE note_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own note likes" ON note_likes;
CREATE POLICY "Users can view own note likes"
  ON note_likes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own note likes" ON note_likes;
CREATE POLICY "Users can insert own note likes"
  ON note_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own note likes" ON note_likes;
CREATE POLICY "Users can delete own note likes"
  ON note_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
