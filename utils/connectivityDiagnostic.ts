/**
 * MetroRide PH — Pulse Diagnostic Engine v2
 * Self-healing connectivity and infrastructure validation.
 *
 * Checks: Internet · Supabase · Newell AI · Env Vars
 *         Service Worker · Cache Integrity
 *
 * If core services (Internet + Supabase) both fail, auto-triggers
 * offline mode so the app serves cached station/fare data.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_TARGET_REGION, supabaseConfigStatus } from './supabase';

export interface DiagnosticResult {
  label: string;
  /** 'waiting' = intentionally deferred (prerequisite failed), not an error */
  status: 'pass' | 'fail' | 'warn' | 'checking' | 'waiting';
  detail: string;
  durationMs?: number;
}

export interface FullDiagnosticReport {
  timestamp: Date;
  overallStatus: 'healthy' | 'degraded' | 'critical';
  results: DiagnosticResult[];
  offlineModeTriggered: boolean;
}

// ── Local env-var sanitiser ───────────────────────────────────────────────

function cleanVar(value: string | undefined): string {
  if (!value) return '';
  return value
    .replace(/^['"`]|['"`]$/g, '')
    .replace(/[\r\n]/g, '')
    .trim();
}

// ── 1. Internet check ─────────────────────────────────────────────────────

async function checkInternet(): Promise<DiagnosticResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    await fetch('https://www.google.com', {
      method: 'HEAD',
      mode:   'no-cors',
      cache:  'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return {
      label:      'Internet Connectivity',
      status:     'pass',
      detail:     `Reachable (${Date.now() - start}ms)`,
      durationMs: Date.now() - start,
    };
  } catch {
    return {
      label:      'Internet Connectivity',
      status:     'fail',
      detail:     'google.com unreachable — verifying via Supabase…',
      durationMs: Date.now() - start,
    };
  }
}

// ── 2. Supabase check ─────────────────────────────────────────────────────

async function checkSupabase(): Promise<DiagnosticResult> {
  const rawUrl = cleanVar(
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL,
  );
  const url = rawUrl
    ? rawUrl.replace(/^http:\/\//i, 'https://').replace(/\/+$/, '')
    : undefined;

  const key = cleanVar(
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY,
  );

  if (!url || !key) {
    const missing = !url ? 'EXPO_PUBLIC_SUPABASE_URL' : 'EXPO_PUBLIC_SUPABASE_ANON_KEY';
    return {
      label:  'Supabase Reachability',
      status: 'fail',
      detail: `Missing Config — ${missing} not resolved. Cannot authenticate.`,
    };
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${url}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        apikey:           key,
        Authorization:    `Bearer ${key}`,
        'x-client-region': SUPABASE_TARGET_REGION,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    const durationMs = Date.now() - start;

    if (res.status === 401) {
      const hint = key ? `Key: ${key.slice(0, 5)}…` : 'Key: (empty)';
      return {
        label:  'Supabase Reachability',
        status: 'fail',
        detail: `Missing Config — HTTP 401 via ${SUPABASE_TARGET_REGION} (${durationMs}ms). ${hint}`,
        durationMs,
      };
    }
    if (res.ok || res.status === 404) {
      return {
        label:      'Supabase Reachability',
        status:     'pass',
        detail:     `Connected via ${SUPABASE_TARGET_REGION} (${durationMs}ms)`,
        durationMs,
      };
    }
    return {
      label:      'Supabase Reachability',
      status:     'warn',
      detail:     `HTTP ${res.status} via ${SUPABASE_TARGET_REGION} (${durationMs}ms)`,
      durationMs,
    };
  } catch {
    return {
      label:      'Supabase Reachability',
      status:     'fail',
      detail:     'Cannot reach Supabase endpoint',
      durationMs: Date.now() - start,
    };
  }
}

// ── 3. Newell AI check ────────────────────────────────────────────────────

async function attemptNewell(url: string, timeoutMs: number) {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, {
      method:  'HEAD',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal:  controller.signal,
    });
    clearTimeout(timer);
    return { ok: true, durationMs: Date.now() - start };
  } catch {
    clearTimeout(timer);
    return { ok: false, durationMs: Date.now() - start };
  }
}

async function checkNewellAI(): Promise<DiagnosticResult> {
  const url = process.env.EXPO_PUBLIC_NEWELL_API_URL;
  if (!url) {
    return { label: 'Newell AI Service', status: 'warn', detail: 'EXPO_PUBLIC_NEWELL_API_URL not set' };
  }

  let last = 0;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { ok, durationMs } = await attemptNewell(url, 2000);
    last = durationMs;
    if (ok) {
      return {
        label:      'Newell AI Service',
        status:     'pass',
        detail:     attempt > 1 ? `Reachable after retry (${durationMs}ms)` : `Reachable (${durationMs}ms)`,
        durationMs,
      };
    }
    if (attempt < 2) await new Promise<void>((r) => setTimeout(r, 400));
  }
  return {
    label:      'Newell AI Service',
    status:     'fail',
    detail:     `Unreachable after 2 attempts — AI features may be limited`,
    durationMs: last,
  };
}

// ── 4. Environment variables check ───────────────────────────────────────

function checkEnvVars(): DiagnosticResult {
  const missing: string[] = [];

  if (
    !process.env.EXPO_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.SUPABASE_URL
  ) missing.push('SUPABASE_URL');

  if (
    !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.SUPABASE_ANON_KEY
  ) missing.push('SUPABASE_ANON_KEY');

  if (!process.env.EXPO_PUBLIC_NEWELL_API_URL)
    missing.push('NEWELL_API_URL');

  if (missing.length === 0) {
    return { label: 'Environment Variables', status: 'pass', detail: 'All required vars present (SUPABASE_URL, SUPABASE_ANON_KEY, NEWELL_API_URL)' };
  }
  const detail = `Missing: ${missing.join(', ')}`;
  return {
    label:  'Environment Variables',
    status: missing.length <= 1 ? 'warn' : 'fail',
    detail,
  };
}

// ── 5. Service Worker check ───────────────────────────────────────────────

async function checkServiceWorker(): Promise<DiagnosticResult> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return {
      label:  'Service Worker',
      status: 'warn',
      detail: 'Service Worker API not available (native build)',
    };
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) {
      return {
        label:  'Service Worker',
        status: 'warn',
        detail: 'No service worker registered — offline mode unavailable',
      };
    }

    const worker = reg.active || reg.installing || reg.waiting;
    if (!worker) {
      return {
        label:  'Service Worker',
        status: 'warn',
        detail: 'Service worker found but not active yet',
      };
    }

    // Request version from the service worker
    const version = await new Promise<string>((resolve) => {
      try {
        const channel = new MessageChannel();
        channel.port1.onmessage = (e) => resolve(e.data?.version ?? 'unknown');
        setTimeout(() => resolve('unknown'), 1200);
        worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
      } catch {
        resolve('unknown');
      }
    });

    const state = reg.active ? 'active' : reg.waiting ? 'waiting' : 'installing';
    return {
      label:  'Service Worker',
      status: 'pass',
      detail: `${state} · cache version ${version} · offline resilience ready`,
    };
  } catch {
    return {
      label:  'Service Worker',
      status: 'fail',
      detail: 'Failed to query service worker status',
    };
  }
}

// ── 6. Cache integrity check ──────────────────────────────────────────────

async function checkCacheIntegrity(): Promise<DiagnosticResult> {
  if (typeof caches === 'undefined') {
    return {
      label:  'Cache Integrity',
      status: 'warn',
      detail: 'Cache Storage API not available (native build)',
    };
  }

  try {
    const names    = await caches.keys();
    const mr       = names.filter((n) => n.startsWith('metroride-'));

    if (mr.length === 0) {
      return {
        label:  'Cache Integrity',
        status: 'warn',
        detail: 'No MetroRide caches found — first run or cache cleared',
      };
    }

    const required = ['metroride-shell', 'metroride-assets', 'metroride-data'];
    const missing  = required.filter((r) => !mr.some((c) => c.startsWith(r)));

    if (missing.length > 0) {
      return {
        label:  'Cache Integrity',
        status: 'warn',
        detail: `Missing cache layers: ${missing.join(', ')} — offline coverage partial`,
      };
    }

    // Count total cached entries
    let totalEntries = 0;
    for (const name of mr) {
      try {
        const c = await caches.open(name);
        const k = await c.keys();
        totalEntries += k.length;
      } catch {
        // Skip unreachable cache
      }
    }

    return {
      label:  'Cache Integrity',
      status: 'pass',
      detail: `${mr.length} layers active · ${totalEntries} entries cached · offline-ready`,
    };
  } catch {
    return {
      label:  'Cache Integrity',
      status: 'fail',
      detail: 'Failed to query Cache Storage',
    };
  }
}

// ── Full diagnostic run ───────────────────────────────────────────────────

export async function runConnectivityDiagnostic(): Promise<FullDiagnosticReport> {
  const envCheck = checkEnvVars();

  // Phase 1 — parallel: Internet + Supabase + SW + Cache
  const [internet, supabaseCheck, swCheck, cacheCheck] = await Promise.all([
    checkInternet(),
    checkSupabase(),
    checkServiceWorker(),
    checkCacheIntegrity(),
  ]);

  // Phase 2 — Newell AI only after Supabase confirms OK
  const resolvedNewell: DiagnosticResult =
    supabaseCheck.status === 'pass'
      ? await checkNewellAI()
      : {
          label:  'Newell AI Service',
          status: 'waiting',
          detail: 'Waiting for Auth — Supabase must return 200 OK before AI validation',
        };

  // Heuristic: treat Internet as PASS when Supabase is confirmed reachable
  const resolvedInternet: DiagnosticResult =
    internet.status === 'fail' && supabaseCheck.status === 'pass'
      ? {
          label:      'Internet Connectivity',
          status:     'pass',
          detail:     'Verified via Supabase (mobile data / restricted network)',
          durationMs: internet.durationMs,
        }
      : internet;

  const results = [
    envCheck,
    resolvedInternet,
    supabaseCheck,
    resolvedNewell,
    swCheck,
    cacheCheck,
  ];

  // ── Auto offline mode trigger ─────────────────────────────────────────
  const offlineModeTriggered =
    resolvedInternet.status === 'fail' && supabaseCheck.status === 'fail';

  try {
    if (offlineModeTriggered) {
      await AsyncStorage.setItem('@metroride_offline_mode', 'true');
    } else {
      await AsyncStorage.removeItem('@metroride_offline_mode');
    }
  } catch {
    // Silent — diagnostics must never crash the app
  }

  // ── Overall status calculation ────────────────────────────────────────
  // 'waiting' is not counted as fail/warn
  const failCount = results.filter((r) => r.status === 'fail').length;
  const warnCount = results.filter((r) => r.status === 'warn').length;

  const isConfigValid       = envCheck.status === 'pass';
  const isConnectivityValid =
    supabaseCheck.status === 'pass' && resolvedInternet.status === 'pass';

  const overallStatus: 'healthy' | 'degraded' | 'critical' =
    failCount >= 2
      ? 'critical'
      : failCount === 1 || warnCount >= 2
        ? 'degraded'
        : !isConfigValid || !isConnectivityValid
          ? 'degraded'
          : 'healthy';

  return {
    timestamp: new Date(),
    overallStatus,
    results,
    offlineModeTriggered,
  };
}
