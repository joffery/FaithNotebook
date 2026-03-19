/*
  # Enforce one note per user and verse

  1. Purpose
    - Prevent duplicate rows for same user/book/chapter/verse, which can break single-note reads.

  2. Changes
    - Deduplicate existing rows, keeping the most recently updated row.
    - Add a unique index on (user_id, book, chapter, verse).
*/

DELETE FROM notes n1
USING notes n2
WHERE n1.id <> n2.id
  AND n1.user_id = n2.user_id
  AND n1.book = n2.book
  AND n1.chapter = n2.chapter
  AND n1.verse = n2.verse
  AND COALESCE(n1.updated_at, n1.created_at) < COALESCE(n2.updated_at, n2.created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notes_user_book_chapter_verse_unique
ON notes (user_id, book, chapter, verse);
