/*
  # Add church affiliation to profiles

  1. Changes
    - Add nullable `church_affiliation` so signup and profile can store church community

  2. Safety
    - Additive only
    - No user ids or linked content are modified
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS church_affiliation text;
