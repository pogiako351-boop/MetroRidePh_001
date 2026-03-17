/**
 * MetroRide PH — Sentinel AI Security Layer
 * Analyzes request patterns and system logs to detect cyber-attacks,
 * bot scraping, and suspicious non-human behavior.
 *
 * Pattern analysis runs silently without impacting commuter performance.
 * AI-powered threat analysis is triggered on-demand from the Control Center.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getErrorLogs } from './errorLogger';
import { loadAlerts } from './guardian';
import rateLimiter from './rateLimiter';

const SENTINEL_INCIDENTS_KEY = '@metroride_sentinel_incidents';
const MAX_INCIDENTS = 30;

export type ThreatLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface SecurityIncident {
  id: string;
  timestamp: string;
  threatLevel: ThreatLevel;
  type:
    | 'bot_activity'
    | 'rate_abuse'
    | 'anomalous_pattern'
    | 'error_flood'
    | 'suspicious_requests';
  summary: string;
  aiAnalysis?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface PatternAnalysisResult {
  threatLevel: ThreatLevel;
  findings: string[];
  rawData: {
    totalRequests: number;
    recentErrorCount: number;
    criticalAlertCount: number;
    isBotDetected: boolean;
    blockedEndpoints: number;
  };
}

// ── Threat level utilities ────────────────────────────────────────────────

const THREAT_RANK: Record<ThreatLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function maxThreat(a: ThreatLevel, b: ThreatLevel): ThreatLevel {
  return THREAT_RANK[a] >= THREAT_RANK[b] ? a : b;
}

// ── Core pattern analysis (no AI — runs silently in background) ───────────

/**
 * Analyze current system patterns and detect suspicious behavior.
 * This is a pure-data analysis with no AI calls — safe for background use.
 */
export async function analyzePatterns(): Promise<PatternAnalysisResult> {
  const findings: string[] = [];
  let threatLevel: ThreatLevel = 'none';

  // ── Rate limiter analysis ────────────────────────────────────────────
  const rateStats = rateLimiter.getStats();

  if (rateStats.isBotDetected) {
    findings.push(
      `Bot traffic detected — ${rateStats.totalRequests} req/min across ${rateStats.endpoints.length} endpoints`,
    );
    threatLevel = maxThreat(threatLevel, 'critical');
  } else if (rateStats.totalRequests > 25) {
    findings.push(
      `Elevated request volume: ${rateStats.totalRequests} req/min (threshold: 25)`,
    );
    threatLevel = maxThreat(threatLevel, 'medium');
  }

  const blockedEndpoints = rateStats.endpoints.filter((e) => e.blocked).length;
  if (blockedEndpoints > 0) {
    findings.push(
      `${blockedEndpoints} endpoint(s) currently rate-limited`,
    );
    threatLevel = maxThreat(threatLevel, 'low');
  }

  // ── Error log analysis ───────────────────────────────────────────────
  const allErrors = await getErrorLogs();
  const tenMinutesAgo = Date.now() - 10 * 60_000;
  const recentErrors = allErrors.filter(
    (e) => new Date(e.timestamp).getTime() > tenMinutesAgo,
  );

  if (recentErrors.length > 20) {
    findings.push(
      `Error flood: ${recentErrors.length} errors in last 10 minutes`,
    );
    threatLevel = maxThreat(threatLevel, 'high');
  } else if (recentErrors.length > 10) {
    findings.push(
      `Elevated error rate: ${recentErrors.length} errors in last 10 minutes`,
    );
    threatLevel = maxThreat(threatLevel, 'medium');
  } else if (recentErrors.length > 5) {
    findings.push(
      `Moderate error activity: ${recentErrors.length} errors in last 10 minutes`,
    );
    threatLevel = maxThreat(threatLevel, 'low');
  }

  // ── Guardian alert correlation ───────────────────────────────────────
  const guardianAlerts = await loadAlerts();
  const criticalAlerts = guardianAlerts.filter(
    (a) => a.severity === 'critical',
  );
  const recentCritical = criticalAlerts.filter(
    (a) => new Date(a.timestamp).getTime() > tenMinutesAgo,
  );

  if (recentCritical.length >= 3) {
    findings.push(
      `Multiple critical system alerts in last 10 minutes: ${recentCritical.length}`,
    );
    threatLevel = maxThreat(threatLevel, 'high');
  } else if (criticalAlerts.length > 5) {
    findings.push(`${criticalAlerts.length} critical alerts in log history`);
    threatLevel = maxThreat(threatLevel, 'medium');
  }

  // ── Bot detection state ──────────────────────────────────────────────
  const botState = rateLimiter.getBotDetectionState();
  if (botState.isBlocked) {
    findings.push(
      `Active bot block in effect — block expires in ${Math.round(
        ((botState.blockedUntil ?? 0) - Date.now()) / 60000,
      )}min`,
    );
    threatLevel = maxThreat(threatLevel, 'critical');
  }

  if (findings.length === 0) {
    findings.push('No suspicious patterns detected — system nominal');
  }

  return {
    threatLevel,
    findings,
    rawData: {
      totalRequests:     rateStats.totalRequests,
      recentErrorCount:  recentErrors.length,
      criticalAlertCount: criticalAlerts.length,
      isBotDetected:     rateStats.isBotDetected,
      blockedEndpoints,
    },
  };
}

// ── AI security analysis prompt builder ──────────────────────────────────

/** System prompt for Newell AI when performing security analysis */
export const SENTINEL_SYSTEM_PROMPT =
  'You are MetroRide Sentinel — an AI security analyst for MetroRide PH, a ' +
  'Philippine metro transit PWA serving millions of commuters. Your role is to ' +
  'analyze system telemetry and detect security threats, bot activity, API abuse, ' +
  'or anomalous traffic patterns. Always respond with: 1) a one-line threat assessment, ' +
  '2) a specific threat level label (none/low/medium/high/critical), and ' +
  '3) one or two concrete recommendations. Be concise and actionable.';

/**
 * Build a natural-language prompt for Newell AI security analysis.
 * Pass the PatternAnalysisResult to generate a structured prompt.
 */
export function buildSecurityAnalysisPrompt(data: PatternAnalysisResult): string {
  const { threatLevel, findings, rawData } = data;

  return [
    'Analyze the following MetroRide PH security telemetry and provide a threat assessment:',
    '',
    `Current threat level (pre-AI): ${threatLevel.toUpperCase()}`,
    `Requests per minute: ${rawData.totalRequests}`,
    `Recent errors (10min): ${rawData.recentErrorCount}`,
    `Critical system alerts: ${rawData.criticalAlertCount}`,
    `Bot detection triggered: ${rawData.isBotDetected}`,
    `Blocked endpoints: ${rawData.blockedEndpoints}`,
    '',
    'Detected patterns:',
    ...findings.map((f) => `• ${f}`),
    '',
    'Provide: 1) Brief threat assessment (1-2 sentences), 2) Confirmed threat level, 3) Top recommendation.',
  ].join('\n');
}

// ── Incident storage ──────────────────────────────────────────────────────

/** Log a security incident to AsyncStorage. */
export async function logIncident(
  incident: Omit<SecurityIncident, 'id' | 'timestamp'>,
): Promise<void> {
  try {
    const newIncident: SecurityIncident = {
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...incident,
    };
    const raw = await AsyncStorage.getItem(SENTINEL_INCIDENTS_KEY);
    const existing: SecurityIncident[] = raw ? JSON.parse(raw) : [];
    const updated = [newIncident, ...existing].slice(0, MAX_INCIDENTS);
    await AsyncStorage.setItem(SENTINEL_INCIDENTS_KEY, JSON.stringify(updated));
  } catch {
    // Silent — security logging must never crash the app
  }
}

/** Load all stored security incidents from AsyncStorage. */
export async function loadIncidents(): Promise<SecurityIncident[]> {
  try {
    const raw = await AsyncStorage.getItem(SENTINEL_INCIDENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Clear all stored security incidents (admin action). */
export async function clearIncidents(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SENTINEL_INCIDENTS_KEY);
  } catch {
    // Silent
  }
}

/** Return a color code for a threat level. */
export function getThreatColor(level: ThreatLevel): string {
  switch (level) {
    case 'critical': return '#FF4444';
    case 'high':     return '#FF8C00';
    case 'medium':   return '#FFB800';
    case 'low':      return '#40E0FF';
    default:         return '#22C55E';
  }
}

export default {
  analyzePatterns,
  buildSecurityAnalysisPrompt,
  logIncident,
  loadIncidents,
  clearIncidents,
  getThreatColor,
  SENTINEL_SYSTEM_PROMPT,
};
