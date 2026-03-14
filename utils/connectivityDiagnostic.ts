import { isSupabaseConfigured } from './supabase';

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
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const durationMs = Date.now() - start;
    if (res.ok || res.status === 200 || res.status === 404) {
      return {
        label: 'Supabase Reachability',
        status: 'pass',
        detail: `Connected (${durationMs}ms)`,
        durationMs,
      };
    }
    return {
      label: 'Supabase Reachability',
      status: 'warn',
      detail: `HTTP ${res.status} (${durationMs}ms)`,
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

// ── Test Newell AI endpoint ───────────────────────────────────────────────
// Runs independently of the internet check result; uses proper JSON headers.
async function checkNewellAI(): Promise<DiagnosticResult> {
  const url = process.env.EXPO_PUBLIC_NEWELL_API_URL;
  if (!url) {
    return {
      label: 'Newell AI Service',
      status: 'warn',
      detail: 'EXPO_PUBLIC_NEWELL_API_URL not set',
    };
  }
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    await fetch(url, {
      method: 'HEAD',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return {
      label: 'Newell AI Service',
      status: 'pass',
      detail: `Reachable (${Date.now() - start}ms)`,
      durationMs: Date.now() - start,
    };
  } catch {
    return {
      label: 'Newell AI Service',
      status: 'fail',
      detail: 'Unreachable — AI features may be limited',
      durationMs: Date.now() - start,
    };
  }
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
