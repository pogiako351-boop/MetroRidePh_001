/**
 * MetroRide PH — Guardian Monitoring System (Local-First)
 * Background module tracking AI service latency, local data integrity,
 * and traffic patterns. No Supabase dependency — zero-failure architecture.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import rateLimiter from './rateLimiter';

const GUARDIAN_ALERTS_KEY  = '@metroride_guardian_alerts';
const GUARDIAN_METRICS_KEY = '@metroride_guardian_metrics';
const MAX_ALERTS  = 50;
const MAX_METRICS = 120; // 2 hours of per-minute samples

const TRAFFIC_SPIKE_RPM   = 25;

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertType =
  | 'high_latency'
  | 'db_unreachable'
  | 'traffic_spike'
  | 'api_error'
  | 'offline_detected'
  | 'cache_stale'
  | 'bot_detected'
  | 'rate_limit_exceeded'
  | 'service_restored'
  | 'local_data_verified';

export interface GuardianAlert {
  id: string;
  timestamp: string;
  severity: AlertSeverity;
  type: AlertType;
  message: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface GuardianMetric {
  timestamp: string;
  supabaseLatencyMs: number | null;
  newellLatencyMs: number | null;
  isOnline: boolean;
  errorCount: number;
  requestsPerMin: number;
}

export interface GuardianStatus {
  supabaseLatency: number | null;
  newellLatency: number | null;
  isOnline: boolean;
  lastCheck: Date | null;
  alertCount: number;
  criticalCount: number;
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  recentAlerts: GuardianAlert[];
  metrics: GuardianMetric[];
}

// ── Module-level state ────────────────────────────────────────────────────
let monitoringInterval: ReturnType<typeof setInterval> | null = null;

let currentStatus: GuardianStatus = {
  supabaseLatency: null,
  newellLatency: null,
  isOnline: true,
  lastCheck: null,
  alertCount: 0,
  criticalCount: 0,
  status: 'unknown',
  recentAlerts: [],
  metrics: [],
};

// ── Internal helpers ──────────────────────────────────────────────────────

async function addAlert(
  alert: Omit<GuardianAlert, 'id' | 'timestamp'>,
): Promise<void> {
  try {
    const newAlert: GuardianAlert = {
      id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...alert,
    };
    const raw = await AsyncStorage.getItem(GUARDIAN_ALERTS_KEY);
    const existing: GuardianAlert[] = raw ? JSON.parse(raw) : [];
    const updated = [newAlert, ...existing].slice(0, MAX_ALERTS);
    await AsyncStorage.setItem(GUARDIAN_ALERTS_KEY, JSON.stringify(updated));
    currentStatus.recentAlerts = updated;
    currentStatus.alertCount   = updated.length;
    currentStatus.criticalCount = updated.filter(
      (a) => a.severity === 'critical',
    ).length;
  } catch {
    // Silent — monitoring must never crash the app
  }
}

async function recordMetric(
  metric: Omit<GuardianMetric, 'timestamp'>,
): Promise<void> {
  try {
    const newMetric: GuardianMetric = {
      timestamp: new Date().toISOString(),
      ...metric,
    };
    const raw = await AsyncStorage.getItem(GUARDIAN_METRICS_KEY);
    const existing: GuardianMetric[] = raw ? JSON.parse(raw) : [];
    const updated = [newMetric, ...existing].slice(0, MAX_METRICS);
    await AsyncStorage.setItem(GUARDIAN_METRICS_KEY, JSON.stringify(updated));
    currentStatus.metrics = updated;
  } catch {
    // Silent
  }
}

async function pingNewellAI(): Promise<number | null> {
  const url = process.env.EXPO_PUBLIC_NEWELL_API_URL;
  if (!url) {
    console.warn('[Guardian] Newell AI ping skipped — EXPO_PUBLIC_NEWELL_API_URL not set');
    return null;
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    return Date.now() - start;
  } catch (err: unknown) {
    const latency = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[Guardian] Newell AI ping failed (${latency}ms): ${errorMsg}`);
    return null;
  }
}

/** Verify local data asset integrity (stations + fare matrices). */
function verifyLocalDataIntegrity(): { ok: boolean; stationCount: number; latencyMs: number } {
  const start = Date.now();
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ALL_STATIONS } = require('@/constants/stations');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MRT3_FARE_MATRIX, LRT1_FARE_MATRIX, LRT2_FARE_MATRIX } = require('@/constants/fares');
    const stationCount = ALL_STATIONS?.length ?? 0;
    const ok = stationCount >= 51 &&
      (MRT3_FARE_MATRIX?.length ?? 0) > 0 &&
      (LRT1_FARE_MATRIX?.length ?? 0) > 0 &&
      (LRT2_FARE_MATRIX?.length ?? 0) > 0;
    return { ok, stationCount, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, stationCount: 0, latencyMs: Date.now() - start };
  }
}

// ── Core health check ─────────────────────────────────────────────────────

async function runHealthCheck(): Promise<void> {
  try {
    const [newellLatency] = await Promise.all([
      pingNewellAI(),
    ]);

    const localCheck = verifyLocalDataIntegrity();
    const rateStats = rateLimiter.getStats();

    // In local-first mode, data engine is always "online" with 0ms latency
    currentStatus.supabaseLatency = localCheck.latencyMs;
    currentStatus.newellLatency   = newellLatency;
    currentStatus.isOnline        = localCheck.ok;
    currentStatus.lastCheck       = new Date();

    // ── Status determination ─────────────────────────────────────────────
    if (!localCheck.ok) {
      currentStatus.status = 'degraded';
      await addAlert({
        severity: 'warning',
        type: 'cache_stale',
        message: `Local data integrity check: ${localCheck.stationCount} stations found (expected 51+)`,
        metadata: { stationCount: localCheck.stationCount },
      });
    } else {
      currentStatus.status = 'healthy';
    }

    // ── Traffic spike detection ──────────────────────────────────────────
    if (rateStats.totalRequests > TRAFFIC_SPIKE_RPM) {
      currentStatus.status = 'degraded';
      await addAlert({
        severity: 'warning',
        type: 'traffic_spike',
        message: `Traffic spike: ${rateStats.totalRequests} req/min (threshold: ${TRAFFIC_SPIKE_RPM})`,
        metadata: { requestsPerMin: rateStats.totalRequests },
      });
    }

    // ── Bot detection passthrough ────────────────────────────────────────
    if (rateStats.isBotDetected) {
      currentStatus.status = 'critical';
      await addAlert({
        severity: 'critical',
        type: 'bot_detected',
        message: 'Suspicious traffic pattern — potential bot/scraper activity',
        metadata: {
          requestsPerMin: rateStats.totalRequests,
          botBlocked: rateStats.isBotDetected,
        },
      });
    }

    // ── Record metric ────────────────────────────────────────────────────
    await recordMetric({
      supabaseLatencyMs: localCheck.latencyMs, // reused field for local data check
      newellLatencyMs:   newellLatency,
      isOnline:          localCheck.ok,
      errorCount:        currentStatus.criticalCount,
      requestsPerMin:    rateStats.totalRequests,
    });
  } catch {
    // Guardian must never crash the app
  }
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Start the Guardian monitoring loop (runs every 60 seconds).
 * Local-first architecture: monitors Newell AI + local data integrity.
 */
export function startGuardian(): void {
  if (monitoringInterval) return; // Already running

  console.log(
    '[Guardian] Starting local-first monitoring system...',
    `\n  Architecture: Local-First / Zero-Failure`,
    `\n  Newell AI URL: ${process.env.EXPO_PUBLIC_NEWELL_API_URL || 'MISSING'}`,
    `\n  Platform: ${typeof window !== 'undefined' ? 'web' : 'native'}`,
  );

  runHealthCheck(); // Immediate first check
  monitoringInterval = setInterval(runHealthCheck, 60_000);
}

/**
 * Stop the Guardian monitoring loop.
 */
export function stopGuardian(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
}

/** Get the current in-memory Guardian status snapshot. */
export function getGuardianStatus(): GuardianStatus {
  return { ...currentStatus };
}

/**
 * Force an immediate health check and return the updated status.
 * Used by the admin Control Center refresh button.
 */
export async function forceHealthCheck(): Promise<GuardianStatus> {
  await runHealthCheck();
  return getGuardianStatus();
}

/** Load all stored Guardian alerts from AsyncStorage. */
export async function loadAlerts(): Promise<GuardianAlert[]> {
  try {
    const raw = await AsyncStorage.getItem(GUARDIAN_ALERTS_KEY);
    const alerts: GuardianAlert[] = raw ? JSON.parse(raw) : [];
    currentStatus.recentAlerts  = alerts;
    currentStatus.alertCount    = alerts.length;
    currentStatus.criticalCount = alerts.filter(
      (a) => a.severity === 'critical',
    ).length;
    return alerts;
  } catch {
    return [];
  }
}

/** Load stored performance metrics from AsyncStorage. */
export async function loadMetrics(): Promise<GuardianMetric[]> {
  try {
    const raw = await AsyncStorage.getItem(GUARDIAN_METRICS_KEY);
    const metrics: GuardianMetric[] = raw ? JSON.parse(raw) : [];
    currentStatus.metrics = metrics;
    return metrics;
  } catch {
    return [];
  }
}

/** Clear all stored alerts (admin action). */
export async function clearAlerts(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GUARDIAN_ALERTS_KEY);
    currentStatus.recentAlerts  = [];
    currentStatus.alertCount    = 0;
    currentStatus.criticalCount = 0;
  } catch {
    // Silent
  }
}

/** Clear all stored metrics (admin action). */
export async function clearMetrics(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GUARDIAN_METRICS_KEY);
    currentStatus.metrics = [];
  } catch {
    // Silent
  }
}

export default {
  startGuardian,
  stopGuardian,
  getGuardianStatus,
  forceHealthCheck,
  loadAlerts,
  loadMetrics,
  clearAlerts,
  clearMetrics,
};
