import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Profile, UserRole } from '@/types/database';

function normalizeRole(role: unknown): UserRole {
  if (role === 'admin' || role === 'instructor' || role === 'student') {
    return role;
  }
  return 'student';
}

export async function ensureProfile(
  supabase: SupabaseClient<Database>,
  user: User
): Promise<{ profile: Profile | null; error: string | null }> {
  const { data: existing, error: selectError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (selectError) {
    return { profile: null, error: selectError.message };
  }
  if (existing) {
    return { profile: existing, error: null };
  }

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email ?? '',
      full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
      role: normalizeRole(user.user_metadata?.role),
    })
    .select('*')
    .single();

  if (insertError) {
    return { profile: null, error: insertError.message };
  }

  return { profile: created, error: null };
}
