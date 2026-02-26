/*
  # Add is_public to notes

  1. Purpose
    - Align notes table with app code that tracks whether a note is private/public.

  2. Changes
    - Add `is_public` boolean column with default false.
    - Backfill existing rows to false.
*/

ALTER TABLE notes
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

UPDATE notes
SET is_public = false
WHERE is_public IS NULL;
