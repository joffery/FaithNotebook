/*
  # Create AI feedback table

  1. Purpose
    - Store lightweight helpful / not helpful feedback from AI Chat

  2. Safety
    - Additive only
    - Does not modify users, notes, sermons, or auth tables
*/

CREATE TABLE IF NOT EXISTS ai_feedback (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question text,
  answer_preview text NOT NULL,
  was_helpful boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_created_at
  ON ai_feedback (created_at DESC);
