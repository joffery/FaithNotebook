/*
  # Add feedback keys for reversible AI feedback

  1. Purpose
    - Let the app overwrite or remove a specific feedback selection
    - Support mutually exclusive feedback groups like helpful/not helpful

  2. Safety
    - Additive only
    - Keeps existing feedback rows intact
*/

ALTER TABLE ai_feedback
  ADD COLUMN IF NOT EXISTS feedback_key text,
  ADD COLUMN IF NOT EXISTS feedback_group_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_feedback_feedback_key
  ON ai_feedback (feedback_key)
  WHERE feedback_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_feedback_feedback_group_key
  ON ai_feedback (feedback_group_key)
  WHERE feedback_group_key IS NOT NULL;
