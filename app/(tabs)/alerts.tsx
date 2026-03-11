import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Animated as RNAnimated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CrowdIndicator } from '@/components/ui/CrowdIndicator';

import { generateMockAlerts, generateMockCrowdLevels } from '@/utils/mockData';
import { Alert as AlertType, CrowdLevel, saveCrowdLevels, saveAlerts } from '@/utils/storage';
import { ALL_STATIONS, LINE_COLORS, LineId } from '@/constants/stations';
import {
  CommunityReport,
  REPORT_CATEGORIES,
  getCommunityReports,
  upvoteReport,
  getUserId,
} from '@/utils/communityReports';

type TabView = 'alerts' | 'crowd' | 'reports';

// ── Polling intervals ─────────────────────────────────────────────────────
const ALERT_POLL_MS = 30 * 1000;   // 30 s for live alerts + crowd
const REPORT_POLL_MS = 45 * 1000;  // 45 s for community reports

// ── Status badge types ────────────────────────────────────────────────────
type SyncIndicator = 'loading' | 'live' | 'syncing' | 'offline';

// ── Netlify function endpoint (web only) ──────────────────────────────────
function getAlertsEndpoint(): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return '/.netlify/functions/realtimeAlerts';
  }
  return null;
}

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabView>('alerts');
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [crowdLevels, setCrowdLevels] = useState<CrowdLevel[]>([]);
  const [communityReports, setCommunityReports] = useState<CommunityReport[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [crowdFilter, setCrowdFilter] = useState<'all' | LineId>('all');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [syncStatus, setSyncStatus] = useState<SyncIndicator>('loading');
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
  const isMounted = useRef(true);

  // ── Neon breathing animation: 1.6 s cycle (800 ms each half) ─────────────
  const neonBorderAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    const breath = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(neonBorderAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false,
        }),
        RNAnimated.timing(neonBorderAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: false,
        }),
      ])
    );
    breath.start();
    return () => breath.stop();
  }, [neonBorderAnim]);

  // ── Fetch user's upvoted report IDs ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      const userId = await getUserId();
      const ids = new Set(communityReports.filter((r) => r.upvotedBy.includes(userId)).map((r) => r.id));
      if (isMounted.current) setUpvotedIds(ids);
    })();
  }, [communityReports]);

  // ── Primary data fetch: alerts + crowd from Netlify / mock ────────────────
  const loadAlertData = useCallback(async () => {
    if (!isMounted.current) return;
    setSyncStatus('syncing');

    const endpoint = getAlertsEndpoint();

    if (endpoint) {
      try {
        const res = await fetch(endpoint, {
          signal: AbortSignal.timeout(10000),
          headers: { 'Accept': 'application/json' },
        });

        if (res.ok) {
          const json = await res.json();

          const liveAlerts: AlertType[] = (json.alerts ?? []).map((a: {
            id: string; title: string; description: string; line: string;
            severity: string; createdAt: string; expiresAt?: string;
          }) => ({
            id: a.id,
            title: a.title,
            description: a.description,
            line: a.line,
            severity: a.severity as AlertType['severity'],
            createdAt: a.createdAt,
            expiresAt: a.expiresAt,
          }));

          const liveCrowd: CrowdLevel[] = (json.crowdLevels ?? []).map((c: {
            stationId: string; level: string; updatedAt: string;
          }) => ({
            stationId: c.stationId,
            level: c.level as CrowdLevel['level'],
            updatedAt: c.updatedAt,
          }));

          // Use live data; fall back to mock if Supabase tables are empty
          const finalAlerts = liveAlerts.length > 0 ? liveAlerts : generateMockAlerts();
          const finalCrowd = liveCrowd.length > 0 ? liveCrowd : generateMockCrowdLevels();

          if (isMounted.current) {
            setAlerts(finalAlerts);
            setCrowdLevels(finalCrowd);
            saveAlerts(finalAlerts);
            saveCrowdLevels(finalCrowd);
            setLastRefresh(new Date());
            setSyncStatus('live');
          }
          return;
        }
      } catch {
        // Fall through to mock
      }
    }

    // ── Offline / non-web fallback ──────────────────────────────────────────
    const mockAlerts = generateMockAlerts();
    const mockCrowd = generateMockCrowdLevels();
    if (isMounted.current) {
      setAlerts(mockAlerts);
      setCrowdLevels(mockCrowd);
      saveAlerts(mockAlerts);
      saveCrowdLevels(mockCrowd);
      setLastRefresh(new Date());
      setSyncStatus('offline');
    }
  }, []);

  // ── Community reports fetch ───────────────────────────────────────────────
  const loadReports = useCallback(async () => {
    try {
      const reports = await getCommunityReports();
      if (isMounted.current) setCommunityReports(reports);
    } catch {
      // Silent
    }
  }, []);

  // ── Mount + polling ───────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    loadAlertData();
    loadReports();

    const alertInterval = setInterval(loadAlertData, ALERT_POLL_MS);
    const reportInterval = setInterval(loadReports, REPORT_POLL_MS);

    return () => {
      isMounted.current = false;
      clearInterval(alertInterval);
      clearInterval(reportInterval);
    };
  }, [loadAlertData, loadReports]);

  // ── Pull-to-refresh ───────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadAlertData(), loadReports()]);
    if (isMounted.current) setRefreshing(false);
  }, [loadAlertData, loadReports]);

  // ── Upvote handler ────────────────────────────────────────────────────────
  const handleUpvote = useCallback(async (reportId: string) => {
    const userId = await getUserId();
    if (upvotedIds.has(reportId)) return;
    setUpvotedIds((prev) => new Set([...prev, reportId]));
    setCommunityReports((prev) =>
      prev.map((r) =>
        r.id === reportId ? { ...r, upvotes: r.upvotes + 1, upvotedBy: [...r.upvotedBy, userId] } : r
      )
    );
    await upvoteReport(reportId);
  }, [upvotedIds]);

  // ── Badge helpers ─────────────────────────────────────────────────────────
  const getBadgeStyle = () => {
    if (syncStatus === 'live') return styles.badgeLive;
    if (syncStatus === 'syncing' || syncStatus === 'loading') return styles.badgeSyncing;
    return styles.badgeOffline;
  };

  const getBadgeLabel = () => {
    if (syncStatus === 'live') return '● Live';
    if (syncStatus === 'syncing' || syncStatus === 'loading') return '● Syncing';
    return '● Offline / Cached';
  };

  const getBadgeTextColor = () => {
    if (syncStatus === 'live') return Colors.electricCyan;
    if (syncStatus === 'syncing' || syncStatus === 'loading') return Colors.amber;
    return Colors.textTertiary;
  };

  const getRefreshAge = () => {
    const sec = Math.floor((Date.now() - lastRefresh.getTime()) / 1000);
    if (sec < 10) return 'Just now';
    if (sec < 60) return `${sec}s ago`;
    return `${Math.floor(sec / 60)}m ago`;
  };

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { color: Colors.error, bg: 'rgba(255,68,68,0.10)', icon: 'alert-circle' as const };
      case 'warning':
        return { color: Colors.warning, bg: 'rgba(255,184,0,0.08)', icon: 'warning' as const };
      default:
        return { color: Colors.info, bg: 'rgba(64,224,255,0.08)', icon: 'information-circle' as const };
    }
  };

  const timeAgo = (dateStr: string | number) => {
    const diff = Date.now() - (typeof dateStr === 'number' ? dateStr : new Date(dateStr).getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const filteredCrowdData = useMemo(() => {
    return crowdLevels
      .map((cl) => ({
        ...cl,
        station: ALL_STATIONS.find((s) => s.id === cl.stationId),
      }))
      .filter((cl) => cl.station)
      .filter((cl) => crowdFilter === 'all' || cl.station!.line === crowdFilter)
      .sort((a, b) => {
        const order = { heavy: 0, moderate: 1, light: 2 };
        return order[a.level] - order[b.level];
      });
  }, [crowdLevels, crowdFilter]);

  const crowdStats = useMemo(() => {
    const light = crowdLevels.filter((c) => c.level === 'light').length;
    const moderate = crowdLevels.filter((c) => c.level === 'moderate').length;
    const heavy = crowdLevels.filter((c) => c.level === 'heavy').length;
    return { light, moderate, heavy };
  }, [crowdLevels]);

  // ── Active neon glow only when data is live ───────────────────────────────
  const neonOpacityOut = syncStatus === 'live' ? 0.18 : 0.05;
  const neonOpacityIn  = syncStatus === 'live' ? 0.65 : 0.12;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>
            {activeTab === 'alerts'
              ? 'Live Alerts'
              : activeTab === 'crowd'
              ? 'Crowd Tracker'
              : 'Community'}
          </Text>

          {/* Connection diagnostic badge */}
          <Pressable style={[styles.connectionBadge, getBadgeStyle()]}>
            <Text style={[styles.connectionText, { color: getBadgeTextColor() }]}>
              {getBadgeLabel()}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.headerSubtitle}>
          {activeTab === 'alerts'
            ? `${alerts.length} active alert${alerts.length !== 1 ? 's' : ''} · Updated ${getRefreshAge()}`
            : activeTab === 'crowd'
            ? `Real-time station crowding · Updated ${getRefreshAge()}`
            : `${communityReports.length} active report${communityReports.length !== 1 ? 's' : ''} · Updated ${getRefreshAge()}`}
        </Text>
      </View>

      {/* ── Tab Toggle ─────────────────────────────────────────────────── */}
      <View style={styles.tabContainer}>
        {([
          { key: 'alerts',  label: 'Alerts',  icon: 'notifications' },
          { key: 'crowd',   label: 'Crowd',   icon: 'people' },
          { key: 'reports', label: 'Reports', icon: 'chatbubbles' },
        ] as { key: TabView; label: string; icon: string }[]).map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as never}
              size={14}
              color={activeTab === tab.key ? Colors.electricCyan : Colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* ──────────────────── ALERTS TAB ─────────────────────────────── */}
        {activeTab === 'alerts' && (
          <>
            {alerts.map((alert, index) => {
              const config = getSeverityConfig(alert.severity);
              return (
                <Animated.View key={alert.id} entering={FadeInDown.duration(400).delay(index * 80)}>
                  <RNAnimated.View
                    style={[
                      styles.glowCard,
                      {
                        borderColor: neonBorderAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [config.color + '40', config.color + 'A0'],
                        }),
                        shadowColor: config.color,
                        shadowOpacity: neonBorderAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [neonOpacityOut, neonOpacityIn],
                        }) as unknown as number,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 0 },
                        elevation: 5,
                      },
                    ]}
                  >
                    <Card style={[styles.alertCard, { borderLeftColor: config.color, borderLeftWidth: 4 }]}>
                      <View style={styles.alertHeader}>
                        <View style={[styles.alertIcon, { backgroundColor: config.bg }]}>
                          <Ionicons name={config.icon} size={18} color={config.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.alertTitle}>{alert.title}</Text>
                          <View style={styles.alertMetaRow}>
                            <Badge
                              text={alert.line}
                              variant={
                                alert.line === 'MRT-3'
                                  ? 'mrt3'
                                  : alert.line === 'LRT-1'
                                  ? 'lrt1'
                                  : alert.line === 'LRT-2'
                                  ? 'lrt2'
                                  : 'info'
                              }
                              small
                            />
                            <Text style={styles.alertTime}>{timeAgo(alert.createdAt)}</Text>
                          </View>
                        </View>
                      </View>
                      <Text style={styles.alertDescription}>{alert.description}</Text>
                    </Card>
                  </RNAnimated.View>
                </Animated.View>
              );
            })}

            {alerts.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={56} color={Colors.success} />
                <Text style={styles.emptyTitle}>All Clear!</Text>
                <Text style={styles.emptySubtext}>No active alerts at this time</Text>
              </View>
            )}
          </>
        )}

        {/* ──────────────────── CROWD TAB ──────────────────────────────── */}
        {activeTab === 'crowd' && (
          <>
            {/* Crowd Summary */}
            <Animated.View entering={FadeInDown.duration(400)}>
              <Card style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Current Overview</Text>
                <View style={styles.summaryRow}>
                  {[
                    { key: 'light', label: 'Light', color: Colors.crowdLight, count: crowdStats.light },
                    { key: 'moderate', label: 'Moderate', color: Colors.crowdModerate, count: crowdStats.moderate },
                    { key: 'heavy', label: 'Heavy', color: Colors.crowdHeavy, count: crowdStats.heavy },
                  ].map((item, i) => (
                    <React.Fragment key={item.key}>
                      {i > 0 && <View style={styles.summaryDivider} />}
                      <View style={styles.summaryItem}>
                        <View style={[styles.summaryDot, { backgroundColor: item.color }]} />
                        <Text style={styles.summaryCount}>{item.count}</Text>
                        <Text style={styles.summaryLabel}>{item.label}</Text>
                      </View>
                    </React.Fragment>
                  ))}
                </View>
              </Card>
            </Animated.View>

            {/* Line Filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.crowdFilters}
            >
              {(['all', 'MRT-3', 'LRT-1', 'LRT-2'] as const).map((filter) => {
                const isActive = crowdFilter === filter;
                const color = filter === 'all' ? Colors.primary : LINE_COLORS[filter as LineId];
                return (
                  <Pressable
                    key={filter}
                    style={[styles.crowdFilterChip, isActive && { backgroundColor: color, borderColor: color }]}
                    onPress={() => setCrowdFilter(filter)}
                  >
                    <Text
                      style={[
                        styles.crowdFilterText,
                        isActive && { color: '#FFF' },
                        !isActive && filter !== 'all' && { color },
                      ]}
                    >
                      {filter === 'all' ? 'All Lines' : filter}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Crowd List */}
            {filteredCrowdData.map((item, index) => (
              <Animated.View key={item.stationId} entering={FadeInRight.duration(300).delay(index * 30)}>
                <Pressable
                  style={({ pressed }) => [styles.crowdCard, pressed && styles.pressed]}
                  onPress={() => router.push(`/station/${item.stationId}`)}
                >
                  <View style={[styles.crowdStrip, { backgroundColor: LINE_COLORS[item.station!.line] }]} />
                  <View style={styles.crowdContent}>
                    <View style={styles.crowdTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.crowdStationName}>{item.station?.name}</Text>
                        <Text style={styles.crowdLineName}>{item.station?.line}</Text>
                      </View>
                      <CrowdIndicator level={item.level} compact />
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </>
        )}

        {/* ──────────────────── REPORTS TAB ────────────────────────────── */}
        {activeTab === 'reports' && (
          <>
            {/* Info banner */}
            <Animated.View entering={FadeInDown.duration(300)}>
              <View style={styles.reportsBanner}>
                <Ionicons name="people-circle-outline" size={18} color={Colors.violet} />
                <Text style={styles.reportsBannerText}>
                  Community-sourced · Reports expire in 2 hours
                </Text>
              </View>
            </Animated.View>

            {communityReports.map((report, index) => {
              const catConfig = REPORT_CATEGORIES[report.category];
              const hasUpvoted = upvotedIds.has(report.id);
              const lineColor =
                report.line === 'MRT-3'
                  ? Colors.mrt3
                  : report.line === 'LRT-1'
                  ? Colors.lrt1
                  : Colors.lrt2;

              return (
                <Animated.View
                  key={report.id}
                  entering={FadeInDown.duration(400).delay(index * 70)}
                >
                  <RNAnimated.View
                    style={[
                      styles.glowCard,
                      {
                        borderColor: neonBorderAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [catConfig.color + '35', catConfig.color + '85'],
                        }),
                        shadowColor: catConfig.color,
                        shadowOpacity: neonBorderAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [neonOpacityOut, neonOpacityIn],
                        }) as unknown as number,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 0 },
                        elevation: 5,
                      },
                    ]}
                  >
                    <Card style={[styles.reportCard, { borderLeftColor: catConfig.color, borderLeftWidth: 3 }]}>
                      <View style={styles.reportHeader}>
                        <View style={[styles.reportIcon, { backgroundColor: catConfig.color + '20' }]}>
                          <Ionicons name={catConfig.icon as never} size={16} color={catConfig.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reportCategory}>{catConfig.label}</Text>
                          <View style={styles.reportMetaRow}>
                            <View style={[styles.reportLineDot, { backgroundColor: lineColor }]} />
                            <Text style={styles.reportStationName}>{report.stationName}</Text>
                            <Text style={styles.reportLine}>{report.line}</Text>
                          </View>
                        </View>
                        {/* Upvote button */}
                        <Pressable
                          style={[styles.upvoteBtn, hasUpvoted && styles.upvoteBtnActive]}
                          onPress={() => handleUpvote(report.id)}
                          hitSlop={8}
                        >
                          <Ionicons
                            name={hasUpvoted ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
                            size={18}
                            color={hasUpvoted ? Colors.electricCyan : Colors.textSecondary}
                          />
                          <Text style={[styles.upvoteCount, hasUpvoted && { color: Colors.electricCyan }]}>
                            {report.upvotes}
                          </Text>
                        </Pressable>
                      </View>

                      {report.description ? (
                        <Text style={styles.reportDescription}>{report.description}</Text>
                      ) : null}

                      <Text style={styles.reportTime}>{timeAgo(report.createdAt)}</Text>
                    </Card>
                  </RNAnimated.View>
                </Animated.View>
              );
            })}

            {communityReports.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-outline" size={56} color={Colors.textTertiary} />
                <Text style={styles.emptyTitle}>No Reports Yet</Text>
                <Text style={styles.emptySubtext}>Be the first to report a station issue</Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.heavy,
    color: Colors.text,
    letterSpacing: -0.5,
    flex: 1,
  },
  // ── Status badge ──────────────────────────────────────────────────────────
  connectionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  badgeLive: {
    backgroundColor: 'rgba(64,224,255,0.10)',
    borderColor: 'rgba(64,224,255,0.30)',
  },
  badgeSyncing: {
    backgroundColor: 'rgba(255,184,0,0.10)',
    borderColor: 'rgba(255,184,0,0.30)',
  },
  badgeOffline: {
    backgroundColor: 'rgba(63,77,92,0.20)',
    borderColor: 'rgba(63,77,92,0.35)',
  },
  connectionText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  // ── Tabs ─────────────────────────────────────────────────────────────────
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    ...Shadow.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 5,
  },
  tabActive: {
    backgroundColor: 'rgba(64,224,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(64,224,255,0.25)',
  },
  tabText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.electricCyan,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl * 2,
  },
  // ── Neon glow wrapper shared by all card types ────────────────────────────
  glowCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  // ── Alert cards ───────────────────────────────────────────────────────────
  alertCard: {
    borderRadius: BorderRadius.xl,
  },
  alertHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: 4,
  },
  alertMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  alertTime: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  alertDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  // ── Crowd section ────────────────────────────────────────────────────────
  summaryCard: {
    marginBottom: Spacing.lg,
  },
  summaryTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    gap: 4,
  },
  summaryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  summaryCount: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  summaryLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  crowdFilters: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  crowdFilterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  crowdFilterText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  crowdCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  pressed: {
    opacity: 0.9,
  },
  crowdStrip: {
    width: 4,
  },
  crowdContent: {
    flex: 1,
    padding: Spacing.md,
  },
  crowdTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  crowdStationName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.text,
  },
  crowdLineName: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  // ── Community reports ────────────────────────────────────────────────────
  reportsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(187,68,255,0.08)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(187,68,255,0.20)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  reportsBannerText: {
    fontSize: FontSize.xs,
    color: Colors.violet,
    fontWeight: FontWeight.medium,
  },
  reportCard: {
    borderRadius: BorderRadius.xl,
  },
  reportHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  reportIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportCategory: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: 3,
  },
  reportMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reportLineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  reportStationName: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  reportLine: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  reportDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: Spacing.sm,
  },
  reportTime: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  upvoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  upvoteBtnActive: {
    backgroundColor: 'rgba(64,224,255,0.10)',
    borderColor: 'rgba(64,224,255,0.30)',
  },
  upvoteCount: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  // ── Empty states ─────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  emptySubtext: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
  },
});
