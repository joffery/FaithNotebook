/*
  # Create app feedback table

  1. Purpose
    - Store product feedback about bugs, feature requests, and general app improvements
    - Preserve the best available contact email when available

  2. Safety
    - Additive only
    - No destructive changes to existing tables or auth data
*/

CREATE TABLE IF NOT EXISTS app_feedback (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category text NOT NULL CHECK (
    category IN ('bug_report', 'feature_request', 'improvement', 'other')
  ),
  message text NOT NULL,
  contact_email text,
  user_id uuid,
  display_name text,
  username text,
  church_affiliation text,
  source text NOT NULL DEFAULT 'main_app',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmation_email_sent_at timestamptz,
  confirmation_email_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_feedback_created_at
  ON app_feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_feedback_category_created_at
  ON app_feedback (category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_feedback_user_id
  ON app_feedback (user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE app_feedback ENABLE ROW LEVEL SECURITY;
