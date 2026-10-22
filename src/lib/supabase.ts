import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The Supabase client, or null when VITE_SUPABASE_* aren't set (local-only
 * builds). Only the anon / publishable key is ever used in the browser.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // Picks up the session when the user returns from the email link.
          detectSessionInUrl: true,
          flowType: 'pkce',
          storageKey: 'designshelf.auth',
        },
      })
    : null;

export const BUCKET = 'references';
