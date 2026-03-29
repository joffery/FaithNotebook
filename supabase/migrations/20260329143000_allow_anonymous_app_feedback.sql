/*
  # Allow anonymous app feedback contact email

  1. Purpose
    - Let unsigned-in users submit product feedback anonymously
    - Preserve contact email only when the app already knows it

  2. Safety
    - Additive / compatible follow-up migration
    - Safe even if the original create-table migration was already applied
*/

ALTER TABLE app_feedback
  ALTER COLUMN contact_email DROP NOT NULL;
