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
import Animated, { FadeInDown, FadeInRight, FadeInUp } from 'react-native-reanimated';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '@/constants/theme';
import { Station, ALL_STATIONS } from '@/constants/stations';
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
import { frecencySearch, recordStationVisit, getRecentStations } from '@/utils/frecency';
import { hapticLight, hapticMedium, hapticSuccess, hapticDoubleTap } from '@/utils/haptics';
import { useTransitDataSync } from '@/utils/transitDataSync';
import LiveDataBadge from '@/components/ui/LiveDataBadge';
import { Skeleton, StationCardSkeleton } from '@/components/ui/Skeleton';

const QUICK_ACTIONS = [
  { id: 'ai', title: 'MetroAI\nAssistant', icon: 'chatbubbles-outline' as const, color: Colors.electricCyan, route: '/metro-ai' },
  { id: 'map', title: 'System\nMap', icon: 'map-outline' as const, color: Colors.lrt1, route: '/transit-map' },
  { id: 'fare', title: 'Fare\nCalculator', icon: 'calculator-outline' as const, color: Colors.neonLime, route: '/fare-calculator' },
  { id: 'route', title: 'Route\nPlanner', icon: 'navigate-outline' as const, color: Colors.lrt2, route: '/route-planner' },
  { id: 'insights', title: 'My\nInsights', icon: 'stats-chart-outline' as const, color: Colors.amber, route: '/insights' },
  { id: 'beep', title: 'Beep\nCard', icon: 'card-outline' as const, color: '#22C55E', route: '/beep-card' },
  { id: 'alerts', title: 'Live\nAlerts', icon: 'notifications-outline' as const, color: '#FF4444', route: '/(tabs)/alerts' },
  { id: 'settings', title: 'Settings', icon: 'settings-outline' as const, color: Colors.textSecondary, route: '/settings' },
  { id: 'premium', title: 'Go\nPremium', icon: 'diamond-outline' as const, color: Colors.violet, route: '/premium' },
];

function getTimeOfDayLabel(hour: number): { label: string; emoji: string } {
  if (hour >= 5 && hour < 11) return { label: 'Good Morning', emoji: '🌅' };
  if (hour >= 11 && hour < 16) return { label: 'Good Afternoon', emoji: '☀️' };
  if (hour >= 16 && hour < 20) return { label: 'Good Evening', emoji: '🌇' };
  return { label: 'Good Night', emoji: '🌙' };
}

function getProactiveTip(hour: number, hasAlerts: boolean): { text: string; icon: string; color: string } | null {
  if (hasAlerts) return { text: 'Active service alerts on your lines — check for delays before you leave.', icon: 'warning', color: Colors.warning };
  if (hour >= 7 && hour <= 9) return { text: '🚨 Morning rush hour: Expect heavy crowds. Try boarding 1–2 stations earlier.', icon: 'people', color: Colors.error };
  if (hour >= 17 && hour <= 19) return { text: '⚠️ Evening rush: MRT-3 southbound typically heavy. Consider LRT-1 if going to Taft.', icon: 'train', color: Colors.amber };
  if (hour >= 5 && hour <= 6) return { text: '🌅 Early bird advantage: 60% less crowd before 7 AM. Great time to commute!', icon: 'sunny', color: Colors.success };
  if (hour >= 20) return { text: '🌙 Last trains at 10:00–10:30 PM. Plan ahead to avoid missing the last trip.', icon: 'time', color: Colors.primary };
  return null;
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLiveData, lastSync } = useTransitDataSync();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Station[]>([]);
  const [recentStations, setRecentStations] = useState<Station[]>([]);
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
  const [proactiveDismissed, setProactiveDismissed] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const alerts = generateMockAlerts();
  const criticalAlerts = alerts.filter((a) => a.severity === 'warning' || a.severity === 'critical');
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;
  const reportPulseAnims = useRef<RNAnimated.Value[]>([]).current;
  const fabOverlayOpacity = useRef(new RNAnimated.Value(0)).current;
  const trainRefreshAnim = useRef(new RNAnimated.Value(-60)).current;
  const meshAnim1 = useRef(new RNAnimated.Value(0)).current;
  const meshAnim2 = useRef(new RNAnimated.Value(0)).current;
  const supabasePulse = useRef(new RNAnimated.Value(1)).current;

  const hour = currentTime.getHours();
  const timeTint = getTimeOfDayLabel(hour);
  const proactiveTip = proactiveDismissed ? null : getProactiveTip(hour, criticalAlerts.length > 0);

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

  // ETA pulse
  useEffect(() => {
    const pulse = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, { toValue: 1.04, duration: 1200, useNativeDriver: true }),
        RNAnimated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Supabase dot pulse
  useEffect(() => {
    const pulse = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(supabasePulse, { toValue: 1.5, duration: 1000, useNativeDriver: true }),
        RNAnimated.timing(supabasePulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [supabasePulse]);

  // Animated mesh gradient drift
  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(meshAnim1, { toValue: 1, duration: 6000, useNativeDriver: true }),
        RNAnimated.timing(meshAnim1, { toValue: 0, duration: 6000, useNativeDriver: true }),
      ])
    ).start();
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(meshAnim2, { toValue: 1, duration: 8000, useNativeDriver: true }),
        RNAnimated.timing(meshAnim2, { toValue: 0, duration: 8000, useNativeDriver: true }),
      ])
    ).start();
  }, [meshAnim1, meshAnim2]);

  const loadData = useCallback(async () => {
    const [stations, routes, profile, reports, recent] = await Promise.all([
      getFavoriteStations(),
      getFavoriteRoutes(),
      getCommuterProfile(),
      getCommunityReports(),
      getRecentStations(4),
    ]);
    setFavStations(stations);
    setFavRoutes(routes);
    setCommuterProfile(profile);
    setCommunityReports(reports.slice(0, 3));
    setRecentStations(recent);
    setIsLoadingData(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    hapticMedium();
    setRefreshing(true);
    trainRefreshAnim.setValue(-60);
    RNAnimated.timing(trainRefreshAnim, {
      toValue: 400,
      duration: 1200,
      useNativeDriver: true,
    }).start();
    await loadData();
    setEta(getNextTrainETA());
    setRefreshing(false);
  }, [loadData, trainRefreshAnim]);

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      frecencySearch(searchQuery).then((results) => {
        setSearchResults(results);
        setShowSearch(true);
      });
    } else {
      setShowSearch(false);
      if (recentStations.length > 0) {
        setSearchResults(recentStations);
      } else {
        setSearchResults([]);
      }
    }
  }, [searchQuery, recentStations]);

  const toggleFab = useCallback(() => {
    hapticLight();
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
      hapticSuccess();
      await upvoteReport(reportId);
      setCommunityReports((prev) =>
        prev.map((r) =>
          r.id === reportId ? { ...r, upvotes: r.upvotes + 1 } : r
        )
      );
    },
    []
  );

  const handleStationPress = useCallback(
    (stationId: string) => {
      hapticLight();
      recordStationVisit(stationId);
      setSearchQuery('');
      router.push(`/station/${stationId}`);
    },
    [router]
  );

  const handleFavPress = useCallback(
    (stationId: string) => {
      hapticDoubleTap();
      recordStationVisit(stationId);
      router.push(`/station/${stationId}`);
    },
    [router]
  );

  const handleQuickAction = useCallback(
    (route: string) => {
      hapticLight();
      router.push(route as never);
    },
    [router]
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

  // Mesh gradient X offsets
  const mesh1X = meshAnim1.interpolate({ inputRange: [0, 1], outputRange: [-20, 20] });
  const mesh2X = meshAnim2.interpolate({ inputRange: [0, 1], outputRange: [20, -20] });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Animated Mesh Gradient Background */}
      <RNAnimated.View
        style={[styles.meshBlob1, { transform: [{ translateX: mesh1X }] }]}
        pointerEvents="none"
      />
      <RNAnimated.View
        style={[styles.meshBlob2, { transform: [{ translateX: mesh2X }] }]}
        pointerEvents="none"
      />

      {/* Train refresh indicator */}
      {refreshing && (
        <RNAnimated.View
          style={[styles.trainRefreshBar, { transform: [{ translateX: trainRefreshAnim }] }]}
          pointerEvents="none"
        >
          <Text style={styles.trainEmoji}>🚇</Text>
          <View style={styles.trainTrack} />
        </RNAnimated.View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.electricCyan}
            title="Refreshing..."
            titleColor={Colors.textSecondary}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Dark Header Area */}
        <View style={styles.headerArea}>
          <Animated.View entering={FadeInDown.duration(500).delay(100)} style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.appNameRow}>
                <Text style={styles.appName}>MetroRide PH</Text>
                <LiveDataBadge visible={isLiveData} lastSync={lastSync} compact />
              </View>
              <Text style={styles.railTagline}>Elite Rail Engine · LRT-1 · MRT-3 · LRT-2</Text>
              <Text style={styles.dateText}>{timeTint.emoji} {formatDate(currentTime)}</Text>

              {/* Verified via Supabase dot */}
              <View style={styles.supabaseRow}>
                <View style={styles.supabaseDotWrapper}>
                  <RNAnimated.View
                    style={[styles.supabaseDotRing, { transform: [{ scale: supabasePulse }], opacity: supabasePulse.interpolate({ inputRange: [1, 1.5], outputRange: [0.4, 0] }) }]}
                  />
                  <View style={styles.supabaseDotCore} />
                </View>
                <Text style={styles.supabaseLabel}>Verified via Supabase</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
              <Pressable
                onPress={() => { hapticLight(); router.push('/settings'); }}
                style={styles.settingsButton}
              >
                <Ionicons name="settings-outline" size={18} color={Colors.textSecondary} />
              </Pressable>
              <Pressable onPress={() => { hapticLight(); router.push('/premium'); }} style={styles.premiumButton}>
                <Ionicons name="diamond" size={16} color={Colors.electricCyan} />
              </Pressable>
            </View>
          </Animated.View>
        </View>

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

        {/* Search Results / Recent Stations */}
        {(showSearch || recentStations.length > 0) && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.searchResults}>
            {!showSearch && recentStations.length > 0 && (
              <View style={styles.recentHeader}>
                <Ionicons name="time-outline" size={13} color={Colors.textTertiary} />
                <Text style={styles.recentLabel}>Recent Stations</Text>
              </View>
            )}
            {searchResults.length === 0 && showSearch ? (
              <Text style={styles.noResults}>No stations found</Text>
            ) : (
              searchResults.slice(0, 5).map((station) => (
                <Pressable
                  key={station.id}
                  style={({ pressed }) => [styles.searchResultItem, pressed && styles.pressed]}
                  onPress={() => handleStationPress(station.id)}
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

        {/* Proactive Banner */}
        {proactiveTip && (
          <Animated.View entering={FadeInUp.duration(400).delay(200)} style={styles.proactiveBanner}>
            <View style={[styles.proactiveIcon, { backgroundColor: proactiveTip.color + '20' }]}>
              <Ionicons name={proactiveTip.icon as 'warning'} size={18} color={proactiveTip.color} />
            </View>
            <Text style={[styles.proactiveText, { color: proactiveTip.color }]}>
              {proactiveTip.text}
            </Text>
            <Pressable onPress={() => { hapticLight(); setProactiveDismissed(true); }} style={styles.proactiveDismiss}>
              <Ionicons name="close" size={16} color={Colors.textTertiary} />
            </Pressable>
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
                <Ionicons name="warning" size={20} color={Colors.warning} />
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
            <View style={styles.etaCard}>
              {/* ETA glow orb */}
              <View style={styles.etaGlowOrb} />
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
            </View>
          </RNAnimated.View>
        </Animated.View>

        {/* Rail Engine Feature Strip — Neomorphic */}
        <Animated.View entering={FadeInDown.duration(500).delay(450)} style={styles.railEngineStrip}>
          <View style={styles.railEngineItem}>
            <View style={[styles.railEngineIcon, styles.neomorphicIcon]}>
              <Ionicons name="flash" size={14} color={Colors.lrt1} />
            </View>
            <Text style={styles.railEngineLabel}>2026 Rail{'\n'}Fare Engine</Text>
          </View>
          <View style={styles.railEngineDiv} />
          <View style={styles.railEngineItem}>
            <View style={[styles.railEngineIcon, styles.neomorphicIcon]}>
              <Ionicons name="cloud-done" size={14} color={Colors.supabaseGreen} />
            </View>
            <Text style={styles.railEngineLabel}>Live Cloud{'\n'}Sync</Text>
          </View>
          <View style={styles.railEngineDiv} />
          <View style={styles.railEngineItem}>
            <View style={[styles.railEngineIcon, styles.neomorphicIcon]}>
              <View style={[styles.railLineDot, { backgroundColor: Colors.lrt1, shadowColor: Colors.lrt1, shadowOpacity: 0.8, shadowRadius: 4, elevation: 4 }]} />
            </View>
            <Text style={styles.railEngineLabel}>LRT-1{'\n'}Yellow</Text>
          </View>
          <View style={styles.railEngineDiv} />
          <View style={styles.railEngineItem}>
            <View style={[styles.railEngineIcon, styles.neomorphicIcon]}>
              <View style={[styles.railLineDot, { backgroundColor: Colors.mrt3, shadowColor: Colors.mrt3, shadowOpacity: 0.8, shadowRadius: 4, elevation: 4 }]} />
            </View>
            <Text style={styles.railEngineLabel}>MRT-3{'\n'}Blue</Text>
          </View>
          <View style={styles.railEngineDiv} />
          <View style={styles.railEngineItem}>
            <View style={[styles.railEngineIcon, styles.neomorphicIcon]}>
              <View style={[styles.railLineDot, { backgroundColor: Colors.lrt2, shadowColor: Colors.lrt2, shadowOpacity: 0.8, shadowRadius: 4, elevation: 4 }]} />
            </View>
            <Text style={styles.railEngineLabel}>LRT-2{'\n'}Violet</Text>
          </View>
        </Animated.View>

        {/* Quick Actions — Neomorphic */}
        <Animated.View entering={FadeInDown.duration(500).delay(500)} style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(500).delay(600)} style={styles.quickActions}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.id}
              style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}
              onPress={() => handleQuickAction(action.route)}
            >
              {/* Inner shadow effect — neomorphic recessed */}
              <View style={styles.quickActionInner}>
                <View style={[styles.quickActionIcon, { backgroundColor: action.color + '18' }]}>
                  <Ionicons name={action.icon} size={24} color={action.color} />
                </View>
                <Text style={styles.quickActionTitle}>{action.title}</Text>
              </View>
            </Pressable>
          ))}
        </Animated.View>

        {/* Community Reports */}
        {(isLoadingData || communityReports.length > 0) && (
          <>
            <Animated.View entering={FadeInDown.duration(500).delay(700)} style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                {isLoadingData ? (
                  <Skeleton width={155} height={20} borderRadius={6} />
                ) : (
                  <>
                    <Text style={styles.sectionTitle}>Community Reports</Text>
                    <View style={styles.livePill}>
                      <View style={styles.livePillDot} />
                      <Text style={styles.livePillText}>LIVE</Text>
                    </View>
                  </>
                )}
              </View>
              {!isLoadingData && (
                <Pressable onPress={() => setShowReportModal(true)}>
                  <Text style={styles.seeAll}>+ Add</Text>
                </Pressable>
              )}
            </Animated.View>
            <Animated.View entering={FadeInDown.duration(500).delay(800)}>
              {isLoadingData ? (
                <>
                  <View style={[styles.reportCard, { opacity: 1 }]}>
                    <Skeleton width={40} height={40} borderRadius={12} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <Skeleton width="55%" height={13} borderRadius={5} />
                      <Skeleton width="80%" height={11} borderRadius={4} />
                    </View>
                  </View>
                  <View style={[styles.reportCard, { opacity: 1 }]}>
                    <Skeleton width={40} height={40} borderRadius={12} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <Skeleton width="45%" height={13} borderRadius={5} />
                      <Skeleton width="70%" height={11} borderRadius={4} />
                    </View>
                  </View>
                </>
              ) : communityReports.map((report) => {
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

        {/* Favorites */}
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
                  onPress={() => handleFavPress(fav.stationId)}
                >
                  <View style={styles.favIconContainer}>
                    <Ionicons
                      name={fav.label === 'home' ? 'home' : fav.label === 'work' ? 'briefcase' : 'star'}
                      size={18}
                      color={Colors.electricCyan}
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

        {/* Line Status — Glass Panels with Neon Lime Glow */}
        <Animated.View entering={FadeInDown.duration(500).delay(1000)} style={styles.sectionHeader}>
          {isLoadingData ? (
            <Skeleton width={110} height={20} borderRadius={6} />
          ) : (
            <Text style={styles.sectionTitle}>Line Status</Text>
          )}
          <View style={styles.liveDataRow}>
            <LiveDataBadge visible={isLiveData} compact />
          </View>
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(500).delay(1100)}>
          {isLoadingData ? (
            <>
              <StationCardSkeleton />
              <StationCardSkeleton />
              <StationCardSkeleton />
            </>
          ) : (
            ([
              { line: 'LRT-1', sub: 'Roosevelt – Baclaran · Yellow Line', color: Colors.lrt1 },
              { line: 'MRT-3', sub: 'North Ave – Taft Ave · Blue Line', color: Colors.mrt3 },
              { line: 'LRT-2', sub: 'Recto – Antipolo · Violet Line', color: Colors.lrt2 },
            ] as const).map(({ line, sub, color }) => (
              <Pressable
                key={line}
                style={({ pressed }) => [
                  styles.lineStatusCard,
                  { borderColor: color + '35', shadowColor: Colors.neonLime, shadowOpacity: 0.25, shadowRadius: 14 },
                  pressed && styles.pressed,
                ]}
                onPress={() => router.push('/(tabs)/stations')}
              >
                {/* Neon lime glow edge */}
                <View style={[styles.lineStatusGlow, { backgroundColor: color }]} />
                <View style={styles.lineStatusRow}>
                  <LineDot line={line} size={14} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineStatusName}>{line}</Text>
                    <Text style={[styles.lineStatusSub, { color }]}>{sub}</Text>
                  </View>
                  <Badge text="Normal" variant="success" small />
                  <View style={styles.lineStatusGlowDot}>
                    <View style={[styles.lineGlowCore, { backgroundColor: color }]} />
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </Animated.View>

        <View style={{ height: 120 }} />
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
            color={Colors.electricCyan}
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
  // Animated mesh gradient blobs
  meshBlob1: {
    position: 'absolute',
    top: -80,
    left: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(10,22,40,0.95)',
    opacity: 0.7,
  },
  meshBlob2: {
    position: 'absolute',
    top: 100,
    right: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0,15,35,0.85)',
    opacity: 0.5,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  // Dark header area
  headerArea: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  // Train refresh
  trainRefreshBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 32,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(64,224,255,0.08)',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.electricCyan + '30',
  },
  trainEmoji: {
    fontSize: 18,
  },
  trainTrack: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.electricCyan + '40',
    borderRadius: 2,
  },
  // Supabase connectivity
  supabaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  supabaseDotWrapper: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supabaseDotRing: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.supabaseGreen,
  },
  supabaseDotCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.supabaseGreen,
    shadowColor: Colors.supabaseGreen,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  supabaseLabel: {
    fontSize: FontSize.xs,
    color: Colors.supabaseGreen,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.2,
  },
  // Proactive Banner
  proactiveBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  proactiveIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  proactiveText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 18,
    fontWeight: FontWeight.medium,
  },
  proactiveDismiss: {
    padding: 2,
    flexShrink: 0,
  },
  // Recent stations
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  recentLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: FontWeight.medium,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  // Settings button
  settingsButton: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.full,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  appName: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.heavy,
    color: Colors.text,
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
    backgroundColor: 'rgba(64,224,255,0.10)',
    borderRadius: BorderRadius.full,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.electricCyan + '30',
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
    borderWidth: 1,
    borderColor: Colors.glassBorder,
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
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    ...Shadow.md,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
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
    opacity: 0.82,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,184,0,0.06)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.20)',
  },
  alertIconContainer: {
    backgroundColor: 'rgba(255,184,0,0.10)',
    borderRadius: BorderRadius.full,
    padding: Spacing.sm,
  },
  alertBannerContent: { flex: 1 },
  alertBannerTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.warning,
  },
  alertBannerDesc: {
    fontSize: FontSize.xs,
    color: Colors.amber,
    marginTop: 1,
    opacity: 0.8,
  },
  // ETA Card — dark glass with glow
  etaCard: {
    backgroundColor: 'rgba(64,224,255,0.07)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(64,224,255,0.25)',
    overflow: 'hidden',
    shadowColor: Colors.electricCyan,
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  etaGlowOrb: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.electricCyan,
    opacity: 0.04,
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
    backgroundColor: Colors.neonLime,
    shadowColor: Colors.neonLime,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  etaLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: 'rgba(255,255,255,0.7)',
  },
  etaTimeContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  etaTime: {
    fontSize: 52,
    fontWeight: FontWeight.heavy,
    color: Colors.text,
    letterSpacing: -2,
  },
  etaUnit: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.medium,
    color: 'rgba(255,255,255,0.5)',
  },
  etaSubtext: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.45)',
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
    backgroundColor: 'rgba(255,68,68,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.25)',
  },
  livePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.error,
    shadowColor: Colors.error,
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 2,
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
    color: Colors.electricCyan,
  },
  // Quick Actions — Neomorphic recessed
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  quickAction: {
    width: '30%',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    // Neomorphic outer shadow
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 2, height: 4 },
    elevation: 6,
  },
  quickActionInner: {
    backgroundColor: Colors.neomorphicBg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    // Inner shadow simulation via top/left highlight
    borderTopColor: 'rgba(255,255,255,0.06)',
    borderLeftColor: 'rgba(255,255,255,0.04)',
  },
  quickActionPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  quickActionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
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
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    ...Shadow.sm,
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
    borderColor: 'rgba(255,184,0,0.25)',
  },
  upvoteCount: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.amber,
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
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    ...Shadow.sm,
  },
  favIconContainer: {
    backgroundColor: 'rgba(64,224,255,0.10)',
    borderRadius: BorderRadius.full,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(64,224,255,0.20)',
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
  appNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  railTagline: {
    fontSize: FontSize.xs,
    color: Colors.electricCyan,
    fontWeight: FontWeight.semibold,
    marginTop: 1,
    letterSpacing: 0.2,
    opacity: 0.85,
  },
  liveDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Rail Engine Strip — Neomorphic
  railEngineStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neomorphicBg,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderTopColor: 'rgba(255,255,255,0.05)',
    ...Shadow.sm,
  },
  neomorphicIcon: {
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 2, height: 2 },
    elevation: 4,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  railEngineItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  railEngineIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  railLineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  railEngineLabel: {
    fontSize: 9,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 12,
  },
  railEngineDiv: {
    width: 1,
    height: 28,
    backgroundColor: Colors.glassBorder,
  },
  // Line Status Cards — Glass Panels with Neon Glow
  lineStatusCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.md,
    alignItems: 'center',
    elevation: 8,
  },
  lineStatusGlow: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.9,
  },
  lineStatusRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingLeft: Spacing.sm,
  },
  lineStatusName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  lineStatusSub: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    marginTop: 1,
  },
  lineStatusGlowDot: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineGlowCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
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
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
});
