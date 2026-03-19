/*
  # Add legacy account upgrade fields to profiles

  1. Changes
    - Add nullable `username` to preserve legacy username-based sign-in continuity
    - Add nullable recovery email fields for backward-compatible account upgrade
    - Add nullable completion timestamp so legacy users can be prompted after login

  2. Safety
    - Additive only
    - Does not modify auth.users ids
    - Does not recreate or delete any existing users or linked data
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS recovery_email text,
  ADD COLUMN IF NOT EXISTS recovery_email_added_at timestamptz,
  ADD COLUMN IF NOT EXISTS recovery_email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS account_setup_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS avatar_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_username
  ON profiles (username);
