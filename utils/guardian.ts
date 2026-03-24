/**
 * MetroRide PH — Guardian Monitoring System
 * Background module tracking API latency, database reachability,
 * and traffic spikes. Generates internal alerts for system degradation.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import rateLimiter from './rateLimiter';
import { supabaseUrl, supabaseAnonKey } from './supabase';

const GUARDIAN_ALERTS_KEY  = '@metroride_guardian_alerts';
const GUARDIAN_METRICS_KEY = '@metroride_guardian_metrics';
const MAX_ALERTS  = 50;
const MAX_METRICS = 120; // 2 hours of per-minute samples

const LATENCY_WARN_MS     = 1500;
const LATENCY_CRITICAL_MS = 3000;
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
  | 'service_restored';

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

// Track last reported state to avoid duplicate alerts
let lastHealthyState = true;

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

async function pingSupabase(): Promise<number | null> {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      '[Guardian] Supabase ping skipped — missing credentials.',
      `URL: ${supabaseUrl ? 'SET' : 'MISSING'}`,
      `Key: ${supabaseAnonKey ? supabaseAnonKey.slice(0, 12) + '...' : 'MISSING'}`,
    );
    return null;
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${supabaseUrl}/rest/v1/stations?select=id&limit=1`, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    const latency = Date.now() - start;

    if (!res.ok) {
      console.error(
        `[Guardian] Supabase ping failed — HTTP ${res.status} ${res.statusText} (${latency}ms)`,
        `URL: ${supabaseUrl}/rest/v1/stations`,
        res.status === 401 ? `Key prefix: ${supabaseAnonKey.slice(0, 12)}...` : '',
      );
      // Still return latency for non-ok but reachable responses (not truly offline)
      return null;
    }

    if (latency > 2000) {
      console.warn(`[Guardian] Supabase slow response: ${latency}ms`);
    }
    return latency;
  } catch (err: unknown) {
    const latency = Date.now() - start;
    const errorName = err instanceof Error ? err.name : 'Unknown';
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Classify the error for browser console diagnosis
    if (errorName === 'AbortError') {
      console.error(`[Guardian] Supabase ping TIMEOUT after ${latency}ms — network too slow or endpoint blocked`);
    } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
      console.error(
        `[Guardian] Supabase ping NETWORK ERROR (${latency}ms) — possible CORS block, DNS failure, or no internet.`,
        `Target: ${supabaseUrl}`,
        `Error: ${errorMsg}`,
      );
    } else if (errorMsg.includes('CORS') || errorMsg.includes('cross-origin')) {
      console.error(
        `[Guardian] Supabase ping CORS ERROR (${latency}ms) — check Supabase project CORS/allowed-origins config.`,
        `Origin: ${typeof window !== 'undefined' ? window.location.origin : 'unknown'}`,
      );
    } else {
      console.error(`[Guardian] Supabase ping error: ${errorName} — ${errorMsg} (${latency}ms)`);
    }
    return null;
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

// ── Core health check ─────────────────────────────────────────────────────

async function runHealthCheck(): Promise<void> {
  try {
    const [supabaseLatency, newellLatency] = await Promise.all([
      pingSupabase(),
      pingNewellAI(),
    ]);

    const wasOnline  = lastHealthyState;
    const isOnline   = supabaseLatency !== null;
    const rateStats  = rateLimiter.getStats();

    currentStatus.supabaseLatency = supabaseLatency;
    currentStatus.newellLatency   = newellLatency;
    currentStatus.isOnline        = isOnline;
    currentStatus.lastCheck       = new Date();

    // ── Status determination ─────────────────────────────────────────────
    if (!isOnline) {
      currentStatus.status = 'critical';
      if (wasOnline) {
        await addAlert({
          severity: 'critical',
          type: 'offline_detected',
          message: 'Database unreachable — offline mode activated',
          metadata: { timestamp: Date.now() },
        });
        // Persist offline flag so other modules can react
        await AsyncStorage.setItem('@metroride_offline_mode', 'true');
      }
      lastHealthyState = false;
    } else {
      // Clear offline flag when connectivity restored
      await AsyncStorage.removeItem('@metroride_offline_mode');

      if (!wasOnline) {
        await addAlert({
          severity: 'info',
          type: 'service_restored',
          message: `Database connectivity restored (${supabaseLatency}ms)`,
        });
      }

      if (supabaseLatency > LATENCY_CRITICAL_MS) {
        currentStatus.status = 'critical';
        await addAlert({
          severity: 'critical',
          type: 'high_latency',
          message: `Critical latency: Supabase ${supabaseLatency}ms (threshold: ${LATENCY_CRITICAL_MS}ms)`,
          metadata: { latencyMs: supabaseLatency },
        });
      } else if (supabaseLatency > LATENCY_WARN_MS) {
        currentStatus.status = 'degraded';
        await addAlert({
          severity: 'warning',
          type: 'high_latency',
          message: `High latency: Supabase ${supabaseLatency}ms (threshold: ${LATENCY_WARN_MS}ms)`,
          metadata: { latencyMs: supabaseLatency },
        });
      } else {
        currentStatus.status = 'healthy';
      }
      lastHealthyState = true;
    }

    // ── Traffic spike detection ──────────────────────────────────────────
    if (rateStats.totalRequests > TRAFFIC_SPIKE_RPM) {
      if (currentStatus.status !== 'critical') {
        currentStatus.status = 'degraded';
      }
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
      supabaseLatencyMs: supabaseLatency,
      newellLatencyMs:   newellLatency,
      isOnline,
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
 * Call once from the root app layout or a global provider.
 */
export function startGuardian(): void {
  if (monitoringInterval) return; // Already running

  // Log startup diagnostics to browser console for live-site debugging
  console.log(
    '[Guardian] Starting monitoring system...',
    `\n  Supabase URL: ${supabaseUrl ? supabaseUrl : 'MISSING'}`,
    `\n  Supabase Key: ${supabaseAnonKey ? supabaseAnonKey.slice(0, 16) + '...' : 'MISSING'}`,
    `\n  Newell AI URL: ${process.env.EXPO_PUBLIC_NEWELL_API_URL || 'MISSING'}`,
    `\n  Platform: ${typeof window !== 'undefined' ? 'web' : 'native'}`,
    `\n  Origin: ${typeof window !== 'undefined' ? window.location.origin : 'N/A'}`,
  );

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      '[Guardian] CRITICAL: Supabase credentials not available at runtime!',
      'This means EXPO_PUBLIC_SUPABASE_URL and/or EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'were not inlined during the build. The production web bundle may be stale.',
    );
  }

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
