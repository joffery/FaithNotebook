/*
  # Enforce one like per user per note

  1. Purpose
    - Prevent the same user from creating multiple likes on the same shared note.

  2. Changes
    - Deduplicate existing `note_likes` rows by (user_id, note_id).
    - Add a unique index on (user_id, note_id).
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'note_likes'
  ) THEN
    DELETE FROM note_likes n1
    USING note_likes n2
    WHERE n1.id <> n2.id
      AND n1.user_id = n2.user_id
      AND n1.note_id = n2.note_id
      AND COALESCE(n1.created_at, now()) < COALESCE(n2.created_at, now());

    CREATE UNIQUE INDEX IF NOT EXISTS idx_note_likes_user_note_unique
      ON note_likes (user_id, note_id);
  END IF;
END $$;
