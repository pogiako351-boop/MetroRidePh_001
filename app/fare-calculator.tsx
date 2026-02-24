import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '@/constants/theme';
import { Station } from '@/constants/stations';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StationPicker } from '@/components/ui/StationPicker';
import { RouteVisual } from '@/components/ui/RouteVisual';
import { findRoutes } from '@/utils/routePlanner';
import { RouteResult } from '@/constants/fares';

export default function FareCalculatorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [fromStation, setFromStation] = useState<Station | null>(null);
  const [toStation, setToStation] = useState<Station | null>(null);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [calculated, setCalculated] = useState(false);

  const handleSwap = useCallback(() => {
    const temp = fromStation;
    setFromStation(toStation);
    setToStation(temp);
    setCalculated(false);
    setRoutes([]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [fromStation, toStation]);

  const handleCalculate = useCallback(() => {
    if (!fromStation || !toStation) return;
    const result = findRoutes(fromStation.id, toStation.id);
    setRoutes(result);
    setSelectedRouteIndex(0);
    setCalculated(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [fromStation, toStation]);

  const canCalculate = fromStation && toStation && fromStation.id !== toStation.id;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.headerNav}>
        <Pressable style={styles.navButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Fare Calculator</Text>
        <View style={styles.navButton} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Station Selection */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.selectionCard}>
          <StationPicker
            label="From"
            selectedStation={fromStation}
            onSelect={(s) => { setFromStation(s); setCalculated(false); setRoutes([]); }}
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
            label="To"
            selectedStation={toStation}
            onSelect={(s) => { setToStation(s); setCalculated(false); setRoutes([]); }}
            excludeStationId={fromStation?.id}
          />
        </Animated.View>

        {/* Calculate Button */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <Pressable
            style={[styles.calculateButton, !canCalculate && styles.calculateButtonDisabled]}
            onPress={handleCalculate}
            disabled={!canCalculate}
          >
            <Ionicons name="calculator" size={20} color={Colors.textOnPrimary} />
            <Text style={styles.calculateButtonText}>Calculate Fare</Text>
          </Pressable>
        </Animated.View>

        {/* Results */}
        {calculated && routes.length > 0 && (
          <Animated.View entering={FadeInUp.duration(500)}>
            {/* Fare Summary */}
            <Card style={styles.fareCard}>
              <View style={styles.fareHeader}>
                <Text style={styles.fareLabel}>Total Fare</Text>
                {routes[selectedRouteIndex].isCheapest && (
                  <Badge text="Cheapest" variant="success" small />
                )}
              </View>
              <View style={styles.fareAmount}>
                <Text style={styles.fareCurrency}>₱</Text>
                <Text style={styles.fareValue}>{routes[selectedRouteIndex].totalFare}</Text>
              </View>
              <View style={styles.fareStats}>
                <View style={styles.fareStat}>
                  <Ionicons name="time-outline" size={16} color={Colors.primary} />
                  <Text style={styles.fareStatText}>
                    ~{routes[selectedRouteIndex].totalTime} min
                  </Text>
                </View>
                <View style={styles.fareStatDivider} />
                <View style={styles.fareStat}>
                  <Ionicons name="train-outline" size={16} color={Colors.primary} />
                  <Text style={styles.fareStatText}>
                    {routes[selectedRouteIndex].totalStations} stations
                  </Text>
                </View>
                {routes[selectedRouteIndex].transfers > 0 && (
                  <>
                    <View style={styles.fareStatDivider} />
                    <View style={styles.fareStat}>
                      <Ionicons name="swap-horizontal" size={16} color={Colors.primary} />
                      <Text style={styles.fareStatText}>
                        {routes[selectedRouteIndex].transfers} transfer{routes[selectedRouteIndex].transfers > 1 ? 's' : ''}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </Card>

            {/* Route Options */}
            {routes.length > 1 && (
              <View style={styles.routeOptions}>
                <Text style={styles.routeOptionsTitle}>Route Options</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.routeOptionsList}>
                    {routes.map((route, index) => (
                      <Pressable
                        key={index}
                        style={[
                          styles.routeOptionChip,
                          selectedRouteIndex === index && styles.routeOptionChipActive,
                        ]}
                        onPress={() => setSelectedRouteIndex(index)}
                      >
                        <Text
                          style={[
                            styles.routeOptionText,
                            selectedRouteIndex === index && styles.routeOptionTextActive,
                          ]}
                        >
                          ₱{route.totalFare} · {route.totalTime}min
                          {route.transfers > 0 ? ` · ${route.transfers}T` : ''}
                        </Text>
                        {route.isCheapest && (
                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color={
                              selectedRouteIndex === index ? Colors.textOnPrimary : Colors.success
                            }
                          />
                        )}
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Route Visual */}
            <Card style={styles.routeCard}>
              <Text style={styles.routeCardTitle}>Step-by-Step Route</Text>
              <RouteVisual route={routes[selectedRouteIndex]} showStops />
            </Card>
          </Animated.View>
        )}

        {calculated && routes.length === 0 && (
          <Animated.View entering={FadeInUp.duration(500)}>
            <View style={styles.noRoutes}>
              <Ionicons name="alert-circle-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.noRoutesText}>No route found between these stations</Text>
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
  calculateButton: {
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
  calculateButtonDisabled: {
    backgroundColor: Colors.textTertiary,
    opacity: 0.6,
  },
  calculateButtonText: {
    color: Colors.textOnPrimary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  fareCard: {
    backgroundColor: Colors.primary,
    marginBottom: Spacing.lg,
  },
  fareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  fareLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: 'rgba(255,255,255,0.7)',
  },
  fareAmount: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.md,
  },
  fareCurrency: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: 'rgba(255,255,255,0.8)',
    marginRight: 4,
  },
  fareValue: {
    fontSize: 56,
    fontWeight: FontWeight.heavy,
    color: Colors.textOnPrimary,
    letterSpacing: -2,
  },
  fareStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  fareStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  fareStatText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: 'rgba(255,255,255,0.9)',
  },
  fareStatDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
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
  routeOptionsList: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  routeOptionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  routeOptionChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  routeOptionText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  routeOptionTextActive: {
    color: Colors.textOnPrimary,
  },
  routeCard: {
    marginBottom: Spacing.lg,
  },
  routeCardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  noRoutes: {
    alignItems: 'center',
    paddingTop: 40,
    gap: Spacing.md,
  },
  noRoutesText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
