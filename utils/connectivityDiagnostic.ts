/**
 * MetroRide PH — Pulse Diagnostic Engine v3 (Local-First)
 * Zero-failure architecture: validates local data integrity,
 * Newell AI availability, Service Worker status, and cache health.
 *
 * No Supabase dependency. All transit data is embedded locally.
 */

export interface DiagnosticResult {
  label: string;
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

// ── 1. Local Data Integrity Check ────────────────────────────────────────

function checkLocalDataIntegrity(): DiagnosticResult {
  const start = Date.now();
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ALL_STATIONS } = require('@/constants/stations');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MRT3_FARE_MATRIX, LRT1_FARE_MATRIX, LRT2_FARE_MATRIX } = require('@/constants/fares');
    const stationCount = ALL_STATIONS?.length ?? 0;
    const mrt3Rows = MRT3_FARE_MATRIX?.length ?? 0;
    const lrt1Rows = LRT1_FARE_MATRIX?.length ?? 0;
    const lrt2Rows = LRT2_FARE_MATRIX?.length ?? 0;
    const durationMs = Date.now() - start;

    if (stationCount >= 51 && mrt3Rows > 0 && lrt1Rows > 0 && lrt2Rows > 0) {
      return {
        label: 'Local Data Integrity',
        status: 'pass',
        detail: `${stationCount} stations, MRT-3(${mrt3Rows}), LRT-1(${lrt1Rows}), LRT-2(${lrt2Rows}) fare matrices verified (${durationMs}ms)`,
        durationMs,
      };
    }
    return {
      label: 'Local Data Integrity',
      status: 'warn',
      detail: `Partial data: ${stationCount} stations, MRT-3(${mrt3Rows}), LRT-1(${lrt1Rows}), LRT-2(${lrt2Rows})`,
      durationMs,
    };
  } catch {
    return {
      label: 'Local Data Integrity',
      status: 'fail',
      detail: 'Failed to load local transit data assets',
      durationMs: Date.now() - start,
    };
  }
}

// ── 2. Internet check ─────────────────────────────────────────────────────

async function checkInternet(): Promise<DiagnosticResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    await fetch('https://www.google.com', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return {
      label: 'Internet Connectivity',
      status: 'pass',
      detail: `Reachable (${Date.now() - start}ms)`,
      durationMs: Date.now() - start,
    };
  } catch {
    return {
      label: 'Internet Connectivity',
      status: 'warn',
      detail: `Not reachable (${Date.now() - start}ms) — app operates fully offline`,
      durationMs: Date.now() - start,
    };
  }
}

// ── 3. Newell AI check ──────────────────────────────────────────────────

async function checkNewellAI(): Promise<DiagnosticResult> {
  const url = process.env.EXPO_PUBLIC_NEWELL_API_URL;
  if (!url) {
    return { label: 'Newell AI Service', status: 'warn', detail: 'EXPO_PUBLIC_NEWELL_API_URL not set' };
  }

  const start = Date.now();
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      await fetch(url, {
        method: 'HEAD',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      const durationMs = Date.now() - start;
      return {
        label: 'Newell AI Service',
        status: 'pass',
        detail: attempt > 1 ? `Reachable after retry (${durationMs}ms)` : `Reachable (${durationMs}ms)`,
        durationMs,
      };
    } catch {
      if (attempt < 2) await new Promise<void>((r) => setTimeout(r, 400));
    }
  }
  return {
    label: 'Newell AI Service',
    status: 'warn',
    detail: `Unreachable after 2 attempts — AI features may use fallback responses`,
    durationMs: Date.now() - start,
  };
}

// ── 4. Environment variables check ──────────────────────────────────────

function checkEnvVars(): DiagnosticResult {
  const missing: string[] = [];

  if (!process.env.EXPO_PUBLIC_NEWELL_API_URL)
    missing.push('NEWELL_API_URL');

  if (missing.length === 0) {
    return { label: 'Environment Variables', status: 'pass', detail: 'All required vars present (NEWELL_API_URL). Local-first mode — no database env vars needed.' };
  }
  return {
    label: 'Environment Variables',
    status: 'warn',
    detail: `Missing: ${missing.join(', ')} — AI features may be limited`,
  };
}

// ── 5. Service Worker check ─────────────────────────────────────────────

async function checkServiceWorker(): Promise<DiagnosticResult> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return {
      label: 'Service Worker',
      status: 'warn',
      detail: 'Service Worker API not available (native build)',
    };
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) {
      return {
        label: 'Service Worker',
        status: 'warn',
        detail: 'No service worker registered — offline caching unavailable',
      };
    }

    const worker = reg.active || reg.installing || reg.waiting;
    if (!worker) {
      return {
        label: 'Service Worker',
        status: 'warn',
        detail: 'Service worker found but not active yet',
      };
    }

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
      label: 'Service Worker',
      status: 'pass',
      detail: `${state} · cache version ${version} · offline resilience ready`,
    };
  } catch {
    return {
      label: 'Service Worker',
      status: 'fail',
      detail: 'Failed to query service worker status',
    };
  }
}

// ── 6. Cache integrity check ────────────────────────────────────────────

async function checkCacheIntegrity(): Promise<DiagnosticResult> {
  if (typeof caches === 'undefined') {
    return {
      label: 'Cache Integrity',
      status: 'warn',
      detail: 'Cache Storage API not available (native build)',
    };
  }

  try {
    const names = await caches.keys();
    const mr = names.filter((n) => n.startsWith('metroride-'));

    if (mr.length === 0) {
      return {
        label: 'Cache Integrity',
        status: 'warn',
        detail: 'No MetroRide caches found — first run or cache cleared',
      };
    }

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
      label: 'Cache Integrity',
      status: 'pass',
      detail: `${mr.length} layers active · ${totalEntries} entries cached · offline-ready`,
    };
  } catch {
    return {
      label: 'Cache Integrity',
      status: 'fail',
      detail: 'Failed to query Cache Storage',
    };
  }
}

// ── Full diagnostic run ────────────────────────────────────────────────

export async function runConnectivityDiagnostic(): Promise<FullDiagnosticReport> {
  const envCheck = checkEnvVars();
  const localDataCheck = checkLocalDataIntegrity();

  const [internet, newellCheck, swCheck, cacheCheck] = await Promise.all([
    checkInternet(),
    checkNewellAI(),
    checkServiceWorker(),
    checkCacheIntegrity(),
  ]);

  const results: DiagnosticResult[] = [
    localDataCheck,
    envCheck,
    internet,
    newellCheck,
    swCheck,
    cacheCheck,
  ];

  // In local-first mode, offline mode is never "triggered" since we don't depend on network
  const offlineModeTriggered = false;

  // Overall status: local data is the critical path
  const failCount = results.filter((r) => r.status === 'fail').length;
  const warnCount = results.filter((r) => r.status === 'warn').length;

  const overallStatus: 'healthy' | 'degraded' | 'critical' =
    localDataCheck.status === 'fail'
      ? 'critical'
      : failCount >= 2
        ? 'critical'
        : failCount === 1 || warnCount >= 3
          ? 'degraded'
          : 'healthy';

  return {
    timestamp: new Date(),
    overallStatus,
    results,
    offlineModeTriggered,
  };
}
