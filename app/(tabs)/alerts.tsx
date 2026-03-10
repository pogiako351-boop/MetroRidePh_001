import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Animated as RNAnimated,
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
import { useTransitDataSync } from '@/utils/transitDataSync';

type TabView = 'alerts' | 'crowd';

// Real-time poll interval: 45 seconds for crowd & alert data
const ALERT_POLL_MS = 45 * 1000;

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabView>('alerts');
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [crowdLevels, setCrowdLevels] = useState<CrowdLevel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [crowdFilter, setCrowdFilter] = useState<'all' | LineId>('all');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const { syncStatus } = useTransitDataSync();

  // Neon border breathing animation for live data cards
  const neonBorderAnim = useRef(new RNAnimated.Value(0)).current;

  // Start breathing animation
  useEffect(() => {
    const breath = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(neonBorderAnim, { toValue: 1, duration: 1800, useNativeDriver: false }),
        RNAnimated.timing(neonBorderAnim, { toValue: 0, duration: 1800, useNativeDriver: false }),
      ])
    );
    breath.start();
    return () => breath.stop();
  }, [neonBorderAnim]);

  const loadData = useCallback(() => {
    const newAlerts = generateMockAlerts();
    const newCrowdLevels = generateMockCrowdLevels();
    setAlerts(newAlerts);
    setCrowdLevels(newCrowdLevels);
    saveAlerts(newAlerts);
    saveCrowdLevels(newCrowdLevels);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time polling: refresh alert & crowd data every 45 seconds
  useEffect(() => {
    const interval = setInterval(loadData, ALERT_POLL_MS);
    return () => clearInterval(interval);
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
    setTimeout(() => setRefreshing(false), 800);
  }, [loadData]);

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

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>
            {activeTab === 'alerts' ? 'Live Alerts' : 'Crowd Tracker'}
          </Text>
          {/* Connection Diagnostic Indicator */}
          <View style={[
            styles.connectionBadge,
            syncStatus === 'syncing' && styles.connectionBadgeSyncing,
            syncStatus === 'error' && styles.connectionBadgeError,
          ]}>
            <View style={[
              styles.connectionDot,
              syncStatus === 'syncing' && { backgroundColor: Colors.amber },
              syncStatus === 'error' && { backgroundColor: Colors.error },
              syncStatus === 'offline' && { backgroundColor: Colors.textTertiary },
            ]} />
            <Text style={[
              styles.connectionText,
              syncStatus === 'syncing' && { color: Colors.amber },
              syncStatus === 'error' && { color: Colors.error },
            ]}>
              {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'error' ? 'Cached' : 'Live'}
            </Text>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>
          {activeTab === 'alerts'
            ? `${alerts.length} active alerts · Updated ${getRefreshAge()}`
            : `Real-time station crowding · Updated ${getRefreshAge()}`}
        </Text>
      </View>

      {/* Tab Toggle */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'alerts' && styles.tabActive]}
          onPress={() => setActiveTab('alerts')}
        >
          <Ionicons
            name="notifications"
            size={16}
            color={activeTab === 'alerts' ? Colors.electricCyan : Colors.textSecondary}
          />
          <Text
            style={[styles.tabText, activeTab === 'alerts' && styles.tabTextActive]}
          >
            Alerts
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'crowd' && styles.tabActive]}
          onPress={() => setActiveTab('crowd')}
        >
          <Ionicons
            name="people"
            size={16}
            color={activeTab === 'crowd' ? Colors.electricCyan : Colors.textSecondary}
          />
          <Text
            style={[styles.tabText, activeTab === 'crowd' && styles.tabTextActive]}
          >
            Crowd Levels
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {activeTab === 'alerts' ? (
          <>
            {alerts.map((alert, index) => {
              const config = getSeverityConfig(alert.severity);
              return (
                <Animated.View key={alert.id} entering={FadeInDown.duration(400).delay(index * 80)}>
                  <RNAnimated.View style={[
                    styles.alertCardWrapper,
                    {
                      borderColor: neonBorderAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [config.color + '25', config.color + '70'],
                      }),
                      shadowColor: config.color,
                      shadowOpacity: neonBorderAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.05, 0.25],
                      }) as unknown as number,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: 4,
                    },
                  ]}>
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
        ) : (
          <>
            {/* Crowd Summary */}
            <Animated.View entering={FadeInDown.duration(400)}>
              <Card style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Current Overview</Text>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <View style={[styles.summaryDot, { backgroundColor: Colors.crowdLight }]} />
                    <Text style={styles.summaryCount}>{crowdStats.light}</Text>
                    <Text style={styles.summaryLabel}>Light</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <View style={[styles.summaryDot, { backgroundColor: Colors.crowdModerate }]} />
                    <Text style={styles.summaryCount}>{crowdStats.moderate}</Text>
                    <Text style={styles.summaryLabel}>Moderate</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <View style={[styles.summaryDot, { backgroundColor: Colors.crowdHeavy }]} />
                    <Text style={styles.summaryCount}>{crowdStats.heavy}</Text>
                    <Text style={styles.summaryLabel}>Heavy</Text>
                  </View>
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
                    style={[
                      styles.crowdFilterChip,
                      isActive && { backgroundColor: color, borderColor: color },
                    ]}
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
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(64,224,255,0.10)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(64,224,255,0.25)',
  },
  connectionBadgeSyncing: {
    backgroundColor: 'rgba(255,184,0,0.10)',
    borderColor: 'rgba(255,184,0,0.25)',
  },
  connectionBadgeError: {
    backgroundColor: 'rgba(255,68,68,0.10)',
    borderColor: 'rgba(255,68,68,0.25)',
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.electricCyan,
  },
  connectionText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.electricCyan,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  alertCardWrapper: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    marginBottom: Spacing.sm,
  },
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
    gap: Spacing.sm,
  },
  tabActive: {
    backgroundColor: 'rgba(64,224,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(64,224,255,0.25)',
  },
  tabText: {
    fontSize: FontSize.sm,
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
});
