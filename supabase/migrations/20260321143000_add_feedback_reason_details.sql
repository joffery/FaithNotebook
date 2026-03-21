/*
  # Add optional reason and details to AI feedback

  1. Purpose
    - Support ChatGPT-style thumb-down feedback
    - Store a structured reason plus optional written details

  2. Safety
    - Additive only
    - Keeps all existing feedback rows intact
*/

ALTER TABLE ai_feedback
  ADD COLUMN IF NOT EXISTS feedback_reason text,
  ADD COLUMN IF NOT EXISTS feedback_details text;

CREATE INDEX IF NOT EXISTS idx_ai_feedback_feedback_reason
  ON ai_feedback (feedback_reason)
  WHERE feedback_reason IS NOT NULL;
