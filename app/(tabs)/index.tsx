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
import { frecencySearch, recordStationVisit, getRecentStations } from '@/utils/frecency';
import { hapticLight, hapticMedium, hapticSuccess, hapticDoubleTap } from '@/utils/haptics';
import { useTransitDataSync } from '@/utils/transitDataSync';
import LiveDataBadge from '@/components/ui/LiveDataBadge';

const QUICK_ACTIONS = [
  { id: 'ai', title: 'MetroAI\nAssistant', icon: 'chatbubbles-outline' as const, color: Colors.violet, route: '/metro-ai' },
  { id: 'map', title: 'System\nMap', icon: 'map-outline' as const, color: Colors.primary, route: '/transit-map' },
  { id: 'fare', title: 'Fare\nCalculator', icon: 'calculator-outline' as const, color: '#34A853', route: '/fare-calculator' },
  { id: 'route', title: 'Route\nPlanner', icon: 'navigate-outline' as const, color: '#9C27B0', route: '/route-planner' },
  { id: 'insights', title: 'My\nInsights', icon: 'stats-chart-outline' as const, color: Colors.amber, route: '/insights' },
  { id: 'beep', title: 'Beep\nCard', icon: 'card-outline' as const, color: '#059669', route: '/beep-card' },
  { id: 'alerts', title: 'Live\nAlerts', icon: 'notifications-outline' as const, color: '#EA4335', route: '/(tabs)/alerts' },
  { id: 'settings', title: 'Settings', icon: 'settings-outline' as const, color: Colors.textSecondary, route: '/settings' },
  { id: 'premium', title: 'Go\nPremium', icon: 'diamond-outline' as const, color: Colors.violetDark, route: '/premium' },
];

/** Returns a tinted header background based on current hour */
function getTimeOfDayTint(hour: number): { bg: string; label: string; emoji: string } {
  if (hour >= 5 && hour < 11) return { bg: '#EBF3FE', label: 'Good Morning', emoji: '🌅' };
  if (hour >= 11 && hour < 16) return { bg: '#F8F9FA', label: 'Good Afternoon', emoji: '☀️' };
  if (hour >= 16 && hour < 20) return { bg: '#FEF3C7', label: 'Good Evening', emoji: '🌇' };
  return { bg: '#E8EEF9', label: 'Good Night', emoji: '🌙' };
}

/** Contextual proactive tips based on time/conditions */
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
  const alerts = generateMockAlerts();
  const criticalAlerts = alerts.filter((a) => a.severity === 'warning' || a.severity === 'critical');
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;
  const reportPulseAnims = useRef<RNAnimated.Value[]>([]).current;
  const fabOverlayOpacity = useRef(new RNAnimated.Value(0)).current;
  const trainRefreshAnim = useRef(new RNAnimated.Value(-60)).current;

  const hour = currentTime.getHours();
  const timeTint = getTimeOfDayTint(hour);
  const proactiveTip = proactiveDismissed ? null : getProactiveTip(hour, criticalAlerts.length > 0);

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
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    hapticMedium();
    setRefreshing(true);
    // Train animation across screen
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
      // Show recent stations as suggestions when empty
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
            tintColor={Colors.primary}
            title="Refreshing..."
            titleColor={Colors.textTertiary}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Time-based tinted header area */}
        <View style={[styles.headerTint, { backgroundColor: timeTint.bg }]}>
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(500).delay(100)} style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.appNameRow}>
                <Text style={styles.appName}>MetroRide PH</Text>
                <LiveDataBadge visible={isLiveData} lastSync={lastSync} compact />
              </View>
              <Text style={styles.railTagline}>Elite Rail Engine · LRT-1 · MRT-3 · LRT-2</Text>
              <Text style={styles.dateText}>{timeTint.emoji} {formatDate(currentTime)}</Text>
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
                <Ionicons name="diamond" size={16} color={Colors.gold} />
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

        {/* Proactive Suggestions Banner */}
        {proactiveTip && (
          <Animated.View entering={FadeInUp.duration(400).delay(200)} style={styles.proactiveBanner}>
            <View style={[styles.proactiveIcon, { backgroundColor: proactiveTip.color + '20' }]}>
              <Ionicons name={proactiveTip.icon as 'warning'} size={18} color={proactiveTip.color} />
            </View>
            <Text style={[styles.proactiveText, { color: proactiveTip.color === Colors.warning ? '#92400E' : proactiveTip.color }]}>
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

        {/* Rail Engine Feature Strip */}
        <Animated.View entering={FadeInDown.duration(500).delay(450)} style={styles.railEngineStrip}>
          <View style={styles.railEngineItem}>
            <View style={[styles.railEngineIcon, { backgroundColor: 'rgba(245,197,0,0.15)' }]}>
              <Ionicons name="flash" size={14} color="#F5C500" />
            </View>
            <Text style={styles.railEngineLabel}>2026 Rail{'\n'}Fare Engine</Text>
          </View>
          <View style={styles.railEngineDiv} />
          <View style={styles.railEngineItem}>
            <View style={[styles.railEngineIcon, { backgroundColor: 'rgba(52,168,83,0.15)' }]}>
              <Ionicons name="cloud-done" size={14} color="#34A853" />
            </View>
            <Text style={styles.railEngineLabel}>Live Cloud{'\n'}Sync</Text>
          </View>
          <View style={styles.railEngineDiv} />
          <View style={styles.railEngineItem}>
            <View style={[styles.railEngineIcon, { backgroundColor: 'rgba(245,197,0,0.15)' }]}>
              <View style={[styles.railLineDot, { backgroundColor: '#F5C500' }]} />
            </View>
            <Text style={styles.railEngineLabel}>LRT-1{'\n'}Yellow</Text>
          </View>
          <View style={styles.railEngineDiv} />
          <View style={styles.railEngineItem}>
            <View style={[styles.railEngineIcon, { backgroundColor: 'rgba(17,67,168,0.15)' }]}>
              <View style={[styles.railLineDot, { backgroundColor: '#1143A8' }]} />
            </View>
            <Text style={styles.railEngineLabel}>MRT-3{'\n'}Blue</Text>
          </View>
          <View style={styles.railEngineDiv} />
          <View style={styles.railEngineItem}>
            <View style={[styles.railEngineIcon, { backgroundColor: 'rgba(156,39,176,0.15)' }]}>
              <View style={[styles.railLineDot, { backgroundColor: '#9C27B0' }]} />
            </View>
            <Text style={styles.railEngineLabel}>LRT-2{'\n'}Violet</Text>
          </View>
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
              onPress={() => handleQuickAction(action.route)}
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
                  onPress={() => handleFavPress(fav.stationId)}
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
          <View style={styles.liveDataRow}>
            <LiveDataBadge visible={isLiveData} compact />
          </View>
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(500).delay(1100)}>
          {([
            { line: 'LRT-1', sub: 'Roosevelt – Baclaran · Yellow Line', color: '#F5C500' },
            { line: 'MRT-3', sub: 'North Ave – Taft Ave · Blue Line', color: '#1143A8' },
            { line: 'LRT-2', sub: 'Recto – Antipolo · Violet Line', color: '#9C27B0' },
          ] as const).map(({ line, sub, color }) => (
            <Card key={line} style={styles.lineStatusCard} onPress={() => router.push('/(tabs)/stations')}>
              <View style={styles.lineStatusRow}>
                <LineDot line={line} size={14} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineStatusName}>{line}</Text>
                  <Text style={[styles.lineStatusSub, { color }]}>{sub}</Text>
                </View>
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
  // Time-based header tint
  headerTint: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  // Train refresh bar
  trainRefreshBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 32,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  trainEmoji: {
    fontSize: 18,
  },
  trainTrack: {
    flex: 1,
    height: 3,
    backgroundColor: Colors.primary + '40',
    borderRadius: 2,
  },
  // Proactive Banner
  proactiveBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadow.sm,
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
  // Recent search labels
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
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
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.full,
    padding: Spacing.sm,
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
  appNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  railTagline: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
    marginTop: 1,
    letterSpacing: 0.2,
  },
  liveDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Rail Engine Feature Strip
  railEngineStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.lg,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
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
    backgroundColor: Colors.borderLight,
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
  lineStatusSub: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    marginTop: 1,
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
