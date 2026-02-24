import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Animated as RNAnimated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, FadeIn, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '@/constants/theme';
import { Station } from '@/constants/stations';
import { Card } from '@/components/ui/Card';
import { StationPicker } from '@/components/ui/StationPicker';
import { RouteVisual } from '@/components/ui/RouteVisual';
import { findRoutes } from '@/utils/routePlanner';
import {
  RouteResult,
  TicketType,
  PassengerProfile,
  TICKET_TYPES,
  PASSENGER_PROFILES,
  computeFareBreakdown,
  FareBreakdown,
  SJT_SURCHARGE,
} from '@/constants/fares';

// ─── LRT-2 Colour ─────────────────────────────────────────────────────────────
const LRT2_COLOR = '#9C27B0';

// ─── SegmentedToggle ──────────────────────────────────────────────────────────
interface SegmentedToggleProps {
  value: TicketType;
  onChange: (v: TicketType) => void;
}

function SegmentedToggle({ value, onChange }: SegmentedToggleProps) {
  return (
    <View style={toggleStyles.container}>
      {TICKET_TYPES.map((t) => {
        const active = value === t.id;
        return (
          <Pressable
            key={t.id}
            style={[toggleStyles.segment, active && toggleStyles.segmentActive]}
            onPress={() => {
              if (!active) {
                onChange(t.id);
                Haptics.selectionAsync();
              }
            }}
          >
            <Ionicons
              name={(t.icon + (active ? '' : '-outline')) as never}
              size={15}
              color={active ? Colors.textOnPrimary : Colors.textSecondary}
            />
            <Text style={[toggleStyles.label, active && toggleStyles.labelActive]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const toggleStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: BorderRadius.md,
  },
  segmentActive: {
    backgroundColor: Colors.primary,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  labelActive: {
    color: Colors.textOnPrimary,
  },
});

// ─── PassengerSelector ────────────────────────────────────────────────────────
interface PassengerSelectorProps {
  value: PassengerProfile;
  onChange: (v: PassengerProfile) => void;
}

function PassengerSelector({ value, onChange }: PassengerSelectorProps) {
  return (
    <View style={psStyles.row}>
      {PASSENGER_PROFILES.map((p) => {
        const active = value === p.id;
        return (
          <Pressable
            key={p.id}
            style={[psStyles.pill, active && psStyles.pillActive]}
            onPress={() => {
              if (!active) {
                onChange(p.id);
                Haptics.selectionAsync();
              }
            }}
          >
            <Ionicons
              name={p.icon as never}
              size={14}
              color={active ? LRT2_COLOR : Colors.textSecondary}
            />
            <Text style={[psStyles.label, active && psStyles.labelActive]}>{p.label}</Text>
            {p.discountRate > 0 && (
              <View style={[psStyles.badge, active && psStyles.badgeActive]}>
                <Text style={[psStyles.badgeText, active && psStyles.badgeTextActive]}>
                  -{Math.round(p.discountRate * 100)}%
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const psStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  pillActive: {
    borderColor: LRT2_COLOR,
    backgroundColor: '#F3E5F5',
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  labelActive: {
    color: LRT2_COLOR,
  },
  badge: {
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeActive: {
    backgroundColor: LRT2_COLOR,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  badgeTextActive: {
    color: Colors.textOnPrimary,
  },
});

// ─── FareReceiptCard ──────────────────────────────────────────────────────────
interface FareReceiptCardProps {
  breakdown: FareBreakdown;
  isCheapest: boolean;
  totalTime: number;
  totalStations: number;
  transfers: number;
}

function FareReceiptCard({
  breakdown,
  isCheapest,
  totalTime,
  totalStations,
  transfers,
}: FareReceiptCardProps) {
  const { baseFare, sjtSurcharge, discountAmount, finalFare, ticketType, passengerProfile } =
    breakdown;
  const profileInfo = PASSENGER_PROFILES.find((p) => p.id === passengerProfile)!;
  const showSJT = sjtSurcharge > 0;
  const showDiscount = discountAmount > 0;

  return (
    <Animated.View entering={ZoomIn.springify().damping(14).stiffness(120)}>
      <View style={receiptStyles.outer}>
        {/* Header strip */}
        <View style={receiptStyles.header}>
          <View style={receiptStyles.headerLeft}>
            <Ionicons name="receipt" size={18} color={Colors.textOnPrimary} />
            <Text style={receiptStyles.headerTitle}>Fare Receipt</Text>
          </View>
          <View style={receiptStyles.headerRight}>
            {isCheapest && (
              <View style={receiptStyles.bestBadge}>
                <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                <Text style={receiptStyles.bestBadgeText}>Cheapest</Text>
              </View>
            )}
            <View style={receiptStyles.ticketBadge}>
              <Text style={receiptStyles.ticketBadgeText}>
                {ticketType === 'beep' ? '💳 Beep Card' : '🎫 SJT'}
              </Text>
            </View>
          </View>
        </View>

        {/* Perforated divider */}
        <View style={receiptStyles.perforatedRow}>
          <View style={receiptStyles.perf} />
          <View style={receiptStyles.perfDash} />
          <View style={receiptStyles.perf} />
        </View>

        {/* Stats row */}
        <View style={receiptStyles.statsRow}>
          <View style={receiptStyles.stat}>
            <Ionicons name="time-outline" size={14} color={Colors.textTertiary} />
            <Text style={receiptStyles.statText}>~{totalTime} min</Text>
          </View>
          <View style={receiptStyles.statDot} />
          <View style={receiptStyles.stat}>
            <Ionicons name="train-outline" size={14} color={Colors.textTertiary} />
            <Text style={receiptStyles.statText}>{totalStations} stations</Text>
          </View>
          {transfers > 0 && (
            <>
              <View style={receiptStyles.statDot} />
              <View style={receiptStyles.stat}>
                <Ionicons name="swap-horizontal" size={14} color={Colors.textTertiary} />
                <Text style={receiptStyles.statText}>
                  {transfers} transfer{transfers > 1 ? 's' : ''}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Line items */}
        <View style={receiptStyles.lineItems}>
          {/* Base fare */}
          <View style={receiptStyles.lineItem}>
            <View style={receiptStyles.lineItemLeft}>
              <View style={[receiptStyles.lineItemDot, { backgroundColor: Colors.primary }]} />
              <Text style={receiptStyles.lineItemLabel}>Base Fare</Text>
            </View>
            <Text style={receiptStyles.lineItemAmount}>₱{baseFare.toFixed(2)}</Text>
          </View>

          {/* SJT surcharge */}
          {showSJT && (
            <View style={receiptStyles.lineItem}>
              <View style={receiptStyles.lineItemLeft}>
                <View
                  style={[receiptStyles.lineItemDot, { backgroundColor: Colors.warning }]}
                />
                <Text style={receiptStyles.lineItemLabel}>SJT Surcharge</Text>
              </View>
              <Text style={[receiptStyles.lineItemAmount, { color: Colors.warning }]}>
                +₱{sjtSurcharge.toFixed(2)}
              </Text>
            </View>
          )}

          {/* Discount */}
          {showDiscount && (
            <View style={receiptStyles.lineItem}>
              <View style={receiptStyles.lineItemLeft}>
                <View
                  style={[receiptStyles.lineItemDot, { backgroundColor: Colors.success }]}
                />
                <Text style={receiptStyles.lineItemLabel}>
                  {profileInfo.label} Discount (
                  {Math.round(profileInfo.discountRate * 100)}%)
                </Text>
              </View>
              <Text style={[receiptStyles.lineItemAmount, { color: Colors.success }]}>
                −₱{discountAmount.toFixed(2)}
              </Text>
            </View>
          )}

          {/* Divider */}
          <View style={receiptStyles.totalDivider} />

          {/* Total */}
          <View style={receiptStyles.totalRow}>
            <Text style={receiptStyles.totalLabel}>TOTAL</Text>
            <View style={receiptStyles.totalAmountRow}>
              <Text style={receiptStyles.totalCurrency}>₱</Text>
              <Text style={receiptStyles.totalAmount}>{finalFare}</Text>
            </View>
          </View>
        </View>

        {/* Perforated divider bottom */}
        <View style={receiptStyles.perforatedRow}>
          <View style={receiptStyles.perf} />
          <View style={receiptStyles.perfDash} />
          <View style={receiptStyles.perf} />
        </View>

        {/* Footer */}
        <View style={receiptStyles.footer}>
          <Ionicons name="shield-checkmark-outline" size={13} color={Colors.textTertiary} />
          <Text style={receiptStyles.footerText}>
            Official 2026 LRT-2 fare matrix • Stored locally for offline use
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const receiptStyles = StyleSheet.create({
  outer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadow.lg,
    marginBottom: Spacing.lg,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textOnPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(52,168,83,0.2)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bestBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#A8FFB4',
  },
  ticketBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  ticketBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },
  perforatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: -10,
  },
  perf: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.background,
    marginHorizontal: -7,
  },
  perfDash: {
    flex: 1,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: Colors.border,
    marginVertical: 0,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  statDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  lineItems: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lineItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  lineItemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  lineItemLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  lineItemAmount: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  totalDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.xs,
  },
  totalLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  totalAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  totalCurrency: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  totalAmount: {
    fontSize: 42,
    fontWeight: FontWeight.heavy,
    color: Colors.primary,
    letterSpacing: -1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  footerText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    flex: 1,
    flexWrap: 'wrap',
  },
});

// ─── BeepTooltip ──────────────────────────────────────────────────────────────
interface BeepTooltipProps {
  savings: number;
  visible: boolean;
}

function BeepTooltip({ savings, visible }: BeepTooltipProps) {
  const opacity = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  return (
    <RNAnimated.View style={[tooltipStyles.container, { opacity }]}>
      <View style={tooltipStyles.bubble}>
        <Text style={tooltipStyles.emoji}>💳</Text>
        <View style={{ flex: 1 }}>
          <Text style={tooltipStyles.title}>Save ₱{savings} with Beep Card!</Text>
          <Text style={tooltipStyles.subtitle}>
            Switch to Beep Card to avoid the ₱{SJT_SURCHARGE} single-journey surcharge.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
      </View>
    </RNAnimated.View>
  );
}

const tooltipStyles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary + '33',
  },
  emoji: {
    fontSize: 22,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FareCalculatorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [fromStation, setFromStation] = useState<Station | null>(null);
  const [toStation, setToStation] = useState<Station | null>(null);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [calculated, setCalculated] = useState(false);

  // New state
  const [ticketType, setTicketType] = useState<TicketType>('beep');
  const [passengerProfile, setPassengerProfile] = useState<PassengerProfile>('regular');
  const [breakdown, setBreakdown] = useState<FareBreakdown | null>(null);

  // Recompute breakdown whenever route or options change
  useEffect(() => {
    if (!calculated || routes.length === 0) {
      setBreakdown(null);
      return;
    }
    const route = routes[selectedRouteIndex];
    if (!route) return;
    const bd = computeFareBreakdown(route.totalFare, ticketType, passengerProfile);
    setBreakdown(bd);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [calculated, routes, selectedRouteIndex, ticketType, passengerProfile]);

  const handleSwap = useCallback(() => {
    const temp = fromStation;
    setFromStation(toStation);
    setToStation(temp);
    setCalculated(false);
    setRoutes([]);
    setBreakdown(null);
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

  const handleSelectRoute = useCallback((idx: number) => {
    setSelectedRouteIndex(idx);
    Haptics.selectionAsync();
  }, []);

  const canCalculate = fromStation && toStation && fromStation.id !== toStation.id;
  const selectedRoute = routes[selectedRouteIndex];

  // Show Beep tooltip when SJT is selected and there's a surcharge
  const showBeepTooltip = calculated && ticketType === 'sjt' && routes.length > 0;
  const beepSavings = SJT_SURCHARGE;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.headerNav}>
        <Pressable style={styles.navButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Fare Calculator</Text>
          <View style={styles.lrt2Badge}>
            <View style={[styles.lrt2Dot, { backgroundColor: LRT2_COLOR }]} />
            <Text style={styles.lrt2BadgeText}>2026 Matrix</Text>
          </View>
        </View>
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
            onSelect={(s) => {
              setFromStation(s);
              setCalculated(false);
              setRoutes([]);
            }}
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
            onSelect={(s) => {
              setToStation(s);
              setCalculated(false);
              setRoutes([]);
            }}
            excludeStationId={fromStation?.id}
          />
        </Animated.View>

        {/* Ticket Type Toggle */}
        <Animated.View entering={FadeInDown.duration(400).delay(80)} style={styles.optionsCard}>
          <View style={styles.optionSection}>
            <View style={styles.optionLabelRow}>
              <Ionicons name="card-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.optionLabel}>Ticket Type</Text>
            </View>
            <SegmentedToggle value={ticketType} onChange={setTicketType} />
          </View>

          <View style={styles.optionDivider} />

          {/* Passenger Profile */}
          <View style={styles.optionSection}>
            <View style={styles.optionLabelRow}>
              <Ionicons name="person-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.optionLabel}>Passenger Profile</Text>
              <Text style={styles.discountNote}>Statutory 20% discount applies</Text>
            </View>
            <PassengerSelector value={passengerProfile} onChange={setPassengerProfile} />
          </View>
        </Animated.View>

        {/* Calculate Button */}
        <Animated.View entering={FadeInDown.duration(400).delay(160)}>
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
        {calculated && routes.length > 0 && selectedRoute && breakdown && (
          <Animated.View entering={FadeInUp.duration(500)}>

            {/* Beep savings tooltip */}
            <BeepTooltip visible={showBeepTooltip} savings={beepSavings} />

            {/* Fare Receipt */}
            <FareReceiptCard
              breakdown={breakdown}
              isCheapest={!!selectedRoute.isCheapest}
              totalTime={selectedRoute.totalTime}
              totalStations={selectedRoute.totalStations}
              transfers={selectedRoute.transfers}
            />

            {/* LRT-2 only notice */}
            {selectedRoute.segments.length === 1 &&
              selectedRoute.segments[0].line === 'LRT-2' && (
              <Animated.View entering={FadeIn.duration(300)} style={styles.matrixNotice}>
                <Ionicons name="information-circle" size={16} color={LRT2_COLOR} />
                <Text style={styles.matrixNoticeText}>
                  Fare sourced from official 2026 LRT-2 station-to-station matrix
                </Text>
              </Animated.View>
            )}

            {/* Route Options */}
            {routes.length > 1 && (
              <View style={styles.routeOptions}>
                <Text style={styles.routeOptionsTitle}>Route Options</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.routeOptionsList}>
                    {routes.map((route, index) => {
                      const routeBD = computeFareBreakdown(
                        route.totalFare,
                        ticketType,
                        passengerProfile,
                      );
                      return (
                        <Pressable
                          key={index}
                          style={[
                            styles.routeOptionChip,
                            selectedRouteIndex === index && styles.routeOptionChipActive,
                          ]}
                          onPress={() => handleSelectRoute(index)}
                        >
                          <Text
                            style={[
                              styles.routeOptionText,
                              selectedRouteIndex === index && styles.routeOptionTextActive,
                            ]}
                          >
                            ₱{routeBD.finalFare} · {route.totalTime}min
                            {route.transfers > 0 ? ` · ${route.transfers}T` : ''}
                          </Text>
                          {route.isCheapest && (
                            <Ionicons
                              name="checkmark-circle"
                              size={14}
                              color={
                                selectedRouteIndex === index
                                  ? Colors.textOnPrimary
                                  : Colors.success
                              }
                            />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Route Visual */}
            <Card style={styles.routeCard}>
              <Text style={styles.routeCardTitle}>Step-by-Step Route</Text>
              <RouteVisual route={selectedRoute} showStops />
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

// ─── Styles ───────────────────────────────────────────────────────────────────
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
  headerTitleRow: {
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  lrt2Badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3E5F5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  lrt2Dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  lrt2BadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: LRT2_COLOR,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl * 2,
  },
  selectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
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
  optionsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadow.sm,
  },
  optionSection: {
    gap: Spacing.sm,
  },
  optionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  optionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  discountNote: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: FontWeight.medium,
    marginLeft: 'auto',
  },
  optionDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
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
  matrixNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: '#F3E5F5',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  matrixNoticeText: {
    fontSize: FontSize.xs,
    color: LRT2_COLOR,
    fontWeight: FontWeight.medium,
    flex: 1,
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
