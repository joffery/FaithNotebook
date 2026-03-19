/*
  # Update Sermons Table Schema

  1. Changes
    - Add missing columns: speaker, church, book_reference, series_number, word_count, verses, tags, transcript_preview
    - Rename existing columns: pastor -> (already covered by speaker), date -> (remove), transcript -> (already covered by transcript_preview)
  
  2. Notes
    - This migration updates the sermons table to match the JSON structure from sermons_processed.json
*/

DO $$
BEGIN
  -- Add new columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sermons' AND column_name = 'speaker'
  ) THEN
    ALTER TABLE sermons ADD COLUMN speaker text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sermons' AND column_name = 'church'
  ) THEN
    ALTER TABLE sermons ADD COLUMN church text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sermons' AND column_name = 'book_reference'
  ) THEN
    ALTER TABLE sermons ADD COLUMN book_reference text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sermons' AND column_name = 'series_number'
  ) THEN
    ALTER TABLE sermons ADD COLUMN series_number int NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sermons' AND column_name = 'word_count'
  ) THEN
    ALTER TABLE sermons ADD COLUMN word_count int NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sermons' AND column_name = 'verses'
  ) THEN
    ALTER TABLE sermons ADD COLUMN verses jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sermons' AND column_name = 'tags'
  ) THEN
    ALTER TABLE sermons ADD COLUMN tags jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sermons' AND column_name = 'transcript_preview'
  ) THEN
    ALTER TABLE sermons ADD COLUMN transcript_preview text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Drop old columns that are no longer needed
ALTER TABLE sermons DROP COLUMN IF EXISTS pastor;
ALTER TABLE sermons DROP COLUMN IF EXISTS date;
ALTER TABLE sermons DROP COLUMN IF EXISTS transcript;