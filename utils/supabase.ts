import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { getAvatarUrlForIndex } from './helpers'

export const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_KEY!,
    {
        auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        },
    })

export const ensureProfile = async (
  user: { id: string; email?: string | null },
  usernameOverride?: string | null,
) => {
  const trimmedUsername = usernameOverride?.trim();
  const fallbackUsername = trimmedUsername || user.email?.split('@')[0]?.trim() || 'tambayan-user';

  const { data: existingProfile, error: fetchError } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError;
  }

  const profilePayload = {
    id: user.id,
    email: user.email ?? null,
    username: fallbackUsername,
    avatar_url: existingProfile?.avatar_url ?? getAvatarUrlForIndex(0),
  };

  const { error: upsertError } = await supabase.from('profiles').upsert(profilePayload, {
    onConflict: 'id',
  });

  if (upsertError) {
    throw upsertError;
  }

  return profilePayload;
};