/*
  # Add Functions for Managing Likes

  1. Functions
    - `increment_likes(note_id)` - Increments the likes_count for a shared note
    - `decrement_likes(note_id)` - Decrements the likes_count for a shared note (minimum 0)

  2. Security
    - These functions can be called by authenticated users
    - They safely update the likes_count column on shared_notes table

  3. Important Notes
    - The functions use atomic operations to prevent race conditions
    - decrement_likes ensures likes_count never goes below 0
*/

-- Function to increment likes count
CREATE OR REPLACE FUNCTION increment_likes(note_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE shared_notes
  SET likes_count = COALESCE(likes_count, 0) + 1
  WHERE id = note_id;
END;
$$;

-- Function to decrement likes count
CREATE OR REPLACE FUNCTION decrement_likes(note_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE shared_notes
  SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0)
  WHERE id = note_id;
END;
$$;