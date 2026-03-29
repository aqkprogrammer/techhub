import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const createSupabaseClient = (url: string, anonKey: string): SupabaseClient => {
  return createClient(url, anonKey);
};
