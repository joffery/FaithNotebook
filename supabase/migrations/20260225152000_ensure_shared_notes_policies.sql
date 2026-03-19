/*
  # Ensure shared_notes RLS policies exist

  1. Why
    - Some environments auto-enable RLS via DDL trigger before policies are applied.
    - This can leave `shared_notes` inaccessible if policies were skipped or dropped.

  2. Changes
    - Ensure RLS is enabled on shared_notes.
    - Recreate expected SELECT/INSERT/UPDATE/DELETE policies idempotently.
*/

ALTER TABLE IF EXISTS shared_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view shared notes" ON shared_notes;
CREATE POLICY "Anyone can view shared notes"
  ON shared_notes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert own shared notes" ON shared_notes;
CREATE POLICY "Users can insert own shared notes"
  ON shared_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own shared notes" ON shared_notes;
CREATE POLICY "Users can update own shared notes"
  ON shared_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own shared notes" ON shared_notes;
CREATE POLICY "Users can delete own shared notes"
  ON shared_notes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
