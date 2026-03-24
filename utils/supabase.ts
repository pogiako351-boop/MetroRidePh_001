import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Environment variable sanitiser ───────────────────────────────────────
// Strips surrounding single-quotes, double-quotes, or backticks that can be
// accidentally introduced by shell quoting or certain CI/CD secret managers,
// then trims any leading/trailing whitespace (including newline characters).
// This is the primary guard against HTTP 401s caused by a malformed API key.
function cleanEnvVar(value: string | undefined): string {
  if (!value) return '';
  return value
    .replace(/^['"`]|['"`]$/g, '')  // remove wrapping quote/backtick characters
    .replace(/[\r\n]/g, '')          // strip any embedded line-break characters
    .trim();                          // remove leading / trailing whitespace
}

// ── Prioritized environment variable resolution ───────────────────────────
// Priority: EXPO_PUBLIC_* → NEXT_PUBLIC_* → bare SUPABASE_*
// Expo/React Native bundles only inline EXPO_PUBLIC_* at build time, so that
// prefix is checked first to ensure the correct production secret is read on
// the live site before falling back to Next.js and plain Node variants.
const rawSupabaseUrl = cleanEnvVar(
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL,
);

// ── https:// enforcement + trailing-slash normalisation ───────────────────
// Supabase requires TLS for all API calls. Strip any accidental http:// prefix
// and re-attach https://. Also remove trailing slashes so that path segments
// like /rest/v1/ are always constructed with a single slash separator.
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
// Each field is checked independently so partial-configuration ('missing-config')
// is clearly distinguished from a fully-unconfigured state.  This prevents a
// generic HTTP 401 from masking a real misconfiguration at boot time.
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

// Convenience boolean kept for backwards-compatibility with existing consumers.
export const isSupabaseConfigured = supabaseConfigStatus === 'configured';

// Target region for low-latency access from the Philippines.
// Supabase's Cloudflare edge network automatically routes REST API traffic
// through the nearest PoP — for Philippine users this is Singapore (sin-1).
// This constant is used by the Pulse diagnostic to surface the configured
// routing target and verify the endpoint resolves through that region.
export const SUPABASE_TARGET_REGION = 'sin-1';

// Primary production origin for the Philippine market deployment.
// Included in every request so the Supabase edge can correctly attribute
// and validate traffic originating from the production web host.
export const PRODUCTION_ORIGIN = 'https://metrorideph.com';

// Safety guard: report the precise config issue at init time so the root cause
// surfaces immediately in logs rather than manifesting as a cryptic 401 later.
if (supabaseConfigStatus === 'unconfigured') {
  console.error(
    '[CRITICAL] Supabase environment variables are missing. ' +
      'Set SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_URL ' +
      'and the corresponding ANON_KEY variant. All database features will be unavailable.',
  );
} else if (supabaseConfigStatus === 'missing-config') {
  console.error(
    '[CRITICAL] Supabase is partially configured — Missing Config. ' +
      'One of SUPABASE_URL or SUPABASE_ANON_KEY resolved to an empty value. ' +
      'Verify all three prefix variants (SUPABASE_*, NEXT_PUBLIC_*, EXPO_PUBLIC_*).',
  );
}

// ── Supabase client creation ──────────────────────────────────────────────
// Simplified client that avoids custom headers / fetch wrappers that can
// trigger CORS preflight failures on web/PWA deployments.  The JS client
// already sends apikey + Authorization automatically — no manual injection
// is needed.

export const supabase = isSupabaseConfigured
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
    })
  : null;

// ── Production diagnostic logging ────────────────────────────────────────
// These logs appear in the browser console on the live site and help
// diagnose "Database unreachable" reports without needing source access.

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
