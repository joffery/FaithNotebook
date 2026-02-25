import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          updated_at?: string;
        };
      };
      notes: {
        Row: {
          id: string;
          user_id: string;
          book: string;
          chapter: number;
          verse: number;
          content: string;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          book: string;
          chapter: number;
          verse: number;
          content: string;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          is_public?: boolean;
          updated_at?: string;
        };
      };
      sermons: {
        Row: {
          id: string;
          title: string;
          date: string;
          pastor: string;
          summary: string;
          transcript: string;
          verse_insights: VerseInsight[];
          created_at: string;
        };
      };
      shared_notes: {
        Row: {
          id: string;
          user_id: string;
          book: string;
          chapter: number;
          verse: number;
          content: string;
          likes_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          book: string;
          chapter: number;
          verse: number;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      note_likes: {
        Row: {
          id: string;
          user_id: string;
          note_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          note_id: string;
          created_at?: string;
        };
        Delete: {
          id: string;
        };
      };
    };
  };
};

export type VerseInsight = {
  book: string;
  chapter: number;
  verse: number;
  insight: string;
};
