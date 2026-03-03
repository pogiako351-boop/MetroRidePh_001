import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '@/constants/theme';
import { Station, LINE_COLORS } from '@/constants/stations';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

import { StationPicker } from '@/components/ui/StationPicker';
import { RouteVisual } from '@/components/ui/RouteVisual';
import { findRoutes } from '@/utils/routePlanner';
import { saveFavoriteRoute } from '@/utils/storage';
import { RouteResult } from '@/constants/fares';

export default function RoutePlannerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [fromStation, setFromStation] = useState<Station | null>(null);
  const [toStation, setToStation] = useState<Station | null>(null);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [planned, setPlanned] = useState(false);
  const [showStops, setShowStops] = useState(true);

  const handleSwap = useCallback(() => {
    const temp = fromStation;
    setFromStation(toStation);
    setToStation(temp);
    setPlanned(false);
    setRoutes([]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [fromStation, toStation]);

  const handlePlan = useCallback(() => {
    if (!fromStation || !toStation) return;
    const result = findRoutes(fromStation.id, toStation.id);
    setRoutes(result);
    setSelectedRouteIndex(0);
    setPlanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [fromStation, toStation]);

  const handleSaveRoute = useCallback(() => {
    if (!fromStation || !toStation) return;

    Alert.alert('Save Route', 'Choose a category for this route', [
      {
        text: 'Home Route',
        onPress: async () => {
          await saveFavoriteRoute({
            id: `${fromStation.id}-${toStation.id}-${Date.now()}`,
            fromStationId: fromStation.id,
            toStationId: toStation.id,
            label: 'home',
            addedAt: new Date().toISOString(),
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Saved!', 'Route saved to your favorites');
        },
      },
      {
        text: 'Work Route',
        onPress: async () => {
          await saveFavoriteRoute({
            id: `${fromStation.id}-${toStation.id}-${Date.now()}`,
            fromStationId: fromStation.id,
            toStationId: toStation.id,
            label: 'work',
            addedAt: new Date().toISOString(),
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Saved!', 'Route saved to your favorites');
        },
      },
      {
        text: 'Custom',
        onPress: async () => {
          await saveFavoriteRoute({
            id: `${fromStation.id}-${toStation.id}-${Date.now()}`,
            fromStationId: fromStation.id,
            toStationId: toStation.id,
            label: 'custom',
            addedAt: new Date().toISOString(),
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Saved!', 'Route saved to your favorites');
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [fromStation, toStation]);

  const canPlan = fromStation && toStation && fromStation.id !== toStation.id;
  const selectedRoute = routes[selectedRouteIndex];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.headerNav}>
        <Pressable style={styles.navButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Route Planner</Text>
        <View style={styles.navButton} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Station Selection */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.selectionCard}>
          <StationPicker
            label="Starting Station"
            selectedStation={fromStation}
            onSelect={(s) => { setFromStation(s); setPlanned(false); setRoutes([]); }}
            excludeStationId={toStation?.id}
          />

          <View style={styles.swapContainer}>
            <View style={styles.swapLine} />
            <Pressable style={styles.swapButton} onPress={handleSwap}>
              <Ionicons name="swap-vertical" size={20} color={Colors.primary} />
            </Pressable>
            <View style={styles.swapLine} />
          </View>

          <StationPicker
            label="Destination"
            selectedStation={toStation}
            onSelect={(s) => { setToStation(s); setPlanned(false); setRoutes([]); }}
            excludeStationId={fromStation?.id}
          />
        </Animated.View>

        {/* Plan Button */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <Pressable
            style={[styles.planButton, !canPlan && styles.planButtonDisabled]}
            onPress={handlePlan}
            disabled={!canPlan}
          >
            <Ionicons name="navigate" size={20} color={Colors.textOnPrimary} />
            <Text style={styles.planButtonText}>Plan My Route</Text>
          </Pressable>
        </Animated.View>

        {/* Results */}
        {planned && routes.length > 0 && selectedRoute && (
          <Animated.View entering={FadeInUp.duration(500)}>
            {/* Summary */}
            <Card style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <View style={styles.summaryMain}>
                  <Text style={styles.summaryFare}>₱{selectedRoute.totalFare}</Text>
                  <Text style={styles.summaryFareLabel}>Total Fare</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryMain}>
                  <Text style={styles.summaryTime}>{selectedRoute.totalTime} min</Text>
                  <Text style={styles.summaryFareLabel}>Travel Time</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryMain}>
                  <Text style={styles.summaryStations}>{selectedRoute.totalStations}</Text>
                  <Text style={styles.summaryFareLabel}>Stations</Text>
                </View>
              </View>

              {selectedRoute.transfers > 0 && (
                <View style={styles.transferNotice}>
                  <Ionicons name="swap-horizontal" size={14} color={Colors.primary} />
                  <Text style={styles.transferNoticeText}>
                    {selectedRoute.transfers} transfer{selectedRoute.transfers > 1 ? 's' : ''} required • ~8 min per transfer
                  </Text>
                </View>
              )}
            </Card>

            {/* Route Options */}
            {routes.length > 1 && (
              <View style={styles.routeOptions}>
                <Text style={styles.routeOptionsTitle}>Available Routes</Text>
                {routes.map((route, index) => (
                  <Pressable
                    key={index}
                    style={[
                      styles.routeOption,
                      selectedRouteIndex === index && styles.routeOptionActive,
                    ]}
                    onPress={() => setSelectedRouteIndex(index)}
                  >
                    <View style={styles.routeOptionLeft}>
                      <View style={styles.routeOptionLines}>
                        {route.segments.map((seg, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && (
                              <Ionicons name="arrow-forward" size={10} color={Colors.textTertiary} />
                            )}
                            <View style={[styles.routeOptionLineDot, { backgroundColor: LINE_COLORS[seg.line] }]}>
                              <Text style={styles.routeOptionLineText}>{seg.line}</Text>
                            </View>
                          </React.Fragment>
                        ))}
                      </View>
                    </View>
                    <View style={styles.routeOptionRight}>
                      <Text style={styles.routeOptionFare}>₱{route.totalFare}</Text>
                      <Text style={styles.routeOptionTime}>{route.totalTime} min</Text>
                    </View>
                    {route.isCheapest && (
                      <Badge text="Best" variant="success" small />
                    )}
                  </Pressable>
                ))}
              </View>
            )}

            {/* Visual Route Map */}
            <Card style={styles.routeMapCard}>
              <View style={styles.routeMapHeader}>
                <Text style={styles.routeMapTitle}>Detailed Route</Text>
                <Pressable
                  style={styles.toggleStops}
                  onPress={() => setShowStops(!showStops)}
                >
                  <Ionicons
                    name={showStops ? 'eye' : 'eye-off'}
                    size={16}
                    color={Colors.primary}
                  />
                  <Text style={styles.toggleStopsText}>
                    {showStops ? 'Hide' : 'Show'} stops
                  </Text>
                </Pressable>
              </View>
              <RouteVisual route={selectedRoute} showStops={showStops} />
            </Card>

            {/* Walking instructions for transfers */}
            {selectedRoute.transfers > 0 && (
              <Card style={styles.walkingCard}>
                <View style={styles.walkingHeader}>
                  <Ionicons name="walk-outline" size={20} color={Colors.primary} />
                  <Text style={styles.walkingTitle}>Transfer Instructions</Text>
                </View>
                {selectedRoute.segments.slice(0, -1).map((seg, i) => (
                  <View key={i} style={styles.walkingStep}>
                    <View style={styles.walkingStepNumber}>
                      <Text style={styles.walkingStepNumberText}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.walkingStepText}>
                        Alight at <Text style={styles.walkingBold}>{seg.to}</Text> ({seg.line})
                      </Text>
                      <Text style={styles.walkingStepDesc}>
                        Follow signs to {selectedRoute.segments[i + 1].line}. Walk ~3-5 min to the connecting platform.
                      </Text>
                    </View>
                  </View>
                ))}
              </Card>
            )}

            {/* Save Route */}
            <View style={styles.saveRow}>
              <Pressable
                style={styles.saveButton}
                onPress={handleSaveRoute}
              >
                <Ionicons name="heart-outline" size={20} color={Colors.primary} />
                <Text style={styles.saveButtonText}>Save to Favorites</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {planned && routes.length === 0 && (
          <Animated.View entering={FadeInUp.duration(500)}>
            <View style={styles.noRoutes}>
              <Ionicons name="alert-circle-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.noRoutesText}>No route found between these stations</Text>
              <Text style={styles.noRoutesSubtext}>
                These stations may not be connected via the current rail network
              </Text>
            </View>
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.sm,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl * 2,
  },
  selectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadow.md,
  },
  swapContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  swapLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  swapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.xl,
    ...Shadow.md,
  },
  planButtonDisabled: {
    backgroundColor: Colors.textTertiary,
    opacity: 0.6,
  },
  planButtonText: {
    color: Colors.textOnPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  summaryCard: {
    marginBottom: Spacing.lg,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryMain: {
    flex: 1,
    alignItems: 'center',
  },
  summaryFare: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.heavy,
    color: Colors.primary,
  },
  summaryTime: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.heavy,
    color: Colors.text,
  },
  summaryStations: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.heavy,
    color: Colors.text,
  },
  summaryFareLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },
  transferNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  transferNoticeText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  routeOptions: {
    marginBottom: Spacing.lg,
  },
  routeOptionsTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  routeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  routeOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  routeOptionLeft: {
    flex: 1,
  },
  routeOptionLines: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  routeOptionLineDot: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  routeOptionLineText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textOnPrimary,
  },
  routeOptionRight: {
    alignItems: 'flex-end',
  },
  routeOptionFare: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  routeOptionTime: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  routeMapCard: {
    marginBottom: Spacing.lg,
  },
  routeMapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  routeMapTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  toggleStops: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  toggleStopsText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  walkingCard: {
    marginBottom: Spacing.lg,
    backgroundColor: 'rgba(64,224,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(64,224,255,0.18)',
  },
  walkingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  walkingTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  walkingStep: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  walkingStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walkingStepNumberText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textOnPrimary,
  },
  walkingStepText: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 22,
  },
  walkingBold: {
    fontWeight: FontWeight.semibold,
  },
  walkingStepDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  saveRow: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  saveButtonText: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  noRoutes: {
    alignItems: 'center',
    paddingTop: 40,
    gap: Spacing.sm,
  },
  noRoutesText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  noRoutesSubtext: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
});
