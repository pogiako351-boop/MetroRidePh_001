import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Environment variable sanitiser ───────────────────────────────────────
function cleanEnvVar(value: string | undefined): string {
  if (!value) return '';
  return value
    .replace(/^['"`]|['"`]$/g, '')
    .replace(/[\r\n]/g, '')
    .trim();
}

// ── Prioritized environment variable resolution ───────────────────────────
const rawSupabaseUrl = cleanEnvVar(
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL,
);

// ── https:// enforcement + trailing-slash normalisation ───────────────────
export const supabaseUrl = rawSupabaseUrl
  ? rawSupabaseUrl
      .replace(/^http:\/\//i, 'https://')
      .replace(/\/+$/, '')
  : '';

export const supabaseAnonKey = cleanEnvVar(
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY,
);

// ── Explicit credential validation ───────────────────────────────────────
export type SupabaseConfigStatus = 'configured' | 'missing-config' | 'unconfigured';

function resolveConfigStatus(url: string, key: string): SupabaseConfigStatus {
  if (!url && !key) return 'unconfigured';
  if (!url || !key) return 'missing-config';
  return 'configured';
}

export const supabaseConfigStatus: SupabaseConfigStatus = resolveConfigStatus(
  supabaseUrl,
  supabaseAnonKey,
);

export const isSupabaseConfigured = supabaseConfigStatus === 'configured';

export const SUPABASE_TARGET_REGION = 'sin-1';

// Production origin — used by diagnostics display only.
export const PRODUCTION_ORIGIN = 'https://metrorideph.com';

// ── Production env hardening — verify env vars at boot ──────────────────
// Safe status log: prints "configured" or "MISSING" — never leaks secrets.
console.log(
  `[MetroRide ENV] EXPO_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'configured' : 'MISSING'}`,
);
console.log(
  `[MetroRide ENV] EXPO_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'configured' : 'MISSING'}`,
);
console.log(
  `[MetroRide ENV] EXPO_PUBLIC_NEWELL_API_URL: ${process.env.EXPO_PUBLIC_NEWELL_API_URL ? 'configured' : 'MISSING'}`,
);
console.log(
  `[MetroRide ENV] EXPO_PUBLIC_PROJECT_ID: ${process.env.EXPO_PUBLIC_PROJECT_ID ? 'configured' : 'MISSING'}`,
);
console.log(
  `[MetroRide ENV] Overall config status: ${supabaseConfigStatus}`,
);

if (supabaseConfigStatus === 'unconfigured') {
  console.error(
    '[CRITICAL] Supabase environment variables are missing. ' +
      'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'All database features will be unavailable.',
  );
} else if (supabaseConfigStatus === 'missing-config') {
  console.error(
    '[CRITICAL] Supabase is partially configured — one of URL or ANON_KEY is empty.',
  );
}

// ── Supabase client creation ──────────────────────────────────────────────
// CORS-safe: NO custom headers, NO custom fetch wrappers, NO global headers.
// The @supabase/supabase-js client sends only `apikey` and `Authorization`
// headers which are CORS-safelisted and do NOT trigger preflight requests.

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      db: {
        schema: 'public',
      },
      // IMPORTANT: No `global.headers` or `global.fetch` overrides.
      // Adding custom headers here triggers CORS preflight on web.
    })
  : null;

// ── Direct REST fetch — bypasses Supabase JS client ─────────────────────
// Used as a fallback when the JS client fails (e.g. due to SW interference).
// Only sends CORS-safe headers: apikey + Authorization + Accept.
export async function directSupabaseFetch<T>(
  table: string,
  query: string = '*',
  orderBy?: string,
): Promise<{ data: T[] | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Supabase not configured' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    let url = `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(query)}`;
    if (orderBy) url += `&order=${encodeURIComponent(orderBy)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { data: null, error: `HTTP ${res.status}` };
    }

    const data = (await res.json()) as T[];
    return { data, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: null, error: msg };
  }
}

// ── Production diagnostic logging ────────────────────────────────────────
if (typeof window !== 'undefined') {
  const _buildInfo = {
    supabaseUrl: supabaseUrl ? `${supabaseUrl.slice(0, 30)}...` : 'MISSING',
    supabaseKeyPrefix: supabaseAnonKey ? supabaseAnonKey.slice(0, 16) + '...' : 'MISSING',
    configStatus: supabaseConfigStatus,
    clientCreated: !!supabase,
    origin: window.location.origin,
    timestamp: new Date().toISOString(),
  };
  console.log('[MetroRide Supabase] Init:', JSON.stringify(_buildInfo, null, 2));

  if (!supabase) {
    console.error(
      '[MetroRide Supabase] Client is NULL — all database features disabled.',
      'If this is the live site, the build may be using stale env vars.',
      'Verify EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY were set at build time.',
    );
  }
}

export default supabase;
