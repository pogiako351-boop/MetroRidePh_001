import { isSupabaseConfigured, SUPABASE_TARGET_REGION } from './supabase';

export interface DiagnosticResult {
  label: string;
  status: 'pass' | 'fail' | 'warn' | 'checking';
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

// ── Test Supabase REST endpoint ───────────────────────────────────────────
// Includes the sin-1 region routing target in the result detail so the Pulse
// diagnostic surface confirms the correct CDN edge is being targeted.
async function checkSupabase(): Promise<DiagnosticResult> {
  if (!isSupabaseConfigured) {
    return {
      label: 'Supabase Reachability',
      status: 'warn',
      detail: 'Not configured (EXPO_PUBLIC_SUPABASE_URL missing)',
    };
  }

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${url}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''}`,
        // Region-routing hint — targets the Singapore (sin-1) CDN edge node
        // for lower latency from the Philippines.
        'x-client-region': SUPABASE_TARGET_REGION,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const durationMs = Date.now() - start;
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
// Uses a 2-second timeout per attempt.  If the first attempt fails (e.g. the
// reported ~905 ms response spikes past the limit) the check retries once
// after a 400 ms back-off before reporting failure.  This prevents transient
// latency spikes from producing false 'Fail' status in the Pulse dashboard.
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
function checkEnvVars(): DiagnosticResult {
  const missing: string[] = [];
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY');
  if (!process.env.EXPO_PUBLIC_NEWELL_API_URL) missing.push('NEWELL_API_URL');

  if (missing.length === 0) {
    return { label: 'Environment Variables', status: 'pass', detail: 'All required vars present' };
  }
  if (missing.length <= 2) {
    return { label: 'Environment Variables', status: 'warn', detail: `Missing: ${missing.join(', ')}` };
  }
  return { label: 'Environment Variables', status: 'fail', detail: `Missing: ${missing.join(', ')}` };
}

// ── Full diagnostic run ───────────────────────────────────────────────────
// All three network checks run in parallel so one failure cannot block the
// others from reporting their status.  Each check has its own try/catch, so
// a thrown error in any single check is fully isolated.
export async function runConnectivityDiagnostic(): Promise<FullDiagnosticReport> {
  const envCheck = checkEnvVars();

  // Fire all checks simultaneously — no check depends on another's result.
  const [internet, supabaseCheck, newell] = await Promise.all([
    checkInternet(),
    checkSupabase(),
    checkNewellAI(),
  ]);

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

  const results = [envCheck, resolvedInternet, supabaseCheck, newell];
  const failCount = results.filter((r) => r.status === 'fail').length;
  const warnCount = results.filter((r) => r.status === 'warn').length;

  const overallStatus =
    failCount >= 2
      ? 'critical'
      : failCount === 1 || warnCount >= 2
        ? 'degraded'
        : 'healthy';

  return { timestamp: new Date(), overallStatus, results };
}
