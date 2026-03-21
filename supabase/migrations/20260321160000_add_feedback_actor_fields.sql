/*
  # Add actor fields to AI feedback

  1. Purpose
    - Associate feedback with a signed-in user when available
    - Preserve anonymous feedback with a stable session id
    - Support actor-scoped history and de-duplication

  2. Safety
    - Additive only
    - Keeps all existing feedback rows intact
*/

ALTER TABLE ai_feedback
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS anonymous_session_id text,
  ADD COLUMN IF NOT EXISTS feedback_actor_key text;

CREATE INDEX IF NOT EXISTS idx_ai_feedback_user_id
  ON ai_feedback (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_feedback_anonymous_session_id
  ON ai_feedback (anonymous_session_id)
  WHERE anonymous_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_feedback_feedback_actor_key
  ON ai_feedback (feedback_actor_key)
  WHERE feedback_actor_key IS NOT NULL;
