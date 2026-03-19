/*
  # Add likes_count to shared_notes

  1. Purpose
    - Align shared_notes schema with frontend/community likes features.

  2. Changes
    - Add `likes_count` integer column with default 0.
    - Backfill existing rows to 0.
*/

ALTER TABLE shared_notes
ADD COLUMN IF NOT EXISTS likes_count integer DEFAULT 0;

UPDATE shared_notes
SET likes_count = 0
WHERE likes_count IS NULL;
