/*
  # Expand AI feedback schema

  1. Purpose
    - Capture richer lightweight feedback for AI answers and verse-sermon matches
    - Keep the existing ai_feedback table and old records intact

  2. Safety
    - Additive only
    - No destructive changes to existing feedback or user data
*/

ALTER TABLE ai_feedback
  ADD COLUMN IF NOT EXISTS surface text NOT NULL DEFAULT 'ai_chat',
  ADD COLUMN IF NOT EXISTS feedback_kind text,
  ADD COLUMN IF NOT EXISTS target_ref text,
  ADD COLUMN IF NOT EXISTS target_id text;

CREATE INDEX IF NOT EXISTS idx_ai_feedback_surface_created_at
  ON ai_feedback (surface, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_feedback_kind
  ON ai_feedback (feedback_kind);
