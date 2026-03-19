/*
  # Faith Notebook Database Schema

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key, references auth.users)
      - `display_name` (text, user's chosen display name)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `notes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `book` (text, e.g., "Matthew")
      - `chapter` (integer)
      - `verse` (integer)
      - `content` (text, the note content)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `sermons`
      - `id` (uuid, primary key)
      - `title` (text)
      - `date` (date)
      - `pastor` (text)
      - `summary` (text)
      - `transcript` (text)
      - `verse_insights` (jsonb, array of verse insights)
      - `created_at` (timestamp)
    
    - `shared_notes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `book` (text)
      - `chapter` (integer)
      - `verse` (integer)
      - `content` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Profiles: Users can read all profiles, update only their own
    - Notes: Users can only read/write their own notes
    - Sermons: All authenticated users can read sermons
    - Shared_notes: All authenticated users can read, users can create/update/delete only their own
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Notes table (private notes)
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book text NOT NULL,
  chapter integer NOT NULL,
  verse integer NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_user_verse ON notes(user_id, book, chapter, verse);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes"
  ON notes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
  ON notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON notes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Sermons table
CREATE TABLE IF NOT EXISTS sermons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  date date NOT NULL,
  pastor text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  transcript text NOT NULL DEFAULT '',
  verse_insights jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sermons_verse_insights ON sermons USING gin(verse_insights);

ALTER TABLE sermons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sermons"
  ON sermons FOR SELECT
  TO authenticated
  USING (true);

-- Shared notes table (community notes)
CREATE TABLE IF NOT EXISTS shared_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book text NOT NULL,
  chapter integer NOT NULL,
  verse integer NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_notes_verse ON shared_notes(book, chapter, verse);

ALTER TABLE shared_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shared notes"
  ON shared_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own shared notes"
  ON shared_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shared notes"
  ON shared_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own shared notes"
  ON shared_notes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);