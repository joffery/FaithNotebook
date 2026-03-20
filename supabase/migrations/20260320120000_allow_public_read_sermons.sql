-- Allow public (anon) read access to sermons and sermon_chunks
-- This is needed for unauthenticated users to see verse insights and sermon content
-- Notes, shared_notes, and profiles remain authenticated-only

-- sermons: allow anon SELECT
DROP POLICY IF EXISTS "Anyone can read sermons" ON sermons;
CREATE POLICY "Anyone can read sermons"
  ON sermons
  FOR SELECT
  TO anon
  USING (true);

-- sermon_chunks: allow anon SELECT
DROP POLICY IF EXISTS "Anyone can read sermon_chunks" ON sermon_chunks;
CREATE POLICY "Anyone can read sermon_chunks"
  ON sermon_chunks
  FOR SELECT
  TO anon
  USING (true);
