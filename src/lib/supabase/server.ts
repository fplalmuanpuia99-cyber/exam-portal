import {
  createClient as createClientFromCookies,
  createServerSupabaseClient,
} from '@/utils/supabase/server';

export { createClientFromCookies, createServerSupabaseClient };

export async function createClient() {
  return createServerSupabaseClient();
}
