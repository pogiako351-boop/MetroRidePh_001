import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Animated as RNAnimated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInLeft } from 'react-native-reanimated';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '@/constants/theme';
import { getCommuterProfile } from '@/utils/commuterPoints';
import { getStationVisits } from '@/utils/frecency';
import { hapticLight } from '@/utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Mock data for insights (would come from AsyncStorage in production) ──────
const WEEKLY_TRIPS = [3, 5, 4, 6, 5, 2, 4]; // Mon–Sun
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MAX_TRIPS = Math.max(...WEEKLY_TRIPS);

const CROWD_CONTRIBUTIONS = [12, 8, 15, 6, 20, 9, 11]; // reports per day

interface StatCard {
  label: string;
  value: string;
  subValue?: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  trend?: string;
  trendUp?: boolean;
}

/** Circular progress ring drawn with borders */
function ProgressRing({
  percent,
  size = 110,
  strokeWidth = 10,
  color,
  label,
  value,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
  value: string;
}) {
  const progressAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.timing(progressAnim, {
      toValue: percent,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [percent, progressAnim]);

  // Visual ring using arc segments (3 layers)
  const bgColor = color + '22';

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {/* Background ring */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: bgColor,
        }}
      />
      {/* Progress arc via rotating mask */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: 'transparent',
          borderTopColor: color,
          borderRightColor: percent > 25 ? color : 'transparent',
          borderBottomColor: percent > 50 ? color : 'transparent',
          borderLeftColor: percent > 75 ? color : 'transparent',
          transform: [{ rotate: '-45deg' }],
        }}
      />
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: FontSize.xl, fontWeight: FontWeight.heavy, color }}>{value}</Text>
        <Text style={{ fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center', maxWidth: 60 }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

/** Animated bar chart */
function BarChart({
  data,
  labels,
  maxVal,
  color,
  height = 100,
}: {
  data: number[];
  labels: string[];
  maxVal: number;
  color: string;
  height?: number;
}) {
  const barAnims = useRef(data.map(() => new RNAnimated.Value(0))).current;

  useEffect(() => {
    const animations = barAnims.map((anim, i) =>
      RNAnimated.timing(anim, {
        toValue: 1,
        duration: 600 + i * 80,
        useNativeDriver: false,
      })
    );
    RNAnimated.stagger(60, animations).start();
  }, [barAnims]);

  return (
    <View style={{ height: height + 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 8 }}>
        {data.map((val, i) => {
          const barH = barAnims[i].interpolate({
            inputRange: [0, 1],
            outputRange: [2, Math.max(2, (val / maxVal) * height)],
          });
          const today = i === new Date().getDay() - 1;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height }}>
              <RNAnimated.View
                style={{
                  width: '100%',
                  height: barH,
                  backgroundColor: today ? color : color + '55',
                  borderRadius: 6,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        {labels.map((l, i) => (
          <Text
            key={i}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: FontSize.xs,
              color: i === new Date().getDay() - 1 ? color : Colors.textTertiary,
              fontWeight: i === new Date().getDay() - 1 ? FontWeight.bold : FontWeight.regular,
            }}
          >
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [totalTrips] = useState(29);
  const [totalKm] = useState(87.4);
  const [phpSaved] = useState(1240);
  const [reportsCount] = useState(8);
  const [efficiencyScore] = useState(78);
  const [commuterLevel, setCommuterLevel] = useState('Regular');
  const [totalPoints, setTotalPoints] = useState(0);
  const [stationCount, setStationCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'trips' | 'community'>('overview');

  useEffect(() => {
    getCommuterProfile().then((profile) => {
      if (profile) {
        setCommuterLevel(profile.level);
        setTotalPoints(profile.points);
      }
    });
    getStationVisits().then((visits) => {
      setStationCount(visits.length);
    });
  }, []);

  const statCards: StatCard[] = [
    {
      label: 'Total Trips',
      value: totalTrips.toString(),
      subValue: 'this month',
      icon: 'train',
      iconBg: Colors.primarySoft,
      iconColor: Colors.primary,
      trend: '+3 this week',
      trendUp: true,
    },
    {
      label: 'Distance',
      value: `${totalKm} km`,
      subValue: 'total traveled',
      icon: 'navigate',
      iconBg: Colors.violetLight,
      iconColor: Colors.violet,
      trend: '~3km/trip avg',
      trendUp: true,
    },
    {
      label: 'PHP Saved',
      value: `₱${phpSaved}`,
      subValue: 'vs. rideshare',
      icon: 'wallet',
      iconBg: '#D1FAE5',
      iconColor: '#059669',
      trend: '₱42 avg/trip',
      trendUp: true,
    },
    {
      label: 'Stations Visited',
      value: stationCount.toString() || '12',
      subValue: 'unique stations',
      icon: 'location',
      iconBg: Colors.amberLight,
      iconColor: Colors.amber,
      trend: '3 new this week',
      trendUp: true,
    },
  ];

  const efficiencyLabel =
    efficiencyScore >= 85
      ? '🏆 Elite Commuter'
      : efficiencyScore >= 70
      ? '⭐ Smart Commuter'
      : efficiencyScore >= 50
      ? '📈 Improving'
      : '🌱 Getting Started';

  const handleTabPress = useCallback((tab: typeof activeTab) => {
    hapticLight();
    setActiveTab(tab);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>My Insights</Text>
          <Text style={styles.headerSubtitle}>Your commute intelligence</Text>
        </View>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>{commuterLevel}</Text>
        </View>
      </Animated.View>

      {/* Tab Bar */}
      <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.tabBar}>
        {(['overview', 'trips', 'community'] as const).map((tab) => (
          <Pressable key={tab} onPress={() => handleTabPress(tab)} style={[styles.tab, activeTab === tab && styles.activeTab]}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {activeTab === 'overview' && (
          <>
            {/* Efficiency Score */}
            <Animated.View entering={FadeInDown.duration(500).delay(150)} style={styles.efficiencyCard}>
              <View style={styles.efficiencyLeft}>
                <Text style={styles.efficiencyTitle}>Efficiency Score</Text>
                <Text style={styles.efficiencyLabel}>{efficiencyLabel}</Text>
                <Text style={styles.efficiencyDesc}>
                  Based on off-peak travel, crowd avoidance & trip timing
                </Text>
                <View style={styles.scoreBarBg}>
                  <RNAnimated.View style={[styles.scoreBarFill, { width: `${efficiencyScore}%` }]} />
                </View>
                <Text style={styles.scoreValue}>{efficiencyScore}/100</Text>
              </View>
              <ProgressRing
                percent={efficiencyScore}
                color={efficiencyScore >= 70 ? Colors.violet : Colors.amber}
                label="Efficiency"
                value={`${efficiencyScore}%`}
              />
            </Animated.View>

            {/* Stat Cards Grid */}
            <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.statsGrid}>
              {statCards.map((card, idx) => (
                <Animated.View
                  key={card.label}
                  entering={FadeInLeft.duration(400).delay(250 + idx * 60)}
                  style={styles.statCard}
                >
                  <View style={[styles.statIcon, { backgroundColor: card.iconBg }]}>
                    <Ionicons name={card.icon as 'train'} size={20} color={card.iconColor} />
                  </View>
                  <Text style={styles.statValue}>{card.value}</Text>
                  <Text style={styles.statLabel}>{card.label}</Text>
                  {card.subValue && <Text style={styles.statSub}>{card.subValue}</Text>}
                  {card.trend && (
                    <View style={styles.trendRow}>
                      <Ionicons
                        name={card.trendUp ? 'trending-up' : 'trending-down'}
                        size={12}
                        color={card.trendUp ? Colors.success : Colors.error}
                      />
                      <Text style={[styles.trendText, { color: card.trendUp ? Colors.success : Colors.error }]}>
                        {card.trend}
                      </Text>
                    </View>
                  )}
                </Animated.View>
              ))}
            </Animated.View>

            {/* Travel Diary */}
            <Animated.View entering={FadeInDown.duration(500).delay(350)} style={styles.diaryCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="book-outline" size={18} color={Colors.violet} />
                <Text style={styles.sectionTitle}>Travel Diary</Text>
              </View>
              <View style={styles.diaryItems}>
                <View style={styles.diaryItem}>
                  <View style={[styles.diaryIcon, { backgroundColor: Colors.primarySoft }]}>
                    <Text style={styles.diaryEmoji}>🚇</Text>
                  </View>
                  <View>
                    <Text style={styles.diaryValue}>{totalKm} km</Text>
                    <Text style={styles.diaryLabel}>Total Distance</Text>
                  </View>
                </View>
                <View style={styles.diaryDivider} />
                <View style={styles.diaryItem}>
                  <View style={[styles.diaryIcon, { backgroundColor: '#D1FAE5' }]}>
                    <Text style={styles.diaryEmoji}>💰</Text>
                  </View>
                  <View>
                    <Text style={styles.diaryValue}>₱{phpSaved}</Text>
                    <Text style={styles.diaryLabel}>PHP Saved</Text>
                  </View>
                </View>
                <View style={styles.diaryDivider} />
                <View style={styles.diaryItem}>
                  <View style={[styles.diaryIcon, { backgroundColor: Colors.amberLight }]}>
                    <Text style={styles.diaryEmoji}>⏱️</Text>
                  </View>
                  <View>
                    <Text style={styles.diaryValue}>~{Math.round(totalTrips * 28)} min</Text>
                    <Text style={styles.diaryLabel}>Time on Metro</Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Points Summary */}
            <Animated.View entering={FadeInDown.duration(500).delay(400)} style={styles.pointsCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="star-outline" size={18} color={Colors.amber} />
                <Text style={styles.sectionTitle}>Commuter Points</Text>
              </View>
              <View style={styles.pointsContent}>
                <View style={styles.pointsLeft}>
                  <Text style={styles.pointsBig}>{totalPoints}</Text>
                  <Text style={styles.pointsLabel}>Total Points</Text>
                  <Text style={[styles.levelBadgeInline, { backgroundColor: Colors.amberLight, color: Colors.amberDark }]}>
                    {commuterLevel}
                  </Text>
                </View>
                <View style={styles.pointsRings}>
                  <ProgressRing
                    percent={Math.min((totalPoints / 200) * 100, 100)}
                    size={90}
                    color={Colors.amber}
                    label="Level"
                    value={`${Math.min(Math.round((totalPoints / 200) * 100), 100)}%`}
                  />
                </View>
              </View>
            </Animated.View>
          </>
        )}

        {activeTab === 'trips' && (
          <>
            {/* Weekly Trips Chart */}
            <Animated.View entering={FadeInDown.duration(500)} style={styles.chartCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="bar-chart-outline" size={18} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Weekly Trips</Text>
                <Text style={styles.chartTotal}>{WEEKLY_TRIPS.reduce((a, b) => a + b, 0)} this week</Text>
              </View>
              <BarChart
                data={WEEKLY_TRIPS}
                labels={DAYS}
                maxVal={MAX_TRIPS}
                color={Colors.primary}
              />
            </Animated.View>

            {/* Peak Travel Times */}
            <Animated.View entering={FadeInDown.duration(500).delay(100)} style={styles.chartCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="time-outline" size={18} color={Colors.violet} />
                <Text style={styles.sectionTitle}>Peak Hours</Text>
              </View>
              <View style={styles.peakHours}>
                {[
                  { time: '6–8 AM', pct: 85, label: 'Morning Rush', color: Colors.amber },
                  { time: '12–1 PM', pct: 35, label: 'Lunch', color: Colors.primary },
                  { time: '5–7 PM', pct: 95, label: 'Evening Rush', color: '#EF4444' },
                  { time: '8–10 PM', pct: 20, label: 'Night', color: '#6366F1' },
                ].map((h) => (
                  <View key={h.time} style={styles.peakRow}>
                    <Text style={styles.peakTime}>{h.time}</Text>
                    <View style={styles.peakBarBg}>
                      <View style={[styles.peakBarFill, { width: `${h.pct}%`, backgroundColor: h.color }]} />
                    </View>
                    <Text style={styles.peakLabel}>{h.label}</Text>
                    <Text style={[styles.peakPct, { color: h.color }]}>{h.pct}%</Text>
                  </View>
                ))}
              </View>
            </Animated.View>

            {/* Best Commute Times */}
            <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.tipsCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="bulb-outline" size={18} color={Colors.success} />
                <Text style={styles.sectionTitle}>Your Best Windows</Text>
              </View>
              {[
                { time: '9:00–10:00 AM', tip: 'Post-rush; 40% less crowd than 8 AM', icon: '✅' },
                { time: '1:00–4:00 PM', tip: 'Afternoon lull — smooth sailing', icon: '⭐' },
                { time: '8:00–9:00 PM', tip: 'Evening wind-down, fast boarding', icon: '🌙' },
              ].map((t) => (
                <View key={t.time} style={styles.tipItem}>
                  <Text style={styles.tipEmoji}>{t.icon}</Text>
                  <View>
                    <Text style={styles.tipTime}>{t.time}</Text>
                    <Text style={styles.tipDesc}>{t.tip}</Text>
                  </View>
                </View>
              ))}
            </Animated.View>
          </>
        )}

        {activeTab === 'community' && (
          <>
            {/* Crowd Contribution Badge */}
            <Animated.View entering={FadeInDown.duration(500)} style={styles.badgeCard}>
              <View style={styles.badgeTop}>
                <View style={styles.badgeIconBig}>
                  <Text style={{ fontSize: 42 }}>🏅</Text>
                </View>
                <View style={styles.badgeInfo}>
                  <Text style={styles.badgeTitle}>Crowd Contributor</Text>
                  <Text style={styles.badgeSubtitle}>{reportsCount} reports submitted</Text>
                  <View style={styles.badgeLevel}>
                    <View style={[styles.badgeDot, { backgroundColor: reportsCount >= 10 ? Colors.gold : Colors.amber }]} />
                    <Text style={styles.badgeLevelText}>
                      {reportsCount >= 20 ? 'Expert Reporter' : reportsCount >= 10 ? 'Trusted Reporter' : 'Active Reporter'}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.badgeProgress}>
                <View style={styles.badgeProgressBg}>
                  <View style={[styles.badgeProgressFill, { width: `${Math.min((reportsCount / 20) * 100, 100)}%` }]} />
                </View>
                <Text style={styles.badgeProgressLabel}>{reportsCount}/20 for Expert Badge</Text>
              </View>
            </Animated.View>

            {/* Daily Contribution Chart */}
            <Animated.View entering={FadeInDown.duration(500).delay(100)} style={styles.chartCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="people-outline" size={18} color={Colors.amber} />
                <Text style={styles.sectionTitle}>Your Reports This Week</Text>
              </View>
              <BarChart
                data={CROWD_CONTRIBUTIONS}
                labels={DAYS}
                maxVal={Math.max(...CROWD_CONTRIBUTIONS)}
                color={Colors.amber}
              />
            </Animated.View>

            {/* Impact Stats */}
            <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.impactCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="globe-outline" size={18} color={Colors.violet} />
                <Text style={styles.sectionTitle}>Your Impact</Text>
              </View>
              <View style={styles.impactGrid}>
                {[
                  { value: `${reportsCount * 12}+`, label: 'Commuters helped', icon: '👥', color: Colors.primary },
                  { value: `${reportsCount}`, label: 'Reports filed', icon: '📝', color: Colors.amber },
                  { value: `${reportsCount * 8}`, label: 'Upvotes received', icon: '👍', color: Colors.violet },
                  { value: `${Math.round(reportsCount * 0.5)}`, label: 'Issues resolved', icon: '✅', color: Colors.success },
                ].map((item) => (
                  <View key={item.label} style={[styles.impactItem, { borderColor: item.color + '30' }]}>
                    <Text style={styles.impactEmoji}>{item.icon}</Text>
                    <Text style={[styles.impactValue, { color: item.color }]}>{item.value}</Text>
                    <Text style={styles.impactLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>

            {/* Earned Badges */}
            <Animated.View entering={FadeInDown.duration(500).delay(300)} style={styles.earnedBadges}>
              <View style={styles.sectionHeader}>
                <Ionicons name="ribbon-outline" size={18} color={Colors.gold} />
                <Text style={styles.sectionTitle}>Earned Badges</Text>
              </View>
              <View style={styles.badgesRow}>
                {[
                  { emoji: '🥇', label: 'First Report', earned: true },
                  { emoji: '🤝', label: 'Helpful\nCommuter', earned: reportsCount >= 3 },
                  { emoji: '📊', label: 'Frequent\nReporter', earned: reportsCount >= 10 },
                  { emoji: '🌟', label: 'Top\nContributor', earned: reportsCount >= 20 },
                  { emoji: '🌅', label: 'Early Bird', earned: false },
                  { emoji: '🌙', label: 'Night Owl', earned: false },
                ].map((badge) => (
                  <View key={badge.label} style={[styles.badgeChip, !badge.earned && styles.badgeChipLocked]}>
                    <Text style={[styles.badgeEmoji, !badge.earned && styles.badgeEmojiLocked]}>
                      {badge.earned ? badge.emoji : '🔒'}
                    </Text>
                    <Text style={[styles.badgeChipLabel, !badge.earned && styles.badgeChipLabelLocked]}>
                      {badge.label}
                    </Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          </>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    ...Shadow.sm,
  },
  backBtn: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  headerCenter: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: FontWeight.medium,
  },
  levelBadge: {
    backgroundColor: Colors.violetLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  levelText: {
    fontSize: FontSize.sm,
    color: Colors.violetDark,
    fontWeight: FontWeight.semibold,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: Colors.violet,
  },
  tabText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  activeTabText: {
    color: Colors.violet,
    fontWeight: FontWeight.bold,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: 40,
  },
  efficiencyCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    ...Shadow.md,
  },
  efficiencyLeft: {
    flex: 1,
  },
  efficiencyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: 2,
  },
  efficiencyLabel: {
    fontSize: FontSize.md,
    color: Colors.violet,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.sm,
  },
  efficiencyDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  scoreBarBg: {
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: 3,
    marginBottom: 4,
  },
  scoreBarFill: {
    height: 6,
    backgroundColor: Colors.violet,
    borderRadius: 3,
    width: '78%',
  },
  scoreValue: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm * 3) / 2,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    ...Shadow.sm,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.heavy,
    color: Colors.text,
  },
  statLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    marginTop: 2,
  },
  statSub: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: Spacing.sm,
  },
  trendText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  diaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  chartTotal: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  diaryItems: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  diaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  diaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  diaryEmoji: {
    fontSize: 24,
  },
  diaryValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    textAlign: 'center',
  },
  diaryLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  diaryDivider: {
    width: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: Spacing.sm,
  },
  pointsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  pointsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pointsLeft: {
    flex: 1,
  },
  pointsBig: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.heavy,
    color: Colors.amber,
  },
  pointsLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  levelBadgeInline: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    overflow: 'hidden',
  },
  pointsRings: {
    alignItems: 'center',
  },
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  peakHours: {
    gap: Spacing.md,
  },
  peakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  peakTime: {
    width: 70,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  peakBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  peakBarFill: {
    height: 8,
    borderRadius: 4,
  },
  peakLabel: {
    width: 80,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'right',
  },
  peakPct: {
    width: 36,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    textAlign: 'right',
  },
  tipsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  tipEmoji: {
    fontSize: 20,
  },
  tipTime: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  tipDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  badgeCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.md,
  },
  badgeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  badgeIconBig: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.amberLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeInfo: {
    flex: 1,
  },
  badgeTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  badgeSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  badgeLevel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeLevelText: {
    fontSize: FontSize.sm,
    color: Colors.amberDark,
    fontWeight: FontWeight.semibold,
  },
  badgeProgress: {
    gap: 4,
  },
  badgeProgressBg: {
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: 3,
  },
  badgeProgressFill: {
    height: 6,
    backgroundColor: Colors.amber,
    borderRadius: 3,
  },
  badgeProgressLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  impactCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  impactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  impactItem: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm * 3) / 2,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  impactEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  impactValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.heavy,
  },
  impactLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  earnedBadges: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  badgeChip: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm * 5) / 3,
    backgroundColor: Colors.amberLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  badgeChipLocked: {
    backgroundColor: Colors.background,
  },
  badgeEmoji: {
    fontSize: 28,
  },
  badgeEmojiLocked: {
    opacity: 0.4,
  },
  badgeChipLabel: {
    fontSize: FontSize.xs,
    color: Colors.amberDark,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  badgeChipLabelLocked: {
    color: Colors.textTertiary,
  },
});
