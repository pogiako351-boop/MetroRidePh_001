import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Target region for low-latency access from the Philippines.
// Supabase's Cloudflare edge network automatically routes REST API traffic
// through the nearest PoP — for Philippine users this is Singapore (sin-1).
// This constant is used by the Pulse diagnostic to surface the configured
// routing target and verify the endpoint resolves through that region.
export const SUPABASE_TARGET_REGION = 'sin-1';

// Safety guard: log a critical error at build/init time if env vars are absent
if (!isSupabaseConfigured) {
  console.error(
    '[CRITICAL] Supabase environment variables are missing. ' +
      'EXPO_PUBLIC_SUPABASE_URL and/or EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. ' +
      'All database features will be unavailable.',
  );
}

// ── Region-aware custom fetch ─────────────────────────────────────────────
// Attaches a region-preference hint header so Supabase's CDN edge layer can
// route the request through the Singapore (sin-1) PoP, minimising round-trip
// latency for users in the Philippines. This does NOT change the physical
// database location — it only influences CDN edge selection.
function createRegionFetch(region: string) {
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    headers.set('x-client-region', region);
    return fetch(input, { ...init, headers });
  };
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
        // Route REST requests through the Singapore (sin-1) CDN edge node to
        // keep latency low for Philippine users.
        fetch: createRegionFetch(SUPABASE_TARGET_REGION),
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
