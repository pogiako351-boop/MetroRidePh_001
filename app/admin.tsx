/**
 * MetroRide PH — Control Center
 * Protected administrative dashboard with Neon Onyx aesthetic.
 * System Health · Traffic Monitor · Alert Center · Sentinel AI · Service Worker
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  TextInput,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTextGeneration } from '@fastshot/ai';

import {
  forceHealthCheck,
  loadAlerts,
  loadMetrics,
  clearAlerts,
  GuardianAlert,
  GuardianMetric,
  GuardianStatus,
  getGuardianStatus,
} from '@/utils/guardian';
import {
  analyzePatterns,
  loadIncidents,
  clearIncidents,
  logIncident,
  buildSecurityAnalysisPrompt,
  SENTINEL_SYSTEM_PROMPT,
  SecurityIncident,
  getThreatColor,
  PatternAnalysisResult,
} from '@/utils/sentinel';
import { runConnectivityDiagnostic, FullDiagnosticReport } from '@/utils/connectivityDiagnostic';
import { rateLimiter } from '@/utils/rateLimiter';

// ── Auth ──────────────────────────────────────────────────────────────────
const ADMIN_SESSION_KEY     = '@metroride_admin_session';
const SESSION_DURATION_MS   = 30 * 60_000; // 30 minutes
const CORRECT_PIN           = '2026'; // MetroRide 2026 admin PIN

// ── Helpers ───────────────────────────────────────────────────────────────

function severityColor(s: string): string {
  if (s === 'critical') return '#FF4444';
  if (s === 'warning')  return '#FFB800';
  return '#40E0FF';
}

function alertTypeIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'high_latency':         return 'speedometer';
    case 'db_unreachable':       return 'server';
    case 'traffic_spike':        return 'trending-up';
    case 'bot_detected':         return 'bug';
    case 'rate_limit_exceeded':  return 'ban';
    case 'offline_detected':     return 'cloud-offline';
    case 'service_restored':     return 'checkmark-circle';
    default:                     return 'alert-circle';
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)     return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600_000)   return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000)  return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

// ── PIN Screen ────────────────────────────────────────────────────────────

function PinScreen({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin]     = useState('');
  const [error, setError] = useState('');

  const handleSubmit = useCallback(() => {
    if (pin === CORRECT_PIN) {
      AsyncStorage.setItem(
        ADMIN_SESSION_KEY,
        JSON.stringify({ ts: Date.now() }),
      ).catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
    } else {
      setError('Incorrect PIN. Try again.');
      setPin('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [pin, onSuccess]);

  return (
    <View style={pinStyles.root}>
      <LinearGradient colors={['#0D1B3E', '#08090A']} style={pinStyles.bg} />
      <View style={pinStyles.card}>
        <View style={pinStyles.iconBg}>
          <Ionicons name="shield-checkmark" size={40} color="#40E0FF" />
        </View>
        <Text style={pinStyles.title}>Control Center</Text>
        <Text style={pinStyles.sub}>Enter admin PIN to continue</Text>

        <TextInput
          style={pinStyles.input}
          value={pin}
          onChangeText={(t) => { setPin(t); setError(''); }}
          placeholder="••••"
          placeholderTextColor="rgba(255,255,255,0.2)"
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          autoFocus
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />

        {!!error && (
          <Text style={pinStyles.error}>{error}</Text>
        )}

        <TouchableOpacity style={pinStyles.btn} onPress={handleSubmit} activeOpacity={0.85}>
          <Text style={pinStyles.btnText}>Authenticate</Text>
        </TouchableOpacity>

        <Text style={pinStyles.hint}>
          Default PIN: 2026
        </Text>
      </View>
    </View>
  );
}

const pinStyles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  bg:   { ...StyleSheet.absoluteFillObject },
  card: {
    width: '100%', maxWidth: 340,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(64,224,255,0.25)',
    borderRadius: 24, padding: 32, alignItems: 'center',
  },
  iconBg: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(64,224,255,0.1)',
    borderWidth: 1.5, borderColor: 'rgba(64,224,255,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
  sub:   { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 24 },
  input: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(64,224,255,0.3)',
    borderRadius: 14, padding: 16, textAlign: 'center',
    fontSize: 24, color: '#fff', letterSpacing: 8, marginBottom: 12,
  },
  error:   { fontSize: 13, color: '#FF4444', marginBottom: 12 },
  btn: {
    width: '100%', backgroundColor: '#40E0FF',
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 16,
  },
  btnText: { fontSize: 16, fontWeight: '800', color: '#0A0F1E' },
  hint:    { fontSize: 11, color: 'rgba(255,255,255,0.25)' },
});

// ── Metric Bar ────────────────────────────────────────────────────────────

function MetricBar({
  label, value, max, unit, color,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  color: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <View style={metricStyles.row}>
      <Text style={metricStyles.label}>{label}</Text>
      <View style={metricStyles.track}>
        <View style={[metricStyles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[metricStyles.value, { color }]}>
        {value}{unit}
      </Text>
    </View>
  );
}

const metricStyles = StyleSheet.create({
  row:   { marginBottom: 12 },
  label: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 5 },
  track: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3, overflow: 'hidden', marginBottom: 4,
  },
  fill:  { height: '100%', borderRadius: 3 },
  value: { fontSize: 12, fontWeight: '700' },
});

// ── Main Dashboard ────────────────────────────────────────────────────────

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  // Data state
  const [guardianStatus, setGuardianStatus]   = useState<GuardianStatus | null>(null);
  const [diagnosticReport, setDiagnosticReport] = useState<FullDiagnosticReport | null>(null);
  const [alerts, setAlerts]                   = useState<GuardianAlert[]>([]);
  const [metrics, setMetrics]                 = useState<GuardianMetric[]>([]);
  const [incidents, setIncidents]             = useState<SecurityIncident[]>([]);
  const [patternResult, setPatternResult]     = useState<PatternAnalysisResult | null>(null);
  const [rateStats, setRateStats]             = useState(rateLimiter.getStats());

  // Service Worker state
  const [swVersion, setSwVersion]  = useState<string>('—');
  const [cacheStats, setCacheStats] = useState<Record<string, { entries: number }>>({});

  // UI state
  const [refreshing, setRefreshing]       = useState(false);
  const [runningHealth, setRunningHealth] = useState(false);
  const [runningAI, setRunningAI]         = useState(false);
  const [aiAnalysis, setAiAnalysis]       = useState('');
  const [activeTab, setActiveTab]         = useState<'health' | 'traffic' | 'alerts' | 'sentinel' | 'sw'>('health');

  // AI hook
  const { generateText, isLoading: aiLoading } = useTextGeneration();

  // ── Session check ──────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(ADMIN_SESSION_KEY)
      .then((raw) => {
        if (!raw) { setAuthenticated(false); return; }
        const { ts } = JSON.parse(raw);
        if (Date.now() - ts < SESSION_DURATION_MS) {
          setAuthenticated(true);
        } else {
          setAuthenticated(false);
        }
      })
      .catch(() => setAuthenticated(false));
  }, []);

  // ── Load data once authenticated ───────────────────────────────────────
  const loadAllData = useCallback(async () => {
    try {
      const [a, m, inc, pattern] = await Promise.all([
        loadAlerts(),
        loadMetrics(),
        loadIncidents(),
        analyzePatterns(),
      ]);

      setAlerts(a);
      setMetrics(m);
      setIncidents(inc);
      setPatternResult(pattern);
      setGuardianStatus(getGuardianStatus());
      setRateStats(rateLimiter.getStats());

      // Service Worker
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration('/');
          const worker = reg?.active || reg?.installing || reg?.waiting;
          if (worker) {
            const channel = new MessageChannel();
            const versionP = new Promise<string>((res) => {
              channel.port1.onmessage = (e) => res(e.data?.version ?? 'unknown');
              setTimeout(() => res('unknown'), 1200);
            });
            worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
            setSwVersion(await versionP);

            const statsChannel = new MessageChannel();
            const statsP = new Promise<Record<string, { entries: number }>>((res) => {
              statsChannel.port1.onmessage = (e) => res(e.data?.stats ?? {});
              setTimeout(() => res({}), 1200);
            });
            worker.postMessage({ type: 'GET_CACHE_STATS' }, [statsChannel.port2]);
            setCacheStats(await statsP);
          }
        } catch {
          // SW not available
        }
      }
    } catch {
      // Silent
    }
  }, []);

  useEffect(() => {
    if (authenticated) {
      loadAllData();
    }
  }, [authenticated, loadAllData]);

  // aiData is no longer used directly — response is handled in handleRunSentinelAI

  // ── Actions ────────────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  }, [loadAllData]);

  const handleForceHealthCheck = useCallback(async () => {
    setRunningHealth(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const [gStatus, diagReport] = await Promise.all([
        forceHealthCheck(),
        runConnectivityDiagnostic(),
      ]);
      setGuardianStatus(gStatus);
      setDiagnosticReport(diagReport);
      const refreshedAlerts = await loadAlerts();
      setAlerts(refreshedAlerts);
    } finally {
      setRunningHealth(false);
    }
  }, []);

  const handleRunSentinelAI = useCallback(async () => {
    if (!patternResult || runningAI || aiLoading) return;
    setRunningAI(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const analysisPrompt = buildSecurityAnalysisPrompt(patternResult);
      // Combine system + analysis into a single string (mirrors metro-ai.tsx pattern)
      const fullPrompt = `${SENTINEL_SYSTEM_PROMPT}\n\n${analysisPrompt}\n\nSentinel AI:`;
      const response = await generateText(fullPrompt);
      if (response) {
        setAiAnalysis(response);
        logIncident({
          threatLevel: patternResult.threatLevel,
          type: 'anomalous_pattern',
          summary: `AI analysis: ${patternResult.threatLevel.toUpperCase()} threat`,
          aiAnalysis: response,
          metadata: { timestamp: Date.now() },
        }).catch(() => {});
      }
    } finally {
      setRunningAI(false);
    }
  }, [patternResult, runningAI, aiLoading, generateText]);

  const handleClearAlerts = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await clearAlerts();
    setAlerts([]);
  }, []);

  const handleClearIncidents = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await clearIncidents();
    setIncidents([]);
    setAiAnalysis('');
  }, []);

  // ── Render gates ───────────────────────────────────────────────────────

  if (authenticated === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#08090A', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#40E0FF" />
      </View>
    );
  }

  if (!authenticated) {
    return <PinScreen onSuccess={() => setAuthenticated(true)} />;
  }

  // ── Status summary ─────────────────────────────────────────────────────
  const systemStatus = guardianStatus?.status ?? 'unknown';
  const statusColor =
    systemStatus === 'healthy'  ? '#22C55E' :
    systemStatus === 'degraded' ? '#FFB800' :
    systemStatus === 'critical' ? '#FF4444' : '#40E0FF';

  const diagStatus    = diagnosticReport?.overallStatus;
  const recentMetrics = metrics.slice(0, 5).reverse();
  const latestMetric  = metrics[0];
  const totalRequests = latestMetric?.requestsPerMin ?? 0;
  const avgLatency    = latestMetric?.supabaseLatencyMs ?? 0;

  const TABS: { id: typeof activeTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'health',   label: 'Health',   icon: 'pulse' },
    { id: 'traffic',  label: 'Traffic',  icon: 'bar-chart' },
    { id: 'alerts',   label: 'Alerts',   icon: 'notifications' },
    { id: 'sentinel', label: 'Sentinel', icon: 'eye' },
    { id: 'sw',       label: 'SW',       icon: 'layers' },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <LinearGradient
        colors={['#000000', '#0A0F1E']}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => { Haptics.selectionAsync(); router.back(); }}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>⚡ Control Center</Text>
          <Text style={styles.headerSub}>MetroRide PH · Admin</Text>
        </View>

        <TouchableOpacity
          style={[styles.headerBtn, runningHealth && styles.headerBtnActive]}
          onPress={handleForceHealthCheck}
          disabled={runningHealth}
        >
          {runningHealth
            ? <ActivityIndicator size="small" color="#40E0FF" />
            : <Ionicons name="refresh" size={20} color="#40E0FF" />
          }
        </TouchableOpacity>
      </LinearGradient>

      {/* Status bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusDot}>
          <View style={[styles.statusDotInner, { backgroundColor: statusColor }]} />
        </View>
        <Text style={[styles.statusText, { color: statusColor }]}>
          {systemStatus.toUpperCase()}
        </Text>
        {guardianStatus?.lastCheck && (
          <Text style={styles.statusTime}>
            · checked {timeAgo(guardianStatus.lastCheck.toISOString())}
          </Text>
        )}
        <View style={{ flex: 1 }} />
        <Text style={styles.alertCount}>
          {alerts.length} alerts
        </Text>
      </View>

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => { setActiveTab(tab.id); Haptics.selectionAsync(); }}
          >
            <Ionicons
              name={tab.icon}
              size={15}
              color={activeTab === tab.id ? '#40E0FF' : 'rgba(255,255,255,0.4)'}
            />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#40E0FF"
          />
        }
      >

        {/* ── HEALTH TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'health' && (
          <>
            <SectionHeader title="System Health Panel" icon="shield-checkmark" />

            {/* Guardian status cards */}
            <View style={styles.metricRow}>
              <MetricTile
                label="Supabase"
                value={guardianStatus?.supabaseLatency !== null && guardianStatus?.supabaseLatency !== undefined
                  ? `${guardianStatus.supabaseLatency}ms`
                  : '—'}
                sub="Database latency"
                color={
                  (guardianStatus?.supabaseLatency ?? 0) > 1500 ? '#FF4444' :
                  (guardianStatus?.supabaseLatency ?? 0) > 800  ? '#FFB800' : '#22C55E'
                }
                icon="server"
              />
              <MetricTile
                label="Newell AI"
                value={guardianStatus?.newellLatency !== null && guardianStatus?.newellLatency !== undefined
                  ? `${guardianStatus.newellLatency}ms`
                  : '—'}
                sub="AI service latency"
                color={
                  (guardianStatus?.newellLatency ?? 0) > 2000 ? '#FFB800' : '#22C55E'
                }
                icon="sparkles"
              />
            </View>

            <View style={styles.metricRow}>
              <MetricTile
                label="Alerts"
                value={String(alerts.length)}
                sub="Total logged"
                color={alerts.filter(a => a.severity === 'critical').length > 0 ? '#FF4444' : '#40E0FF'}
                icon="notifications"
              />
              <MetricTile
                label="Online"
                value={guardianStatus?.isOnline ? 'YES' : 'NO'}
                sub="Database reach"
                color={guardianStatus?.isOnline ? '#22C55E' : '#FF4444'}
                icon="globe"
              />
            </View>

            {/* Pulse diagnostic */}
            {diagStatus && (
              <View style={[styles.diagCard, {
                borderColor:
                  diagStatus === 'healthy'  ? 'rgba(34,197,94,0.3)' :
                  diagStatus === 'degraded' ? 'rgba(255,184,0,0.3)' : 'rgba(255,68,68,0.3)',
                backgroundColor:
                  diagStatus === 'healthy'  ? 'rgba(34,197,94,0.07)' :
                  diagStatus === 'degraded' ? 'rgba(255,184,0,0.07)' : 'rgba(255,68,68,0.07)',
              }]}>
                <Ionicons
                  name={diagStatus === 'healthy' ? 'shield-checkmark' : 'warning'}
                  size={20}
                  color={diagStatus === 'healthy' ? '#22C55E' : diagStatus === 'degraded' ? '#FFB800' : '#FF4444'}
                />
                <View>
                  <Text style={styles.diagTitle}>Pulse Report</Text>
                  <Text style={[styles.diagStatus, {
                    color: diagStatus === 'healthy' ? '#22C55E' : diagStatus === 'degraded' ? '#FFB800' : '#FF4444',
                  }]}>
                    {diagStatus.toUpperCase()} · {diagnosticReport?.results.filter(r => r.status === 'pass').length}/{diagnosticReport?.results.length} checks passed
                    {diagnosticReport?.offlineModeTriggered ? ' · OFFLINE MODE' : ''}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, runningHealth && styles.actionBtnDisabled]}
              onPress={handleForceHealthCheck}
              disabled={runningHealth}
            >
              {runningHealth
                ? <ActivityIndicator size="small" color="#0A0F1E" />
                : <Ionicons name="refresh-circle" size={18} color="#0A0F1E" />
              }
              <Text style={styles.actionBtnText}>
                {runningHealth ? 'Running health check…' : 'Force Health Check'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── TRAFFIC TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'traffic' && (
          <>
            <SectionHeader title="Traffic & API Monitor" icon="bar-chart" />

            <View style={styles.card}>
              <Text style={styles.cardTitle}>API Response Times</Text>
              {recentMetrics.length > 0 ? (
                <>
                  <MetricBar
                    label="Supabase Latency"
                    value={avgLatency}
                    max={3000}
                    unit="ms"
                    color={avgLatency > 1500 ? '#FF4444' : avgLatency > 800 ? '#FFB800' : '#22C55E'}
                  />
                  <MetricBar
                    label="Requests/min"
                    value={totalRequests}
                    max={30}
                    unit=" rpm"
                    color={totalRequests > 25 ? '#FF4444' : totalRequests > 15 ? '#FFB800' : '#40E0FF'}
                  />
                  <MetricBar
                    label="Error Count"
                    value={latestMetric?.errorCount ?? 0}
                    max={10}
                    unit=" errors"
                    color={
                      (latestMetric?.errorCount ?? 0) > 5 ? '#FF4444' :
                      (latestMetric?.errorCount ?? 0) > 2 ? '#FFB800' : '#22C55E'
                    }
                  />
                </>
              ) : (
                <Text style={styles.emptyText}>No metrics collected yet — run a health check first</Text>
              )}
            </View>

            {/* Latency history */}
            {recentMetrics.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Latency History (last {recentMetrics.length} checks)</Text>
                <View style={styles.latencyChart}>
                  {recentMetrics.map((m, i) => {
                    const h = Math.min(100, Math.round(((m.supabaseLatencyMs ?? 0) / 3000) * 100));
                    const c = (m.supabaseLatencyMs ?? 0) > 1500 ? '#FF4444' : (m.supabaseLatencyMs ?? 0) > 800 ? '#FFB800' : '#22C55E';
                    return (
                      <View key={i} style={styles.latencyBarWrap}>
                        <View style={[styles.latencyBar, { height: `${Math.max(4, h)}%`, backgroundColor: c }]} />
                        <Text style={styles.latencyBarLabel}>
                          {m.supabaseLatencyMs != null ? `${m.supabaseLatencyMs}` : '—'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Rate limiter stats */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Rate Limiter</Text>
              <View style={styles.rateRow}>
                <View style={styles.ratePill}>
                  <Text style={styles.ratePillValue}>{rateStats.totalRequests}</Text>
                  <Text style={styles.ratePillLabel}>req/min</Text>
                </View>
                <View style={styles.ratePill}>
                  <Text style={[styles.ratePillValue, rateStats.isBotDetected && { color: '#FF4444' }]}>
                    {rateStats.isBotDetected ? 'YES' : 'NO'}
                  </Text>
                  <Text style={styles.ratePillLabel}>bot detected</Text>
                </View>
                <View style={styles.ratePill}>
                  <Text style={styles.ratePillValue}>
                    {rateStats.endpoints.filter(e => e.blocked).length}
                  </Text>
                  <Text style={styles.ratePillLabel}>blocked</Text>
                </View>
              </View>
              {rateStats.endpoints.length > 0 && (
                <View style={styles.endpointList}>
                  {rateStats.endpoints.slice(0, 5).map((ep, i) => (
                    <View key={i} style={styles.endpointRow}>
                      <Text style={styles.endpointName} numberOfLines={1}>{ep.name}</Text>
                      <Text style={[styles.endpointRate, ep.blocked && { color: '#FF4444' }]}>
                        {ep.requestsPerMin}/{ep.limit}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {/* ── ALERTS TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'alerts' && (
          <>
            <View style={styles.sectionHeaderRow}>
              <SectionHeader title="Alert Center" icon="notifications" />
              {alerts.length > 0 && (
                <TouchableOpacity onPress={handleClearAlerts} style={styles.clearBtn}>
                  <Text style={styles.clearBtnText}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>

            {alerts.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="checkmark-circle" size={36} color="#22C55E" />
                <Text style={styles.emptyTitle}>No Alerts</Text>
                <Text style={styles.emptyText}>System nominal — Guardian monitoring active</Text>
              </View>
            ) : (
              alerts.map((alert) => (
                <View
                  key={alert.id}
                  style={[styles.alertCard, { borderLeftColor: severityColor(alert.severity) }]}
                >
                  <View style={styles.alertHeader}>
                    <Ionicons
                      name={alertTypeIcon(alert.type)}
                      size={16}
                      color={severityColor(alert.severity)}
                    />
                    <View style={[styles.alertBadge, { backgroundColor: `${severityColor(alert.severity)}18` }]}>
                      <Text style={[styles.alertBadgeText, { color: severityColor(alert.severity) }]}>
                        {alert.severity.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.alertTime}>{timeAgo(alert.timestamp)}</Text>
                  </View>
                  <Text style={styles.alertMsg}>{alert.message}</Text>
                  {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                    <Text style={styles.alertMeta}>
                      {Object.entries(alert.metadata)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')}
                    </Text>
                  )}
                </View>
              ))
            )}
          </>
        )}

        {/* ── SENTINEL TAB ────────────────────────────────────────────────── */}
        {activeTab === 'sentinel' && (
          <>
            <SectionHeader title="Sentinel AI Security" icon="eye" />

            {/* Threat level display */}
            {patternResult && (
              <View style={[styles.threatCard, {
                borderColor: `${getThreatColor(patternResult.threatLevel)}40`,
                backgroundColor: `${getThreatColor(patternResult.threatLevel)}08`,
              }]}>
                <View style={styles.threatHeader}>
                  <Ionicons name="shield-half" size={24} color={getThreatColor(patternResult.threatLevel)} />
                  <Text style={[styles.threatLevel, { color: getThreatColor(patternResult.threatLevel) }]}>
                    {patternResult.threatLevel.toUpperCase()} THREAT
                  </Text>
                </View>
                <View style={styles.findingsList}>
                  {patternResult.findings.map((f, i) => (
                    <View key={i} style={styles.findingRow}>
                      <View style={[styles.findingDot, { backgroundColor: getThreatColor(patternResult.threatLevel) }]} />
                      <Text style={styles.findingText}>{f}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* AI Analysis button */}
            <TouchableOpacity
              style={[
                styles.sentinelBtn,
                (runningAI || aiLoading) && styles.sentinelBtnDisabled,
              ]}
              onPress={handleRunSentinelAI}
              disabled={runningAI || aiLoading}
            >
              {runningAI || aiLoading ? (
                <>
                  <ActivityIndicator size="small" color="#0A0F1E" />
                  <Text style={styles.sentinelBtnText}>Analyzing with Sentinel AI…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color="#0A0F1E" />
                  <Text style={styles.sentinelBtnText}>Run Sentinel AI Analysis</Text>
                </>
              )}
            </TouchableOpacity>

            {/* AI analysis result */}
            {!!aiAnalysis && (
              <View style={styles.aiResultCard}>
                <View style={styles.aiResultHeader}>
                  <Ionicons name="sparkles" size={16} color="#40E0FF" />
                  <Text style={styles.aiResultTitle}>Sentinel AI Report</Text>
                </View>
                <Text style={styles.aiResultText}>{aiAnalysis}</Text>
              </View>
            )}

            {/* Security incidents */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.subSectionTitle}>Security Incidents</Text>
              {incidents.length > 0 && (
                <TouchableOpacity onPress={handleClearIncidents} style={styles.clearBtn}>
                  <Text style={styles.clearBtnText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            {incidents.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="lock-closed" size={32} color="#22C55E" />
                <Text style={styles.emptyTitle}>No Incidents</Text>
                <Text style={styles.emptyText}>No security incidents logged</Text>
              </View>
            ) : (
              incidents.map((inc) => (
                <View
                  key={inc.id}
                  style={[styles.incidentCard, { borderLeftColor: getThreatColor(inc.threatLevel) }]}
                >
                  <View style={styles.incidentHeader}>
                    <View style={[styles.incidentBadge, { backgroundColor: `${getThreatColor(inc.threatLevel)}20` }]}>
                      <Text style={[styles.incidentBadgeText, { color: getThreatColor(inc.threatLevel) }]}>
                        {inc.threatLevel.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.incidentTime}>{timeAgo(inc.timestamp)}</Text>
                  </View>
                  <Text style={styles.incidentSummary}>{inc.summary}</Text>
                  {inc.aiAnalysis && (
                    <Text style={styles.incidentAI} numberOfLines={3}>
                      AI: {inc.aiAnalysis}
                    </Text>
                  )}
                </View>
              ))
            )}
          </>
        )}

        {/* ── SERVICE WORKER TAB ──────────────────────────────────────────── */}
        {activeTab === 'sw' && (
          <>
            <SectionHeader title="Service Worker Status" icon="layers" />

            <View style={styles.swCard}>
              <View style={styles.swHeaderRow}>
                <View style={[styles.swStatusDot, {
                  backgroundColor: swVersion !== '—' ? '#22C55E' : '#FFB800',
                }]} />
                <Text style={[styles.swStatusText, {
                  color: swVersion !== '—' ? '#22C55E' : '#FFB800',
                }]}>
                  {swVersion !== '—' ? 'ACTIVE' : 'NOT REGISTERED'}
                </Text>
                <Text style={styles.swVersion}>Cache {swVersion}</Text>
              </View>

              <View style={styles.swInfoGrid}>
                <SwInfoItem label="Offline Ready" value={swVersion !== '—' ? 'YES' : 'NO'} ok={swVersion !== '—'} />
                <SwInfoItem label="Shell Cache" value={cacheStats['metroride-shell-v4'] ? `${cacheStats['metroride-shell-v4'].entries} entries` : '—'} ok={!!cacheStats['metroride-shell-v4']} />
                <SwInfoItem label="Assets Cache" value={cacheStats['metroride-assets-v4'] ? `${cacheStats['metroride-assets-v4'].entries} entries` : '—'} ok={!!cacheStats['metroride-assets-v4']} />
                <SwInfoItem label="Data Cache" value={cacheStats['metroride-data-v4'] ? `${cacheStats['metroride-data-v4'].entries} entries` : '—'} ok={!!cacheStats['metroride-data-v4']} />
                <SwInfoItem label="Station Cache" value={cacheStats['metroride-station-v4'] ? `${cacheStats['metroride-station-v4'].entries} entries` : '—'} ok={!!cacheStats['metroride-station-v4']} />
                <SwInfoItem label="Reports Cache" value={cacheStats['metroride-reports-v4'] ? `${cacheStats['metroride-reports-v4'].entries} entries` : '—'} ok={!!cacheStats['metroride-reports-v4']} />
              </View>
            </View>

            {/* Cache strategy legend */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Caching Strategies</Text>
              <CacheStrategyRow icon="cube" label="Static Assets" strategy="Cache-First" color="#22C55E" />
              <CacheStrategyRow icon="train" label="Station / Fare Data" strategy="Stale-While-Revalidate" color="#40E0FF" />
              <CacheStrategyRow icon="people" label="Live Reports & Alerts" strategy="Network-First" color="#FFB800" />
              <CacheStrategyRow icon="server" label="Supabase / AI API" strategy="Network-First + Stale Fallback" color="#BB44FF" />
              <CacheStrategyRow icon="globe" label="HTML Navigation" strategy="Network-First + Offline Shell" color="#7AEFFF" />
            </View>

            {/* Offline guarantee */}
            <View style={styles.offlineGuaranteeCard}>
              <Ionicons name="shield-checkmark" size={20} color="#22C55E" />
              <View style={{ flex: 1 }}>
                <Text style={styles.offlineGuaranteeTitle}>Offline Guarantee Active</Text>
                <Text style={styles.offlineGuaranteeSub}>
                  Users can view stations, calculate fares, and open the transit map without network access.
                  Live alerts require connectivity.
                </Text>
              </View>
            </View>
          </>
        )}

      </ScrollView>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function SectionHeader({ title, icon }: { title: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={sectionStyles.row}>
      <Ionicons name={icon} size={18} color="#40E0FF" />
      <Text style={sectionStyles.title}>{title}</Text>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  title: { fontSize: 16, fontWeight: '800', color: '#40E0FF', letterSpacing: 0.3 },
});

function MetricTile({
  label, value, sub, color, icon,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={tileStyles.tile}>
      <View style={[tileStyles.iconBg, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[tileStyles.value, { color }]}>{value}</Text>
      <Text style={tileStyles.label}>{label}</Text>
      <Text style={tileStyles.sub}>{sub}</Text>
    </View>
  );
}

const tileStyles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16, padding: 16, alignItems: 'center',
  },
  iconBg: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  value: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  label: { fontSize: 12, fontWeight: '700', color: '#fff', marginBottom: 2 },
  sub:   { fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
});

function SwInfoItem({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <View style={swInfoStyles.item}>
      <View style={[swInfoStyles.dot, { backgroundColor: ok ? '#22C55E' : 'rgba(255,255,255,0.2)' }]} />
      <View>
        <Text style={swInfoStyles.label}>{label}</Text>
        <Text style={[swInfoStyles.value, { color: ok ? '#22C55E' : 'rgba(255,255,255,0.4)' }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const swInfoStyles = StyleSheet.create({
  item: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    width: '48%', marginBottom: 14,
  },
  dot:   { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  label: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 },
  value: { fontSize: 13, fontWeight: '700' },
});

function CacheStrategyRow({
  icon, label, strategy, color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  strategy: string;
  color: string;
}) {
  return (
    <View style={cacheStyles.row}>
      <View style={[cacheStyles.iconBg, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={cacheStyles.label}>{label}</Text>
      <View style={[cacheStyles.badge, { backgroundColor: `${color}18` }]}>
        <Text style={[cacheStyles.badgeText, { color }]}>{strategy}</Text>
      </View>
    </View>
  );
}

const cacheStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 10,
  },
  iconBg: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '700' },
});

// ── Main styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08090A' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14, gap: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(64,224,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(64,224,255,0.25)',
  },
  headerBtnActive: { backgroundColor: 'rgba(64,224,255,0.05)' },

  statusBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 6,
  },
  statusDot:      { width: 10, height: 10, borderRadius: 5, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  statusDotInner: { width: 7, height: 7, borderRadius: 3.5 },
  statusText:     { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  statusTime:     { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  alertCount:     { fontSize: 11, color: 'rgba(255,255,255,0.4)' },

  tabBar:        { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  tabBarContent: { paddingHorizontal: 12, gap: 4 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive:     { backgroundColor: 'rgba(64,224,255,0.1)' },
  tabText:       { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  tabTextActive: { color: '#40E0FF' },

  scroll:  { flex: 1 },
  content: { padding: 16, paddingTop: 18 },

  metricRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },

  diagCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14,
  },
  diagTitle:  { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  diagStatus: { fontSize: 14, fontWeight: '800', marginTop: 2 },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#40E0FF', borderRadius: 14,
    paddingVertical: 14, marginBottom: 8,
  },
  actionBtnDisabled: { backgroundColor: 'rgba(64,224,255,0.4)' },
  actionBtnText: { fontSize: 15, fontWeight: '800', color: '#0A0F1E' },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16, padding: 16, marginBottom: 12,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.8 },

  latencyChart: {
    flexDirection: 'row', alignItems: 'flex-end',
    height: 80, gap: 6, marginBottom: 8,
  },
  latencyBarWrap: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  latencyBar:     { width: '100%', borderRadius: 3, minHeight: 4 },
  latencyBarLabel: { fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: 3, textAlign: 'center' },

  rateRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  ratePill: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, padding: 12, alignItems: 'center',
  },
  ratePillValue: { fontSize: 18, fontWeight: '800', color: '#40E0FF' },
  ratePillLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 },

  endpointList: { gap: 4 },
  endpointRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  endpointName: { fontSize: 12, color: 'rgba(255,255,255,0.55)', flex: 1 },
  endpointRate: { fontSize: 12, fontWeight: '600', color: '#40E0FF' },

  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14,
  },
  subSectionTitle: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 },
  clearBtn: {
    paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,68,68,0.2)',
  },
  clearBtnText: { fontSize: 11, fontWeight: '700', color: '#FF4444' },

  alertCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderLeftWidth: 3, borderRadius: 12,
    padding: 14, marginBottom: 8,
  },
  alertHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  alertBadge:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  alertBadgeText: { fontSize: 10, fontWeight: '800' },
  alertTime:     { flex: 1, textAlign: 'right', fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  alertMsg:      { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 19 },
  alertMeta:     { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4, fontFamily: 'monospace' },

  emptyCard: {
    alignItems: 'center', paddingVertical: 36,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16, marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginTop: 12, marginBottom: 6 },
  emptyText:  { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingHorizontal: 20 },

  threatCard: {
    borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16,
  },
  threatHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  threatLevel:  { fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  findingsList: { gap: 6 },
  findingRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  findingDot:   { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  findingText:  { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 19 },

  sentinelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#40E0FF', borderRadius: 14,
    paddingVertical: 15, marginBottom: 14,
  },
  sentinelBtnDisabled: { backgroundColor: 'rgba(64,224,255,0.4)' },
  sentinelBtnText: { fontSize: 15, fontWeight: '800', color: '#0A0F1E' },

  aiResultCard: {
    backgroundColor: 'rgba(64,224,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(64,224,255,0.25)',
    borderRadius: 14, padding: 16, marginBottom: 16,
  },
  aiResultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  aiResultTitle:  { fontSize: 13, fontWeight: '700', color: '#40E0FF' },
  aiResultText:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 20 },

  incidentCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderLeftWidth: 3, borderRadius: 12,
    padding: 14, marginBottom: 8,
  },
  incidentHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  incidentBadge:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  incidentBadgeText:  { fontSize: 10, fontWeight: '800' },
  incidentTime:       { flex: 1, textAlign: 'right', fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  incidentSummary:    { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 19 },
  incidentAI: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6, lineHeight: 17, fontStyle: 'italic' },

  swCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16, padding: 16, marginBottom: 12,
  },
  swHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 16,
  },
  swStatusDot:   { width: 10, height: 10, borderRadius: 5 },
  swStatusText:  { fontSize: 14, fontWeight: '800', flex: 1 },
  swVersion:     { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  swInfoGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  offlineGuaranteeCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: 'rgba(34,197,94,0.06)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)',
    borderRadius: 14, padding: 14, marginBottom: 8,
  },
  offlineGuaranteeTitle: { fontSize: 14, fontWeight: '700', color: '#22C55E', marginBottom: 4 },
  offlineGuaranteeSub:   { fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 18 },
});
