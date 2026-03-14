import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Safety guard: log a critical error at build/init time if env vars are absent
if (!isSupabaseConfigured) {
  console.error(
    '[CRITICAL] Supabase environment variables are missing. ' +
      'EXPO_PUBLIC_SUPABASE_URL and/or EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. ' +
      'All database features will be unavailable.',
  );
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      // Force-inject API key headers on every request so stale browser tokens
      // can never override them in production web deployments.
      global: {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      },
      auth: {
        storage: AsyncStorage,
        // Disable auto-refresh and session persistence so the anon key is
        // always used and is never overridden by cached session tokens.
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })
  : null;

export default supabase;
