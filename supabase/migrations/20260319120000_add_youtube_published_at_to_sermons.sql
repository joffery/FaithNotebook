/*
  # Add YouTube publish date to sermons

  1. Changes
    - Add `youtube_published_at` to `sermons`
    - Used for user-facing sermon sorting, falling back to processed_at when absent
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sermons' AND column_name = 'youtube_published_at'
  ) THEN
    ALTER TABLE sermons ADD COLUMN youtube_published_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sermons_youtube_published_at
  ON sermons (youtube_published_at DESC NULLS LAST);
