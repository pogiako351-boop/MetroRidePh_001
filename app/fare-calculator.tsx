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
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '@/constants/theme';
import { Station, LineId } from '@/constants/stations';
import { Card } from '@/components/ui/Card';
import { StationPicker } from '@/components/ui/StationPicker';
import { RouteVisual } from '@/components/ui/RouteVisual';
import { findRoutes } from '@/utils/routePlanner';
import {
  RouteResult,
  RouteSegment,
  TicketType,
  PassengerProfile,
  TICKET_TYPES,
  PASSENGER_PROFILES,
  computeFareBreakdown,
  FareBreakdown,
  SJT_SURCHARGE,
  LINE_BRAND_COLORS,
  LINE_ICONS,
  LINE_FULL_NAMES,
  LINE_SAVINGS_TIPS,
  getPrimaryLine,
} from '@/constants/fares';
import {
  hapticLight,
  hapticMedium,
  hapticSuccess,
  hapticSelection,
} from '@/utils/haptics';
import LiveDataBadge from '@/components/ui/LiveDataBadge';
import { useTransitDataSync } from '@/utils/transitDataSync';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_LINE: LineId = 'LRT-2';

function getAccent(line: LineId) {
  return LINE_BRAND_COLORS[line] ?? LINE_BRAND_COLORS['LRT-2'];
}

// ─── SegmentedToggle ──────────────────────────────────────────────────────────
interface SegmentedToggleProps {
  value: TicketType;
  onChange: (v: TicketType) => void;
  accentColor: string;
}

function SegmentedToggle({ value, onChange, accentColor }: SegmentedToggleProps) {
  return (
    <View style={toggleStyles.container}>
      {TICKET_TYPES.map((t) => {
        const active = value === t.id;
        return (
          <Pressable
            key={t.id}
            style={[toggleStyles.segment, active && { backgroundColor: accentColor }]}
            onPress={() => {
              if (!active) {
                onChange(t.id);
                hapticSelection();
              }
            }}
          >
            <Ionicons
              name={(t.icon + (active ? '' : '-outline')) as never}
              size={15}
              color={active ? '#FFFFFF' : Colors.textSecondary}
            />
            <Text
              style={[
                toggleStyles.label,
                active && { color: '#FFFFFF' },
              ]}
            >
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
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
});

// ─── PassengerSelector ────────────────────────────────────────────────────────
interface PassengerSelectorProps {
  value: PassengerProfile;
  onChange: (v: PassengerProfile) => void;
  accentColor: string;
  accentSoft: string;
}

function PassengerSelector({ value, onChange, accentColor, accentSoft }: PassengerSelectorProps) {
  return (
    <View style={psStyles.row}>
      {PASSENGER_PROFILES.map((p) => {
        const active = value === p.id;
        return (
          <Pressable
            key={p.id}
            style={[
              psStyles.pill,
              active && { borderColor: accentColor, backgroundColor: accentSoft },
            ]}
            onPress={() => {
              if (!active) {
                onChange(p.id);
                hapticSelection();
              }
            }}
          >
            <Ionicons
              name={p.icon as never}
              size={14}
              color={active ? accentColor : Colors.textSecondary}
            />
            <Text
              style={[psStyles.label, active && { color: accentColor }]}
            >
              {p.label}
            </Text>
            {p.discountRate > 0 && (
              <View
                style={[psStyles.badge, active && { backgroundColor: accentColor }]}
              >
                <Text
                  style={[
                    psStyles.badgeText,
                    active && { color: '#FFFFFF' },
                  ]}
                >
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
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  badge: {
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
});

// ─── Transfer Fare Intelligence Panel ────────────────────────────────────────
interface TransferFarePanelProps {
  segments: RouteSegment[];
  ticketType: TicketType;
  passengerProfile: PassengerProfile;
}

function TransferFarePanel({ segments, ticketType, passengerProfile }: TransferFarePanelProps) {
  if (segments.length <= 1) return null;
  return (
    <View style={tfStyles.container}>
      <View style={tfStyles.header}>
        <Ionicons name="swap-horizontal" size={14} color={Colors.textSecondary} />
        <Text style={tfStyles.headerText}>Transfer Fare Intelligence</Text>
      </View>
      {segments.map((seg, i) => {
        const brand = getAccent(seg.line);
        const segBD = computeFareBreakdown(seg.fare, ticketType, passengerProfile);
        return (
          <View key={i} style={tfStyles.row}>
            <View style={[tfStyles.lineBadge, { backgroundColor: brand.soft }]}>
              <Text style={[tfStyles.lineBadgeText, { color: brand.softText }]}>
                {LINE_ICONS[seg.line]}
              </Text>
            </View>
            <View style={tfStyles.segInfo}>
              <Text style={tfStyles.segRoute} numberOfLines={1}>
                {seg.from} → {seg.to}
              </Text>
              <Text style={tfStyles.segStats}>
                {seg.stations} stations · {seg.time} min
              </Text>
            </View>
            <Text style={[tfStyles.segFare, { color: brand.softText }]}>
              ₱{segBD.finalFare}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const tfStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  lineBadge: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.heavy,
  },
  segInfo: {
    flex: 1,
  },
  segRoute: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  segStats: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  segFare: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
});

// ─── FareReceiptCard ──────────────────────────────────────────────────────────
interface FareReceiptCardProps {
  breakdown: FareBreakdown;
  isCheapest: boolean;
  totalTime: number;
  totalStations: number;
  transfers: number;
  primaryLine: LineId;
  segments: RouteSegment[];
}

function FareReceiptCard({
  breakdown,
  isCheapest,
  totalTime,
  totalStations,
  transfers,
  primaryLine,
  segments,
}: FareReceiptCardProps) {
  const { baseFare, sjtSurcharge, discountAmount, finalFare, ticketType, passengerProfile } =
    breakdown;
  const profileInfo = PASSENGER_PROFILES.find((p) => p.id === passengerProfile)!;
  const showSJT = sjtSurcharge > 0;
  const showDiscount = discountAmount > 0;
  const brand = getAccent(primaryLine);

  // For multi-line routes, collect unique lines for badges
  const uniqueLines = Array.from(new Set(segments.map((s) => s.line)));

  return (
    <Animated.View entering={ZoomIn.springify().damping(14).stiffness(120)}>
      <View style={receiptStyles.outer}>
        {/* Header strip — dynamic line accent color */}
        <View style={[receiptStyles.header, { backgroundColor: brand.primary }]}>
          <View style={receiptStyles.headerLeft}>
            {/* Line icon badge(s) */}
            {uniqueLines.map((line) => (
              <View
                key={line}
                style={[
                  receiptStyles.lineIconBadge,
                  {
                    backgroundColor:
                      line === primaryLine
                        ? 'rgba(255,255,255,0.28)'
                        : 'rgba(255,255,255,0.14)',
                  },
                ]}
              >
                <Text
                  style={[
                    receiptStyles.lineIconText,
                    { color: brand.textOnBrand },
                  ]}
                >
                  {LINE_ICONS[line]}
                </Text>
              </View>
            ))}
            <Ionicons name="receipt" size={16} color={brand.textOnBrand} />
            <Text style={[receiptStyles.headerTitle, { color: brand.textOnBrand }]}>
              Fare Receipt
            </Text>
          </View>
          <View style={receiptStyles.headerRight}>
            {isCheapest && (
              <View style={receiptStyles.bestBadge}>
                <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                <Text style={receiptStyles.bestBadgeText}>Cheapest</Text>
              </View>
            )}
            <View style={[receiptStyles.ticketBadge, { backgroundColor: 'rgba(255,255,255,0.20)' }]}>
              <Text style={[receiptStyles.ticketBadgeText, { color: brand.textOnBrand }]}>
                {ticketType === 'beep' ? '💳 Beep' : '🎫 SJT'}
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
              <View style={[receiptStyles.lineItemDot, { backgroundColor: brand.primary }]} />
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
              <Text style={[receiptStyles.totalCurrency, { color: brand.primary }]}>₱</Text>
              <Text style={[receiptStyles.totalAmount, { color: brand.primary }]}>
                {finalFare}
              </Text>
            </View>
          </View>
        </View>

        {/* Perforated divider bottom */}
        <View style={receiptStyles.perforatedRow}>
          <View style={receiptStyles.perf} />
          <View style={receiptStyles.perfDash} />
          <View style={receiptStyles.perf} />
        </View>

        {/* Footer — 2026 Precision badge */}
        <View style={[receiptStyles.footer, { backgroundColor: brand.soft }]}>
          <Ionicons name="shield-checkmark" size={13} color={brand.softText} />
          <Text style={[receiptStyles.footerText, { color: brand.softText }]}>
            2026 Precision · {uniqueLines.map((l) => LINE_FULL_NAMES[l]).join(' + ')} matrix · Offline ready
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
  lineIconBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  lineIconText: {
    fontSize: 11,
    fontWeight: FontWeight.heavy,
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
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
    backgroundColor: 'rgba(52,168,83,0.22)',
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
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  ticketBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
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
  },
  totalAmount: {
    fontSize: 42,
    fontWeight: FontWeight.heavy,
    letterSpacing: -1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  footerText: {
    fontSize: FontSize.xs,
    flex: 1,
    flexWrap: 'wrap',
    fontWeight: FontWeight.medium,
  },
});

// ─── SmartSavingsTooltip ───────────────────────────────────────────────────────
interface SmartSavingsTooltipProps {
  savings: number;
  visible: boolean;
  primaryLine: LineId;
  passengerProfile: PassengerProfile;
}

function SmartSavingsTooltip({
  savings,
  visible,
  primaryLine,
  passengerProfile,
}: SmartSavingsTooltipProps) {
  const opacity = useRef(new RNAnimated.Value(0)).current;
  const brand = getAccent(primaryLine);
  const profileInfo = PASSENGER_PROFILES.find((p) => p.id === passengerProfile)!;
  const savingsTip = LINE_SAVINGS_TIPS[primaryLine];

  useEffect(() => {
    RNAnimated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  return (
    <RNAnimated.View style={[tooltipStyles.container, { opacity }]}>
      <View style={[tooltipStyles.bubble, { borderColor: brand.primary + '40', backgroundColor: brand.soft }]}>
        <Text style={tooltipStyles.emoji}>💰</Text>
        <View style={{ flex: 1 }}>
          <Text style={[tooltipStyles.title, { color: brand.softText }]}>
            Save ₱{savings} with Beep Card!
          </Text>
          <Text style={tooltipStyles.subtitle}>
            {profileInfo.discountRate > 0
              ? `You qualify for the 20% ${profileInfo.label} discount! ${savingsTip}`
              : savingsTip}
          </Text>
        </View>
        <View style={[tooltipStyles.linePill, { backgroundColor: brand.primary }]}>
          <Text style={[tooltipStyles.linePillText, { color: brand.textOnBrand }]}>
            {LINE_ICONS[primaryLine]}
          </Text>
        </View>
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
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
  },
  emoji: {
    fontSize: 22,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  linePill: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  linePillText: {
    fontSize: 11,
    fontWeight: FontWeight.heavy,
    letterSpacing: 0.5,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FareCalculatorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Background cloud data sync — non-blocking, offline-first
  const { isLiveData, lastSync } = useTransitDataSync();

  const [fromStation, setFromStation] = useState<Station | null>(null);
  const [toStation, setToStation] = useState<Station | null>(null);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [calculated, setCalculated] = useState(false);

  const [ticketType, setTicketType] = useState<TicketType>('beep');
  const [passengerProfile, setPassengerProfile] = useState<PassengerProfile>('regular');
  const [breakdown, setBreakdown] = useState<FareBreakdown | null>(null);

  // Derive primary line from current route
  const selectedRoute = routes[selectedRouteIndex];
  const primaryLine: LineId =
    selectedRoute ? getPrimaryLine(selectedRoute.segments) : DEFAULT_LINE;
  const accentBrand = getAccent(primaryLine);

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
    // Haptic pulse on fare recalculation
    hapticLight();
  }, [calculated, routes, selectedRouteIndex, ticketType, passengerProfile]);

  const handleSwap = useCallback(() => {
    const temp = fromStation;
    setFromStation(toStation);
    setToStation(temp);
    setCalculated(false);
    setRoutes([]);
    setBreakdown(null);
    hapticMedium();
  }, [fromStation, toStation]);

  const handleCalculate = useCallback(() => {
    if (!fromStation || !toStation) return;
    const result = findRoutes(fromStation.id, toStation.id);
    setRoutes(result);
    setSelectedRouteIndex(0);
    setCalculated(true);
    hapticSuccess();
  }, [fromStation, toStation]);

  const handleSelectRoute = useCallback((idx: number) => {
    setSelectedRouteIndex(idx);
    hapticSelection();
  }, []);

  const handleFromSelect = useCallback((s: Station) => {
    setFromStation(s);
    setCalculated(false);
    setRoutes([]);
    hapticLight();
  }, []);

  const handleToSelect = useCallback((s: Station) => {
    setToStation(s);
    setCalculated(false);
    setRoutes([]);
    hapticLight();
  }, []);

  const canCalculate = fromStation && toStation && fromStation.id !== toStation.id;

  // Show smart savings tooltip when SJT is selected and there's a surcharge
  const showSavingsTooltip = calculated && ticketType === 'sjt' && routes.length > 0;
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
          <View style={styles.headerBadgesRow}>
            {/* 2026 Precision badge — dynamically colored by active line */}
            <View
              style={[
                styles.precisionBadge,
                { backgroundColor: accentBrand.soft },
              ]}
            >
              <View
                style={[
                  styles.precisionDot,
                  { backgroundColor: accentBrand.primary },
                ]}
              />
              <Text style={[styles.precisionBadgeText, { color: accentBrand.softText }]}>
                2026 Precision · {LINE_ICONS[primaryLine]}
              </Text>
            </View>
            {/* Live Data badge — shown when synced with Supabase cloud */}
            <LiveDataBadge visible={isLiveData} lastSync={lastSync} compact />
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
            onSelect={handleFromSelect}
            excludeStationId={toStation?.id}
          />

          <View style={styles.swapContainer}>
            <View style={styles.swapLine} />
            <Pressable
              style={[styles.swapButton, { backgroundColor: accentBrand.soft }]}
              onPress={handleSwap}
            >
              <Ionicons name="swap-vertical" size={20} color={accentBrand.primary} />
            </Pressable>
            <View style={styles.swapLine} />
          </View>

          <StationPicker
            label="To"
            selectedStation={toStation}
            onSelect={handleToSelect}
            excludeStationId={fromStation?.id}
          />
        </Animated.View>

        {/* Ticket Type Toggle & Passenger Selector */}
        <Animated.View entering={FadeInDown.duration(400).delay(80)} style={styles.optionsCard}>
          <View style={styles.optionSection}>
            <View style={styles.optionLabelRow}>
              <Ionicons name="card-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.optionLabel}>Ticket Type</Text>
            </View>
            <SegmentedToggle
              value={ticketType}
              onChange={setTicketType}
              accentColor={accentBrand.primary}
            />
          </View>

          <View style={styles.optionDivider} />

          <View style={styles.optionSection}>
            <View style={styles.optionLabelRow}>
              <Ionicons name="person-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.optionLabel}>Passenger Profile</Text>
              <Text style={styles.discountNote}>Statutory 20% discount</Text>
            </View>
            <PassengerSelector
              value={passengerProfile}
              onChange={setPassengerProfile}
              accentColor={accentBrand.primary}
              accentSoft={accentBrand.soft}
            />
          </View>
        </Animated.View>

        {/* Calculate Button */}
        <Animated.View entering={FadeInDown.duration(400).delay(160)}>
          <Pressable
            style={[
              styles.calculateButton,
              { backgroundColor: accentBrand.primary },
              !canCalculate && styles.calculateButtonDisabled,
            ]}
            onPress={handleCalculate}
            disabled={!canCalculate}
          >
            <Ionicons name="calculator" size={20} color={accentBrand.textOnBrand} />
            <Text style={[styles.calculateButtonText, { color: accentBrand.textOnBrand }]}>
              Calculate Fare
            </Text>
          </Pressable>
        </Animated.View>

        {/* Results */}
        {calculated && routes.length > 0 && selectedRoute && breakdown && (
          <Animated.View entering={FadeInUp.duration(500)}>

            {/* Smart Savings Tooltip */}
            <SmartSavingsTooltip
              visible={showSavingsTooltip}
              savings={beepSavings}
              primaryLine={primaryLine}
              passengerProfile={passengerProfile}
            />

            {/* Fare Receipt Card */}
            <FareReceiptCard
              breakdown={breakdown}
              isCheapest={!!selectedRoute.isCheapest}
              totalTime={selectedRoute.totalTime}
              totalStations={selectedRoute.totalStations}
              transfers={selectedRoute.transfers}
              primaryLine={primaryLine}
              segments={selectedRoute.segments}
            />

            {/* Transfer Fare Intelligence */}
            {selectedRoute.transfers > 0 && (
              <Animated.View entering={FadeIn.duration(300)}>
                <TransferFarePanel
                  segments={selectedRoute.segments}
                  ticketType={ticketType}
                  passengerProfile={passengerProfile}
                />
              </Animated.View>
            )}

            {/* Precision matrix notice */}
            <Animated.View entering={FadeIn.duration(300)} style={[
              styles.matrixNotice,
              { backgroundColor: accentBrand.soft },
            ]}>
              <Ionicons name="shield-checkmark" size={15} color={accentBrand.primary} />
              <Text style={[styles.matrixNoticeText, { color: accentBrand.softText }]}>
                Official 2026 {Array.from(new Set(selectedRoute.segments.map((s) => LINE_FULL_NAMES[s.line]))).join(' + ')} station-to-station{' '}
                {selectedRoute.segments.length > 1 ? 'matrices' : 'matrix'} — precision fare lookup active
              </Text>
            </Animated.View>

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
                      const routePrimaryLine = getPrimaryLine(route.segments);
                      const routeBrand = getAccent(routePrimaryLine);
                      const isSelected = selectedRouteIndex === index;
                      return (
                        <Pressable
                          key={index}
                          style={[
                            styles.routeOptionChip,
                            isSelected && {
                              backgroundColor: routeBrand.primary,
                              borderColor: routeBrand.primary,
                            },
                          ]}
                          onPress={() => handleSelectRoute(index)}
                        >
                          <Text
                            style={[
                              styles.routeOptionText,
                              isSelected && { color: routeBrand.textOnBrand },
                            ]}
                          >
                            {LINE_ICONS[routePrimaryLine]} ₱{routeBD.finalFare} · {route.totalTime}min
                            {route.transfers > 0 ? ` · ${route.transfers}T` : ''}
                          </Text>
                          {route.isCheapest && (
                            <Ionicons
                              name="checkmark-circle"
                              size={14}
                              color={isSelected ? routeBrand.textOnBrand : Colors.success}
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
  headerBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  precisionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  precisionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  precisionBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
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
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.xl,
    ...Shadow.md,
  },
  calculateButtonDisabled: {
    opacity: 0.5,
  },
  calculateButtonText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  matrixNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  matrixNoticeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    flex: 1,
    lineHeight: 16,
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
  routeOptionText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
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
