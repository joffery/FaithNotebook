/*
  # Reconcile note likes and enforce one like per user per note

  1. Purpose
    - Ensure a user can like a given note at most once
    - Clean up any historical duplicate likes
    - Recalculate shared_notes.likes_count from note_likes

  2. Safety
    - Additive / corrective only
    - Preserves existing notes and users
    - Does not recreate auth or note records
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'note_likes'
  ) THEN
    DELETE FROM note_likes older
    USING note_likes newer
    WHERE older.id <> newer.id
      AND older.user_id = newer.user_id
      AND older.note_id = newer.note_id
      AND COALESCE(older.created_at, now()) < COALESCE(newer.created_at, now());

    CREATE UNIQUE INDEX IF NOT EXISTS idx_note_likes_user_note_unique
      ON note_likes (user_id, note_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'shared_notes'
  ) THEN
    UPDATE shared_notes
    SET likes_count = 0
    WHERE likes_count IS NULL;

    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'note_likes'
    ) THEN
      UPDATE shared_notes sn
      SET likes_count = COALESCE(like_counts.count_value, 0)
      FROM (
        SELECT note_id, COUNT(*)::integer AS count_value
        FROM note_likes
        GROUP BY note_id
      ) AS like_counts
      WHERE sn.id = like_counts.note_id;

      UPDATE shared_notes sn
      SET likes_count = 0
      WHERE NOT EXISTS (
        SELECT 1
        FROM note_likes nl
        WHERE nl.note_id = sn.id
      );
    END IF;
  END IF;
END $$;
