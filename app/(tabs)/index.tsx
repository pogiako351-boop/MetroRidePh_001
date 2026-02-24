import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Animated as RNAnimated,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '@/constants/theme';
import { searchStations, Station, ALL_STATIONS } from '@/constants/stations';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LineDot } from '@/components/ui/LineDot';
import { CommuterBadge } from '@/components/ui/CommuterBadge';
import { FAB, FABMenuItem } from '@/components/ui/FAB';
import { ReportModal } from '@/components/ui/ReportModal';
import {
  getFavoriteStations,
  getFavoriteRoutes,
  FavoriteStation,
  FavoriteRoute,
} from '@/utils/storage';
import { generateMockAlerts, getNextTrainETA } from '@/utils/mockData';
import {
  getCommunityReports,
  upvoteReport,
  CommunityReport,
  REPORT_CATEGORIES,
} from '@/utils/communityReports';
import { getCommuterProfile, CommuterProfile } from '@/utils/commuterPoints';

const QUICK_ACTIONS = [
  { id: 'ai', title: 'MetroAI\nAssistant', icon: 'chatbubbles-outline' as const, color: Colors.violet, route: '/metro-ai' },
  { id: 'map', title: 'System\nMap', icon: 'map-outline' as const, color: Colors.primary, route: '/transit-map' },
  { id: 'fare', title: 'Fare\nCalculator', icon: 'calculator-outline' as const, color: '#34A853', route: '/fare-calculator' },
  { id: 'route', title: 'Route\nPlanner', icon: 'navigate-outline' as const, color: '#9C27B0', route: '/route-planner' },
  { id: 'alerts', title: 'Live\nAlerts', icon: 'notifications-outline' as const, color: '#EA4335', route: '/(tabs)/alerts' },
  { id: 'premium', title: 'Go\nPremium', icon: 'diamond-outline' as const, color: Colors.violetDark, route: '/premium' },
];

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Station[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [eta, setEta] = useState(getNextTrainETA());
  const [favStations, setFavStations] = useState<FavoriteStation[]>([]);
  const [, setFavRoutes] = useState<FavoriteRoute[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [commuterProfile, setCommuterProfile] = useState<CommuterProfile | null>(null);
  const [communityReports, setCommunityReports] = useState<CommunityReport[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [fabExpanded, setFabExpanded] = useState(false);
  const alerts = generateMockAlerts();
  const criticalAlerts = alerts.filter((a) => a.severity === 'warning' || a.severity === 'critical');
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;
  const reportPulseAnims = useRef<RNAnimated.Value[]>([]).current;
  const fabOverlayOpacity = useRef(new RNAnimated.Value(0)).current;

  // Initialize report pulse anims
  useEffect(() => {
    communityReports.forEach((_, i) => {
      if (!reportPulseAnims[i]) {
        reportPulseAnims[i] = new RNAnimated.Value(1);
      }
    });
  }, [communityReports, reportPulseAnims]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setEta((prev) => {
        const totalSec = prev.minutes * 60 + prev.seconds - 1;
        if (totalSec <= 0) return getNextTrainETA();
        return { minutes: Math.floor(totalSec / 60), seconds: totalSec % 60 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const pulse = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        RNAnimated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const loadData = useCallback(async () => {
    const [stations, routes, profile, reports] = await Promise.all([
      getFavoriteStations(),
      getFavoriteRoutes(),
      getCommuterProfile(),
      getCommunityReports(),
    ]);
    setFavStations(stations);
    setFavRoutes(routes);
    setCommuterProfile(profile);
    setCommunityReports(reports.slice(0, 3));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setEta(getNextTrainETA());
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      setSearchResults(searchStations(searchQuery));
      setShowSearch(true);
    } else {
      setSearchResults([]);
      setShowSearch(false);
    }
  }, [searchQuery]);

  const toggleFab = useCallback(() => {
    const toValue = fabExpanded ? 0 : 1;
    setFabExpanded(!fabExpanded);
    RNAnimated.timing(fabOverlayOpacity, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [fabExpanded, fabOverlayOpacity]);

  const handleUpvote = useCallback(
    async (reportId: string) => {
      await upvoteReport(reportId);
      setCommunityReports((prev) =>
        prev.map((r) =>
          r.id === reportId ? { ...r, upvotes: r.upvotes + 1 } : r
        )
      );
    },
    []
  );

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });

  const getTimeAgo = (timestamp: number) => {
    const mins = Math.floor((Date.now() - timestamp) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  const favStationData = favStations
    .map((f) => ({ ...f, station: ALL_STATIONS.find((s) => s.id === f.stationId) }))
    .filter((f) => f.station);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(500).delay(100)} style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.appName}>MetroRide PH</Text>
            <Text style={styles.dateText}>{formatDate(currentTime)}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
            <Pressable onPress={() => router.push('/premium')} style={styles.premiumButton}>
              <Ionicons name="diamond" size={16} color={Colors.gold} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Commuter Badge */}
        {commuterProfile && (
          <Animated.View entering={FadeInDown.duration(500).delay(150)}>
            <CommuterBadge profile={commuterProfile} onPress={() => router.push('/reminders')} />
          </Animated.View>
        )}

        {/* Search Bar */}
        <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.searchBarContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search stations, places..."
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
              </Pressable>
            )}
          </View>
        </Animated.View>

        {/* Search Results */}
        {showSearch && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.searchResults}>
            {searchResults.length === 0 ? (
              <Text style={styles.noResults}>No stations found</Text>
            ) : (
              searchResults.slice(0, 5).map((station) => (
                <Pressable
                  key={station.id}
                  style={({ pressed }) => [styles.searchResultItem, pressed && styles.pressed]}
                  onPress={() => {
                    setSearchQuery('');
                    router.push(`/station/${station.id}`);
                  }}
                >
                  <LineDot line={station.line} size={10} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultName}>{station.name}</Text>
                    <Text style={styles.searchResultLine}>{station.line}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                </Pressable>
              ))
            )}
          </Animated.View>
        )}

        {/* Alert Banner */}
        {criticalAlerts.length > 0 && (
          <Animated.View entering={FadeInDown.duration(500).delay(300)}>
            <Pressable
              onPress={() => router.push('/(tabs)/alerts')}
              style={({ pressed }) => [styles.alertBanner, pressed && styles.pressed]}
            >
              <View style={styles.alertIconContainer}>
                <Ionicons name="warning" size={20} color="#E37400" />
              </View>
              <View style={styles.alertBannerContent}>
                <Text style={styles.alertBannerTitle} numberOfLines={1}>
                  {criticalAlerts[0].title}
                </Text>
                <Text style={styles.alertBannerDesc} numberOfLines={1}>
                  {criticalAlerts[0].description}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </Pressable>
          </Animated.View>
        )}

        {/* Next Train ETA */}
        <Animated.View entering={FadeInDown.duration(500).delay(400)}>
          <RNAnimated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Card style={styles.etaCard}>
              <View style={styles.etaHeader}>
                <View style={styles.etaLabelRow}>
                  <View style={styles.liveDot} />
                  <Text style={styles.etaLabel}>Next Train ETA</Text>
                </View>
                <Badge text="MRT-3" variant="mrt3" small />
              </View>
              <View style={styles.etaTimeContainer}>
                <Text style={styles.etaTime}>
                  {String(eta.minutes).padStart(2, '0')}:{String(eta.seconds).padStart(2, '0')}
                </Text>
                <Text style={styles.etaUnit}>min</Text>
              </View>
              <Text style={styles.etaSubtext}>North Avenue → Taft Avenue</Text>
            </Card>
          </RNAnimated.View>
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.duration(500).delay(500)} style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(500).delay(600)} style={styles.quickActions}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.id}
              style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}
              onPress={() => router.push(action.route as never)}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: action.color + '18' }]}>
                <Ionicons name={action.icon} size={24} color={action.color} />
              </View>
              <Text style={styles.quickActionTitle}>{action.title}</Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* Community Reports */}
        {communityReports.length > 0 && (
          <>
            <Animated.View entering={FadeInDown.duration(500).delay(700)} style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Community Reports</Text>
                <View style={styles.livePill}>
                  <View style={styles.livePillDot} />
                  <Text style={styles.livePillText}>LIVE</Text>
                </View>
              </View>
              <Pressable onPress={() => setShowReportModal(true)}>
                <Text style={styles.seeAll}>+ Add</Text>
              </Pressable>
            </Animated.View>
            <Animated.View entering={FadeInDown.duration(500).delay(800)}>
              {communityReports.map((report, idx) => {
                const cat = REPORT_CATEGORIES[report.category];
                return (
                  <View key={report.id} style={styles.reportCard}>
                    <View style={[styles.reportIconBox, { backgroundColor: cat.color + '20' }]}>
                      <Ionicons
                        name={cat.icon as keyof typeof Ionicons.glyphMap}
                        size={20}
                        color={cat.color}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reportTitle}>{cat.label}</Text>
                      <Text style={styles.reportMeta}>
                        {report.stationName} · {report.line} · {getTimeAgo(report.createdAt)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleUpvote(report.id)}
                      style={styles.upvoteBtn}
                    >
                      <Ionicons name="arrow-up" size={14} color={Colors.amber} />
                      <Text style={styles.upvoteCount}>{report.upvotes}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </Animated.View>
          </>
        )}

        {/* Favorites Shortcut */}
        {favStationData.length > 0 && (
          <>
            <Animated.View entering={FadeInRight.duration(500).delay(900)} style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Favorites</Text>
              <Pressable onPress={() => router.push('/(tabs)/favorites')}>
                <Text style={styles.seeAll}>See all</Text>
              </Pressable>
            </Animated.View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.favHorizontal}
            >
              {favStationData.map((fav) => (
                <Pressable
                  key={fav.stationId}
                  style={({ pressed }) => [styles.favCard, pressed && styles.pressed]}
                  onPress={() => router.push(`/station/${fav.stationId}`)}
                >
                  <View style={styles.favIconContainer}>
                    <Ionicons
                      name={fav.label === 'home' ? 'home' : fav.label === 'work' ? 'briefcase' : 'star'}
                      size={18}
                      color={Colors.primary}
                    />
                  </View>
                  <Text style={styles.favName} numberOfLines={1}>{fav.station?.name}</Text>
                  <View style={styles.favLineRow}>
                    <LineDot line={fav.station!.line} size={6} />
                    <Text style={styles.favLine}>{fav.station?.line}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {/* Line Status Summary */}
        <Animated.View entering={FadeInDown.duration(500).delay(1000)} style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Line Status</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(500).delay(1100)}>
          {(['MRT-3', 'LRT-1', 'LRT-2'] as const).map((line) => (
            <Card key={line} style={styles.lineStatusCard} onPress={() => router.push('/(tabs)/stations')}>
              <View style={styles.lineStatusRow}>
                <LineDot line={line} size={14} />
                <Text style={styles.lineStatusName}>{line}</Text>
                <View style={{ flex: 1 }} />
                <Badge text="Normal" variant="success" small />
              </View>
            </Card>
          ))}
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB Overlay */}
      {fabExpanded && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={toggleFab}
        >
          <RNAnimated.View
            style={[
              StyleSheet.absoluteFill,
              styles.fabOverlay,
              { opacity: fabOverlayOpacity },
            ]}
          />
        </Pressable>
      )}

      {/* FAB Menu Items */}
      {fabExpanded && (
        <View style={[styles.fabMenu, { bottom: insets.bottom + 84 }]}>
          <FABMenuItem
            icon="people-outline"
            label="Long Lines"
            color={Colors.amber}
            onPress={() => { toggleFab(); setShowReportModal(true); }}
            delay={0}
            visible={fabExpanded}
          />
          <FABMenuItem
            icon="alert-circle-outline"
            label="Technical Issue"
            color={Colors.error}
            onPress={() => { toggleFab(); setShowReportModal(true); }}
            delay={60}
            visible={fabExpanded}
          />
          <FABMenuItem
            icon="snow-outline"
            label="Aircon Issue"
            color={Colors.primary}
            onPress={() => { toggleFab(); setShowReportModal(true); }}
            delay={120}
            visible={fabExpanded}
          />
          <FABMenuItem
            icon="card-outline"
            label="Fare Machine"
            color={Colors.success}
            onPress={() => { toggleFab(); setShowReportModal(true); }}
            delay={180}
            visible={fabExpanded}
          />
        </View>
      )}

      {/* FAB Button */}
      <View style={[styles.fabContainer, { bottom: insets.bottom + 16 }]}>
        <FAB onPress={() => { setShowReportModal(true); }} expanded={fabExpanded} />
      </View>

      {/* Report Modal */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        onReportSubmitted={loadData}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  appName: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.heavy,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  dateText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  timeText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  premiumButton: {
    backgroundColor: Colors.premium + '10',
    borderRadius: BorderRadius.full,
    padding: Spacing.sm,
  },
  searchBarContainer: {
    marginBottom: Spacing.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md + 2,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  searchResults: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    ...Shadow.md,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  searchResultName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.text,
  },
  searchResultLine: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  noResults: {
    padding: Spacing.lg,
    textAlign: 'center',
    color: Colors.textTertiary,
    fontSize: FontSize.md,
  },
  pressed: {
    opacity: 0.85,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF7E0',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  alertIconContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: BorderRadius.full,
    padding: Spacing.sm,
  },
  alertBannerContent: { flex: 1 },
  alertBannerTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#92400E',
  },
  alertBannerDesc: {
    fontSize: FontSize.xs,
    color: '#A16207',
    marginTop: 1,
  },
  etaCard: {
    backgroundColor: Colors.primary,
    marginBottom: Spacing.lg,
  },
  etaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  etaLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34A853',
  },
  etaLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: 'rgba(255,255,255,0.8)',
  },
  etaTimeContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  etaTime: {
    fontSize: 48,
    fontWeight: FontWeight.heavy,
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  etaUnit: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.medium,
    color: 'rgba(255,255,255,0.7)',
  },
  etaSubtext: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.6)',
    marginTop: Spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EA333315',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  livePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.error,
  },
  livePillText: {
    fontSize: 9,
    fontWeight: FontWeight.heavy,
    color: Colors.error,
    letterSpacing: 0.5,
  },
  seeAll: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  quickAction: {
    width: '30%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadow.sm,
  },
  quickActionPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  quickActionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 14,
  },
  // Community Reports
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  reportIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  reportMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  upvoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.amberLight,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.amber + '40',
  },
  upvoteCount: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.amberDark,
  },
  favHorizontal: {
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  favCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    width: 120,
    alignItems: 'center',
    ...Shadow.sm,
  },
  favIconContainer: {
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.full,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  favName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  favLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  favLine: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  lineStatusCard: { marginBottom: Spacing.sm },
  lineStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  lineStatusName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  // FAB
  fabContainer: {
    position: 'absolute',
    right: Spacing.xl,
    zIndex: 100,
  },
  fabMenu: {
    position: 'absolute',
    right: Spacing.xl + 10,
    zIndex: 99,
    alignItems: 'flex-end',
  },
  fabOverlay: {
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
});
