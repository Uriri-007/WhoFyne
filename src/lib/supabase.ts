import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

export type GenderIdentity = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type VoteType = 'up' | 'down';

export interface Profile {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  gender: GenderIdentity;
  is_uploader: boolean;
  total_votes_received: number;
  created_at: string;
  updated_at: string;
}

export interface UploadRow {
  id: string;
  uploader_id: string;
  image_path: string;
  image_url: string;
  title: string;
  upvotes: number;
  downvotes: number;
  total_votes: number;
  day_key: string;
  created_at: string;
  updated_at: string;
  profiles?: Pick<Profile, 'username' | 'avatar_url'> | null;
}

export function getDefaultAvatar(seed: string) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
}
