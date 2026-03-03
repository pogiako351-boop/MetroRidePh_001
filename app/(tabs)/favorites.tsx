import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LineDot } from '@/components/ui/LineDot';
import {
  getFavoriteStations,
  getFavoriteRoutes,
  removeFavoriteStation,
  removeFavoriteRoute,
  FavoriteStation,
  FavoriteRoute,
} from '@/utils/storage';
import { LINE_COLORS, getStationById } from '@/constants/stations';

type TabView = 'stations' | 'routes';

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabView>('stations');
  const [favStations, setFavStations] = useState<FavoriteStation[]>([]);
  const [favRoutes, setFavRoutes] = useState<FavoriteRoute[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const stations = await getFavoriteStations();
    const routes = await getFavoriteRoutes();
    setFavStations(stations);
    setFavRoutes(routes);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleRemoveStation = useCallback(
    (stationId: string, stationName: string) => {
      Alert.alert(
        'Remove Favorite',
        `Remove ${stationName} from your favorites?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              await removeFavoriteStation(stationId);
              await loadData();
            },
          },
        ]
      );
    },
    [loadData]
  );

  const handleRemoveRoute = useCallback(
    (routeId: string) => {
      Alert.alert('Remove Route', 'Remove this saved route?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeFavoriteRoute(routeId);
            await loadData();
          },
        },
      ]);
    },
    [loadData]
  );

  const getLabelIcon = (label: string): keyof typeof Ionicons.glyphMap => {
    switch (label) {
      case 'home':
        return 'home';
      case 'work':
        return 'briefcase';
      default:
        return 'star';
    }
  };

  const getLabelColor = (label: string) => {
    switch (label) {
      case 'home':
        return Colors.primary;
      case 'work':
        return '#34A853';
      default:
        return Colors.gold;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Favorites</Text>
        <Text style={styles.headerSubtitle}>
          {favStations.length} stations · {favRoutes.length} routes
        </Text>
      </View>

      {/* Tab Toggle */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'stations' && styles.tabActive]}
          onPress={() => setActiveTab('stations')}
        >
          <Ionicons
            name="train"
            size={16}
            color={activeTab === 'stations' ? Colors.electricCyan : Colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'stations' && styles.tabTextActive]}>
            Stations
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'routes' && styles.tabActive]}
          onPress={() => setActiveTab('routes')}
        >
          <Ionicons
            name="map"
            size={16}
            color={activeTab === 'routes' ? Colors.electricCyan : Colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'routes' && styles.tabTextActive]}>
            Routes
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
        {activeTab === 'stations' ? (
          <>
            {favStations.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="heart-outline" size={56} color={Colors.textTertiary} />
                <Text style={styles.emptyTitle}>No Favorite Stations</Text>
                <Text style={styles.emptySubtext}>
                  Tap the heart icon on any station to save it here
                </Text>
                <Pressable
                  style={styles.exploreButton}
                  onPress={() => router.push('/(tabs)/stations')}
                >
                  <Text style={styles.exploreButtonText}>Browse Stations</Text>
                </Pressable>
              </View>
            ) : (
              favStations.map((fav, index) => {
                const station = getStationById(fav.stationId);
                if (!station) return null;
                const labelColor = getLabelColor(fav.label);
                return (
                  <Animated.View key={fav.stationId} entering={FadeInDown.duration(400).delay(index * 60)}>
                    <Pressable
                      style={({ pressed }) => [styles.favCard, pressed && styles.pressed]}
                      onPress={() => router.push(`/station/${station.id}`)}
                    >
                      <View style={[styles.lineStrip, { backgroundColor: LINE_COLORS[station.line] }]} />
                      <View style={styles.favContent}>
                        <View style={styles.favTop}>
                          <View style={[styles.labelIcon, { backgroundColor: labelColor + '15' }]}>
                            <Ionicons name={getLabelIcon(fav.label)} size={16} color={labelColor} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.favName}>{station.name}</Text>
                            <View style={styles.favMeta}>
                              <LineDot line={station.line} size={8} />
                              <Text style={styles.favLine}>{station.line}</Text>
                              <Text style={styles.favDot}>·</Text>
                              <Text style={styles.favLabel}>
                                {fav.label === 'custom' && fav.customLabel
                                  ? fav.customLabel
                                  : fav.label.charAt(0).toUpperCase() + fav.label.slice(1)}
                              </Text>
                            </View>
                          </View>
                          <Pressable
                            onPress={() => handleRemoveStation(fav.stationId, station.name)}
                            hitSlop={8}
                            style={styles.removeBtn}
                          >
                            <Ionicons name="heart" size={20} color={Colors.error} />
                          </Pressable>
                        </View>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })
            )}
          </>
        ) : (
          <>
            {favRoutes.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="map-outline" size={56} color={Colors.textTertiary} />
                <Text style={styles.emptyTitle}>No Saved Routes</Text>
                <Text style={styles.emptySubtext}>
                  Plan a route and save it for quick access
                </Text>
                <Pressable
                  style={styles.exploreButton}
                  onPress={() => router.push('/route-planner')}
                >
                  <Text style={styles.exploreButtonText}>Plan a Route</Text>
                </Pressable>
              </View>
            ) : (
              favRoutes.map((route, index) => {
                const fromStation = getStationById(route.fromStationId);
                const toStation = getStationById(route.toStationId);
                if (!fromStation || !toStation) return null;
                const labelColor = getLabelColor(route.label);
                return (
                  <Animated.View key={route.id} entering={FadeInRight.duration(400).delay(index * 60)}>
                    <Card style={styles.routeCard}>
                      <View style={styles.routeHeader}>
                        <View style={[styles.labelIcon, { backgroundColor: labelColor + '15' }]}>
                          <Ionicons name={getLabelIcon(route.label)} size={16} color={labelColor} />
                        </View>
                        <Text style={styles.routeLabel}>
                          {route.label === 'custom' && route.customLabel
                            ? route.customLabel
                            : route.label.charAt(0).toUpperCase() + route.label.slice(1) + ' Route'}
                        </Text>
                        <Pressable
                          onPress={() => handleRemoveRoute(route.id)}
                          hitSlop={8}
                          style={styles.removeBtn}
                        >
                          <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
                        </Pressable>
                      </View>
                      <View style={styles.routeStations}>
                        <View style={styles.routeStationRow}>
                          <LineDot line={fromStation.line} size={10} />
                          <Text style={styles.routeStationName}>{fromStation.name}</Text>
                          <Badge text={fromStation.line} variant={fromStation.line === 'MRT-3' ? 'mrt3' : fromStation.line === 'LRT-1' ? 'lrt1' : 'lrt2'} small />
                        </View>
                        <View style={styles.routeArrow}>
                          <Ionicons name="arrow-down" size={16} color={Colors.textTertiary} />
                        </View>
                        <View style={styles.routeStationRow}>
                          <LineDot line={toStation.line} size={10} />
                          <Text style={styles.routeStationName}>{toStation.name}</Text>
                          <Badge text={toStation.line} variant={toStation.line === 'MRT-3' ? 'mrt3' : toStation.line === 'LRT-1' ? 'lrt1' : 'lrt2'} small />
                        </View>
                      </View>
                    </Card>
                  </Animated.View>
                );
              })
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
  headerTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.heavy,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: 4,
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
  favCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  pressed: {
    opacity: 0.9,
  },
  lineStrip: {
    width: 4,
  },
  favContent: {
    flex: 1,
    padding: Spacing.md,
  },
  favTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  labelIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: 2,
  },
  favMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  favLine: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  favDot: {
    color: Colors.textTertiary,
    fontSize: FontSize.xs,
  },
  favLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  removeBtn: {
    padding: 4,
  },
  routeCard: {
    marginBottom: Spacing.md,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  routeLabel: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  routeStations: {
    gap: Spacing.xs,
  },
  routeStationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  routeStationName: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.text,
  },
  routeArrow: {
    paddingLeft: 3,
    paddingVertical: 2,
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
    textAlign: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  exploreButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.lg,
  },
  exploreButtonText: {
    color: '#08090A',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
});
