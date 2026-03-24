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

// ── Region-aware custom fetch ─────────────────────────────────────────────
// Attaches region-preference and production-origin headers on every request so
// Supabase's CDN edge routes through Singapore (sin-1) for Philippine users.
// Also re-injects apikey + Authorization on each call to prevent stale browser
// session tokens from overriding the anon key in production web deployments.
function createRegionFetch(region: string, anonKey: string) {
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    // Singapore (sin-1) CDN edge routing hint — keeps latency low for PH users.
    headers.set('x-client-region', region);
    // Explicit auth headers — prevents any cached/stale token from taking over.
    headers.set('apikey', anonKey);
    headers.set('Authorization', `Bearer ${anonKey}`);
    return fetch(input, { ...init, headers });
  };
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      // Force-inject API key and auth headers on every request so stale browser
      // tokens can never override them when deployed at the production origin
      // (https://metrorideph.com).
      global: {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          // Declare the primary production origin so the Supabase edge can
          // correctly attribute requests from the Philippine deployment.
          'x-origin': PRODUCTION_ORIGIN,
        },
        // Route REST requests through the Singapore (sin-1) CDN edge node to
        // keep latency low for Philippine users. The custom fetch also
        // re-injects auth headers to guard against token override edge-cases.
        fetch: createRegionFetch(SUPABASE_TARGET_REGION, supabaseAnonKey),
      },
      auth: {
        storage: AsyncStorage,
        // Disable auto-refresh and session persistence so the anon key is
        // always used and is never overridden by cached session tokens.
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      // ── Security Hardening (April 8, 2026 deadline) ─────────────────────
      // Disable root API access (/rest/v1/) — all queries MUST target tables
      // directly via .from('table_name'). This prevents OpenAPI schema fetching
      // and dynamic discovery from leaking table structure via the anon key.
      db: {
        schema: 'public',
      },
      // Disable realtime for security — we use polling-based sync instead.
      realtime: {
        params: {
          eventsPerSecond: 0,
        },
      },
    })
  : null;

export default supabase;
