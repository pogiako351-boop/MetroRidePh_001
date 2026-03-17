import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { runConnectivityDiagnostic, FullDiagnosticReport, DiagnosticResult } from '@/utils/connectivityDiagnostic';
import { supabaseConfigStatus, SUPABASE_TARGET_REGION, PRODUCTION_ORIGIN } from '@/utils/supabase';

const STATUS_CONFIG = {
  pass: { icon: 'checkmark-circle', color: '#34A853', label: 'Pass' },
  fail: { icon: 'close-circle', color: '#EA4335', label: 'Fail' },
  warn: { icon: 'warning', color: '#F59E0B', label: 'Warning' },
  checking: { icon: 'time', color: '#1A73E8', label: 'Checking' },
  // 'waiting' indicates a check was intentionally deferred because a
  // prerequisite (Supabase auth) has not yet succeeded — not a real failure.
  waiting: { icon: 'hourglass-outline', color: '#8B5CF6', label: 'Waiting for Auth' },
} as const;

const OVERALL_CONFIG = {
  // 'healthy' (All Green) is only reached when config AND connectivity are both
  // validated for the production environment — stale partial passes are blocked.
  healthy: { color: '#34A853', icon: 'shield-checkmark', label: 'All Green · Production Validated' },
  degraded: { color: '#F59E0B', icon: 'warning', label: 'Service Degraded' },
  critical: { color: '#EA4335', icon: 'alert-circle', label: 'Critical Issues Detected' },
};

function ResultCard({ result }: { result: DiagnosticResult }) {
  const cfg = STATUS_CONFIG[result.status];
  return (
    <View style={[styles.resultCard, { borderLeftColor: cfg.color }]}>
      <View style={styles.resultHeader}>
        <Ionicons name={cfg.icon as keyof typeof Ionicons.glyphMap} size={18} color={cfg.color} />
        <Text style={styles.resultLabel}>{result.label}</Text>
        <View style={[styles.resultBadge, { backgroundColor: `${cfg.color}18` }]}>
          <Text style={[styles.resultBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
      <Text style={styles.resultDetail}>{result.detail}</Text>
      {result.durationMs !== undefined && (
        <Text style={styles.resultDuration}>{result.durationMs}ms</Text>
      )}
    </View>
  );
}

export default function DiagnosticsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [report, setReport] = useState<FullDiagnosticReport | null>(null);
  const [running, setRunning] = useState(false);

  const runDiagnostic = useCallback(async () => {
    if (running) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRunning(true);
    setReport(null);
    try {
      const result = await runConnectivityDiagnostic();
      setReport(result);
      Haptics.notificationAsync(
        result.overallStatus === 'healthy'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
    } finally {
      setRunning(false);
    }
  }, [running]);

  // Auto-run the diagnostic once on mount so the dashboard reflects the
  // current fixed configuration immediately without requiring a manual tap.
  const hasAutoRun = useRef(false);
  useEffect(() => {
    if (hasAutoRun.current) return;
    hasAutoRun.current = true;
    setRunning(true);
    setReport(null);
    runConnectivityDiagnostic().then((result) => {
      setReport(result);
    }).finally(() => {
      setRunning(false);
    });
  }, []);

  const overallCfg = report ? OVERALL_CONFIG[report.overallStatus] : null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1E" />
      <LinearGradient
        colors={['#0D1B3E', '#0A0F1E']}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => { Haptics.selectionAsync(); router.back(); }}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pulse Diagnostic</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Info card */}
        <View style={styles.infoCard}>
          <Ionicons name="pulse" size={22} color="#1A73E8" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>System Health Check</Text>
            <Text style={styles.infoSub}>
              Verifies configuration and connectivity for Internet, Supabase ({SUPABASE_TARGET_REGION}), and Newell AI — All Green requires both config and connectivity to be validated
            </Text>
          </View>
        </View>

        {/* Config summary */}
        <View style={styles.configCard}>
          <Text style={styles.configTitle}>Configuration</Text>

          {/* Supabase — three-state: configured / missing-config / unconfigured */}
          {(() => {
            const cfg =
              supabaseConfigStatus === 'configured'
                ? { color: '#34A853', bg: 'rgba(52,168,83,0.15)', label: 'Configured' }
                : supabaseConfigStatus === 'missing-config'
                  ? { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', label: 'Missing Config' }
                  : { color: '#EA4335', bg: 'rgba(234,67,53,0.15)', label: 'Not configured' };
            return (
              <View style={styles.configRow}>
                <Text style={styles.configKey}>Supabase</Text>
                <View style={[styles.configStatus, { backgroundColor: cfg.bg }]}>
                  <View style={[styles.configDot, { backgroundColor: cfg.color }]} />
                  <Text style={[styles.configStatusText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>
            );
          })()}

          <View style={styles.configRow}>
            <Text style={styles.configKey}>Newell AI</Text>
            <View style={[styles.configStatus, { backgroundColor: process.env.EXPO_PUBLIC_NEWELL_API_URL ? 'rgba(52,168,83,0.15)' : 'rgba(234,67,53,0.15)' }]}>
              <View style={[styles.configDot, { backgroundColor: process.env.EXPO_PUBLIC_NEWELL_API_URL ? '#34A853' : '#EA4335' }]} />
              <Text style={[styles.configStatusText, { color: process.env.EXPO_PUBLIC_NEWELL_API_URL ? '#34A853' : '#EA4335' }]}>
                {process.env.EXPO_PUBLIC_NEWELL_API_URL ? 'Configured' : 'Not configured'}
              </Text>
            </View>
          </View>

          <View style={styles.configRow}>
            <Text style={styles.configKey}>Region Routing</Text>
            <View style={[styles.configStatus, { backgroundColor: 'rgba(52,168,83,0.15)' }]}>
              <View style={[styles.configDot, { backgroundColor: '#34A853' }]} />
              <Text style={[styles.configStatusText, { color: '#34A853' }]}>
                {SUPABASE_TARGET_REGION} · Hardcoded
              </Text>
            </View>
          </View>

          <View style={[styles.configRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.configKey}>Production Origin</Text>
            <View style={[styles.configStatus, { backgroundColor: 'rgba(26,115,232,0.12)' }]}>
              <View style={[styles.configDot, { backgroundColor: '#1A73E8' }]} />
              <Text style={[styles.configStatusText, { color: '#1A73E8' }]} numberOfLines={1}>
                {PRODUCTION_ORIGIN.replace('https://', '')}
              </Text>
            </View>
          </View>
        </View>

        {/* Run button */}
        <TouchableOpacity
          style={[styles.runButton, running && styles.runButtonActive]}
          onPress={runDiagnostic}
          activeOpacity={0.85}
          disabled={running}
        >
          {running ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.runButtonText}>Running diagnostics…</Text>
            </>
          ) : (
            <>
              <Ionicons name="play-circle" size={20} color="#fff" />
              <Text style={styles.runButtonText}>
                {report ? 'Run Again' : 'Run Diagnostic'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Results */}
        {report && (
          <>
            {/* Overall status */}
            <View style={[styles.overallCard, { borderColor: `${overallCfg!.color}30`, backgroundColor: `${overallCfg!.color}10` }]}>
              <Ionicons name={overallCfg!.icon as keyof typeof Ionicons.glyphMap} size={28} color={overallCfg!.color} />
              <View style={styles.overallContent}>
                <Text style={[styles.overallLabel, { color: overallCfg!.color }]}>
                  {overallCfg!.label}
                </Text>
                <Text style={styles.overallTime}>
                  Tested at {report.timestamp.toLocaleTimeString()}
                </Text>
              </View>
            </View>

            {/* Individual results — resolved by connectivityDiagnostic utility:
                • Internet is forced green when Supabase is reachable (mobile data heuristic)
                • Newell AI shows 'Waiting for Auth' when Supabase has a 401/config error */}
            {report.results.map((r) => (
              <ResultCard key={r.label} result={r} />
            ))}

            {/* Recommendation */}
            {report.overallStatus !== 'healthy' && (
              <View style={styles.recCard}>
                <Ionicons name="bulb" size={18} color="#F59E0B" />
                <Text style={styles.recText}>
                  {report.overallStatus === 'critical'
                    ? 'Critical: Multiple services are unreachable or misconfigured. Verify all SUPABASE_URL / SUPABASE_ANON_KEY variants are set and your internet connection is active.'
                    : report.results.some((r) => r.detail.toLowerCase().includes('missing config'))
                      ? 'Missing Config detected — ensure SUPABASE_URL and SUPABASE_ANON_KEY are set (check SUPABASE_*, NEXT_PUBLIC_*, and EXPO_PUBLIC_* prefix variants). A correct API key is required to clear the 401 and unblock downstream AI checks.'
                      : 'Some services may be limited. The app will use cached data for offline operation. Connect Supabase for full cloud sync.'}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0F1E' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 },
  content: { padding: 16 },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(26,115,232,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(26,115,232,0.2)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 2 },
  infoSub: { fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 17 },

  configCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  configTitle: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 10 },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  configKey: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  configStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  configDot: { width: 6, height: 6, borderRadius: 3 },
  configStatusText: { fontSize: 12, fontWeight: '600' },

  runButton: {
    backgroundColor: '#1A73E8',
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  runButtonActive: { backgroundColor: 'rgba(26,115,232,0.6)' },
  runButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  overallCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  overallContent: { flex: 1 },
  overallLabel: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  overallTime: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },

  resultCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderLeftWidth: 3,
    padding: 14,
    marginBottom: 8,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  resultLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#fff' },
  resultBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  resultBadgeText: { fontSize: 11, fontWeight: '700' },
  resultDetail: { fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 17 },
  resultDuration: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 },

  recCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },
  recText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 19 },
});
