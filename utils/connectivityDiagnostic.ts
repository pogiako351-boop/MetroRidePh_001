import { isSupabaseConfigured, SUPABASE_TARGET_REGION, supabaseConfigStatus } from './supabase';

export interface DiagnosticResult {
  label: string;
  // 'waiting' indicates the check was intentionally deferred because a
  // prerequisite service (e.g. Supabase auth) has not yet succeeded.
  status: 'pass' | 'fail' | 'warn' | 'checking' | 'waiting';
  detail: string;
  durationMs?: number;
}

export interface FullDiagnosticReport {
  timestamp: Date;
  overallStatus: 'healthy' | 'degraded' | 'critical';
  results: DiagnosticResult[];
}

// ── Test internet connectivity via a HEAD request to google.com ──────────
// Uses no-cors + no-store to bypass CORS preflight issues in production web
// deployments.  The check succeeds as long as the fetch promise fulfils —
// an opaque response is fine because we only care about reachability.
async function checkInternet(): Promise<DiagnosticResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch('https://www.google.com', {
      method: 'HEAD',
      // no-cors avoids CORS preflight failures; no-store prevents cached hits
      // from masking a real connectivity loss.
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    // Promise fulfilled → internet is reachable (response may be opaque)
    return {
      label: 'Internet Connectivity',
      status: 'pass',
      detail: `Reachable (${Date.now() - start}ms)`,
      durationMs: Date.now() - start,
    };
  } catch {
    // Fetch rejected (network error / timeout) → no connectivity
    return {
      label: 'Internet Connectivity',
      status: 'fail',
      detail: 'google.com unreachable — verifying via Supabase…',
      durationMs: Date.now() - start,
    };
  }
}

// ── Local env-var sanitiser (mirrors utils/supabase.ts cleanEnvVar) ──────
// Strips surrounding quotes/backticks and trims whitespace so the diagnostic
// always validates the exact same sanitised credential as the live client.
function cleanDiagnosticEnvVar(value: string | undefined): string {
  if (!value) return '';
  return value
    .replace(/^['"`]|['"`]$/g, '')
    .replace(/[\r\n]/g, '')
    .trim();
}

// ── Test Supabase REST endpoint ───────────────────────────────────────────
// Priority: EXPO_PUBLIC_* → NEXT_PUBLIC_* → bare SUPABASE_*
// Matches the updated priority order in utils/supabase.ts so the diagnostic
// always validates the exact same credential that the live client uses.
// HTTP 401 is explicitly detected and surfaced as 'Missing Config' to prevent
// it from appearing as a generic network error in the Pulse dashboard.
async function checkSupabase(): Promise<DiagnosticResult> {
  // Resolve and sanitise using the same priority order as the Supabase client.
  const rawUrl = cleanDiagnosticEnvVar(
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL,
  );

  // Enforce https:// and strip trailing slashes — mirrors utils/supabase.ts.
  const url = rawUrl
    ? rawUrl.replace(/^http:\/\//i, 'https://').replace(/\/+$/, '')
    : undefined;

  const key = cleanDiagnosticEnvVar(
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY,
  );

  // Explicit pre-flight validation — report 'Missing Config' before attempting
  // any network handshake so the error origin is unambiguous.
  if (!url || !key) {
    const missingField = !url ? 'EXPO_PUBLIC_SUPABASE_URL' : 'EXPO_PUBLIC_SUPABASE_ANON_KEY';
    return {
      label: 'Supabase Reachability',
      status: 'fail',
      detail: `Missing Config — ${missingField} not resolved across any prefix variant. Cannot authenticate.`,
    };
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${url}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        // Explicit auth headers ensure the correct anon key is always sent,
        // regardless of any cached or ambient tokens in the environment.
        apikey: key,
        Authorization: `Bearer ${key}`,
        // Region-routing hint — targets the Singapore (sin-1) CDN edge node
        // for lower latency from the Philippines.
        'x-client-region': SUPABASE_TARGET_REGION,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const durationMs = Date.now() - start;

    // Explicitly surface a 401 as 'Missing Config' so it is not confused with
    // a generic network error.  A 401 at this endpoint always means the API key
    // was rejected — most likely because it is invalid or was not transmitted.
    // The first 5 characters of the resolved key are included so the deployment
    // logs can confirm which production secret was actually read at runtime.
    if (res.status === 401) {
      const keyHint = key ? `Key: ${key.slice(0, 5)}…` : 'Key: (empty)';
      return {
        label: 'Supabase Reachability',
        status: 'fail',
        detail: `Missing Config — HTTP 401 Unauthorized via ${SUPABASE_TARGET_REGION} (${durationMs}ms). ${keyHint} — Verify SUPABASE_ANON_KEY is correct.`,
        durationMs,
      };
    }

    if (res.ok || res.status === 200 || res.status === 404) {
      return {
        label: 'Supabase Reachability',
        status: 'pass',
        detail: `Connected via ${SUPABASE_TARGET_REGION} (${durationMs}ms)`,
        durationMs,
      };
    }

    return {
      label: 'Supabase Reachability',
      status: 'warn',
      detail: `HTTP ${res.status} via ${SUPABASE_TARGET_REGION} (${durationMs}ms)`,
      durationMs,
    };
  } catch {
    return {
      label: 'Supabase Reachability',
      status: 'fail',
      detail: 'Cannot reach Supabase endpoint',
      durationMs: Date.now() - start,
    };
  }
}

// ── Newell AI single-attempt fetch ────────────────────────────────────────
// Returns duration in ms and whether the attempt succeeded.
async function attemptNewellAI(
  url: string,
  timeoutMs: number,
): Promise<{ ok: boolean; durationMs: number }> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, {
      method: 'HEAD',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return { ok: true, durationMs: Date.now() - start };
  } catch {
    clearTimeout(timer);
    return { ok: false, durationMs: Date.now() - start };
  }
}

// ── Test Newell AI endpoint ───────────────────────────────────────────────
// Uses a 2-second timeout per attempt.  If the first attempt fails the check
// retries once after a 400 ms back-off before reporting failure.  This prevents
// transient latency spikes from producing false 'Fail' status in Pulse.
async function checkNewellAI(): Promise<DiagnosticResult> {
  const url = process.env.EXPO_PUBLIC_NEWELL_API_URL;
  if (!url) {
    return {
      label: 'Newell AI Service',
      status: 'warn',
      detail: 'EXPO_PUBLIC_NEWELL_API_URL not set',
    };
  }

  const TIMEOUT_MS = 2000;      // hard cap per attempt
  const RETRY_DELAY_MS = 400;   // back-off between attempts
  const MAX_ATTEMPTS = 2;

  let lastDurationMs = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { ok, durationMs } = await attemptNewellAI(url, TIMEOUT_MS);
    lastDurationMs = durationMs;

    if (ok) {
      return {
        label: 'Newell AI Service',
        status: 'pass',
        detail:
          attempt > 1
            ? `Reachable after retry (${durationMs}ms)`
            : `Reachable (${durationMs}ms)`,
        durationMs,
      };
    }

    // Pause before the next attempt unless this was the last one
    if (attempt < MAX_ATTEMPTS) {
      await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  return {
    label: 'Newell AI Service',
    status: 'fail',
    detail: `Unreachable after ${MAX_ATTEMPTS} attempts — AI features may be limited`,
    durationMs: lastDurationMs,
  };
}

// ── Check environment variables ───────────────────────────────────────────
// Checks all three prefix variants (standard, NEXT_PUBLIC, EXPO_PUBLIC) for
// each required variable so the report accurately reflects whether credentials
// are resolvable in the current build environment.
function checkEnvVars(): DiagnosticResult {
  const missing: string[] = [];

  const hasSupabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const hasSupabaseKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  const hasNewellUrl = process.env.EXPO_PUBLIC_NEWELL_API_URL;

  if (!hasSupabaseUrl) missing.push('SUPABASE_URL');
  if (!hasSupabaseKey) missing.push('SUPABASE_ANON_KEY');
  if (!hasNewellUrl)   missing.push('NEWELL_API_URL');

  if (missing.length === 0) {
    return {
      label: 'Environment Variables',
      status: 'pass',
      detail: 'All required vars present',
    };
  }

  const missingDetail = `Missing Config — ${missing.join(', ')} not resolved across any prefix variant`;
  if (missing.length <= 2) {
    return { label: 'Environment Variables', status: 'warn', detail: missingDetail };
  }
  return { label: 'Environment Variables', status: 'fail', detail: missingDetail };
}

// ── Full diagnostic run ───────────────────────────────────────────────────
// Execution order:
//   1. Internet + Supabase run in parallel (independent of each other).
//   2. Newell AI is triggered ONLY after Supabase returns a successful (pass)
//      response — matching the requirement that AI initialisation depends on
//      the Supabase 200 OK gate.  When Supabase fails / returns 401, Newell AI
//      is shown as 'Waiting for Auth' without making a network attempt.
export async function runConnectivityDiagnostic(): Promise<FullDiagnosticReport> {
  const envCheck = checkEnvVars();

  // Phase 1 — run Internet and Supabase in parallel.
  const [internet, supabaseCheck] = await Promise.all([
    checkInternet(),
    checkSupabase(),
  ]);

  // Phase 2 — trigger Newell AI immediately after Supabase returns 200 OK.
  // When Supabase is blocked (401 / missing-config) or otherwise failing,
  // mark Newell AI as 'Waiting for Auth' rather than running the check so
  // Pulse only shows one root-cause failure instead of cascading errors.
  const resolvedNewell: DiagnosticResult = supabaseCheck.status === 'pass'
    ? await checkNewellAI()
    : {
        label: 'Newell AI Service',
        status: 'waiting',
        detail:
          'Waiting for Auth — Supabase must return 200 OK before the AI service can be validated',
      };

  // ── Heuristic: treat Internet as PASS when Supabase is confirmed reachable.
  // This avoids false 'Fail' reports on mobile data where google.com HEAD
  // requests may be blocked by carrier networks or captive portals, but
  // real internet access is present (proven by Supabase connectivity).
  const resolvedInternet: DiagnosticResult =
    internet.status === 'fail' && supabaseCheck.status === 'pass'
      ? {
          label: 'Internet Connectivity',
          status: 'pass',
          detail: 'Verified via Supabase (mobile data / restricted network)',
          durationMs: internet.durationMs,
        }
      : internet;

  const results = [envCheck, resolvedInternet, supabaseCheck, resolvedNewell];

  // 'waiting' is intentionally excluded from fail/warn counts — it is a
  // deferred state, not an independent failure.
  const failCount = results.filter((r) => r.status === 'fail').length;
  const warnCount = results.filter((r) => r.status === 'warn').length;

  // ── Strict 'All Green' gate ───────────────────────────────────────────────
  // 'healthy' (All Green) is only reached when BOTH of the following are true:
  //   1. Configuration is validated — all required env vars are present.
  //   2. Connectivity is confirmed — Supabase is reachable and responding.
  // Any fail or 2+ warn results, OR unvalidated config/connectivity, yields
  // 'degraded' or 'critical' instead.
  const isConfigValid       = envCheck.status === 'pass';
  const isConnectivityValid = supabaseCheck.status === 'pass' && resolvedInternet.status === 'pass';

  const overallStatus: 'healthy' | 'degraded' | 'critical' =
    failCount >= 2
      ? 'critical'
      : failCount === 1 || warnCount >= 2
        ? 'degraded'
        : !isConfigValid || !isConnectivityValid
          ? 'degraded'  // Connectivity or config not fully validated — not All Green
          : 'healthy';  // All Green: config present AND connectivity confirmed

  return { timestamp: new Date(), overallStatus, results };
}
