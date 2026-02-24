import React, { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '@/constants/theme';
import { saveFavoriteStation } from '@/utils/storage';
import { ALL_STATIONS } from '@/constants/stations';
import { hapticLight, hapticSuccess, hapticMedium } from '@/utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ONBOARDING_DONE_KEY = '@metroride_onboarded';

interface OnboardingSlide {
  id: string;
  emoji: string;
  title: string;
  description: string;
  accentColor: string;
  bgColor: string;
  highlights: string[];
}

const SLIDES: OnboardingSlide[] = [
  {
    id: 'welcome',
    emoji: '🚇',
    title: 'Welcome to\nMetroRide PH',
    description: 'Your elite commuter companion for MRT-3, LRT-1, and LRT-2 — smarter travel starts here.',
    accentColor: Colors.primary,
    bgColor: Colors.primarySoft,
    highlights: ['Real-time updates', 'Smart routing', 'Community reports'],
  },
  {
    id: 'ai',
    emoji: '🤖',
    title: 'Meet MetroAI\nYour Smart Guide',
    description: 'Ask anything about fares, routes, and real-time crowd conditions — powered by advanced AI.',
    accentColor: Colors.violet,
    bgColor: Colors.violetLight,
    highlights: ['Voice queries', 'Photo analysis', 'Instant answers'],
  },
  {
    id: 'maps',
    emoji: '🗺️',
    title: 'Live Maps &\nInteractive Routes',
    description: 'Navigate the full metro network with real-time station status, transfer guidance, and fare details.',
    accentColor: '#10B981',
    bgColor: '#D1FAE5',
    highlights: ['All 3 lines', 'Transfer stations', 'Fare calculator'],
  },
  {
    id: 'crowd',
    emoji: '👥',
    title: 'Crowd Tracking\n& Community',
    description: 'See live crowding levels contributed by fellow commuters, and earn badges for your reports.',
    accentColor: Colors.amber,
    bgColor: Colors.amberLight,
    highlights: ['Live crowd levels', 'Community reports', 'Commuter badges'],
  },
  {
    id: 'insights',
    emoji: '📊',
    title: 'Your Commuter\nInsights',
    description: 'Track your travel stats, PHP saved, efficiency scores, and your impact on the community.',
    accentColor: '#EF4444',
    bgColor: '#FEE2E2',
    highlights: ['Travel diary', 'Savings tracker', 'Efficiency score'],
  },
];

const LINE_OPTIONS = [
  { id: 'MRT-3', label: 'MRT-3', color: Colors.mrt3 },
  { id: 'LRT-1', label: 'LRT-1', color: Colors.lrt1 },
  { id: 'LRT-2', label: 'LRT-2', color: Colors.lrt2 },
];

type SetupStep = 'slides' | 'permissions' | 'setup' | 'done';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [step, setStep] = useState<SetupStep>('slides');
  const [homeSearch, setHomeSearch] = useState('');
  const [workSearch, setWorkSearch] = useState('');
  const [homeStationId, setHomeStationId] = useState<string | null>(null);
  const [workStationId, setWorkStationId] = useState<string | null>(null);
  const [selectedLines, setSelectedLines] = useState<string[]>(['MRT-3', 'LRT-1', 'LRT-2']);
  const [activeField, setActiveField] = useState<'home' | 'work' | null>(null);
  const cardScale = useSharedValue(1);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(cardScale.value, { damping: 12 }) }],
  }));

  const handleScroll = useCallback((e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (idx !== currentSlide) {
      setCurrentSlide(idx);
      hapticLight();
    }
  }, [currentSlide]);

  const goToSlide = useCallback((idx: number) => {
    hapticLight();
    scrollRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: true });
    setCurrentSlide(idx);
  }, []);

  const handleNext = useCallback(() => {
    if (currentSlide < SLIDES.length - 1) {
      goToSlide(currentSlide + 1);
    } else {
      hapticMedium();
      setStep('permissions');
    }
  }, [currentSlide, goToSlide]);

  const handleRequestPermissions = useCallback(async () => {
    hapticLight();
    await Location.requestForegroundPermissionsAsync().catch(() => {});
    await Notifications.requestPermissionsAsync().catch(() => {});
    hapticSuccess();
    setStep('setup');
  }, []);

  const handleSkipPermissions = useCallback(() => {
    hapticLight();
    setStep('setup');
  }, []);

  const toggleLine = useCallback((lineId: string) => {
    hapticLight();
    setSelectedLines((prev) =>
      prev.includes(lineId) ? prev.filter((l) => l !== lineId) : [...prev, lineId]
    );
  }, []);

  const handleFinishSetup = useCallback(async () => {
    hapticSuccess();
    try {
      if (homeStationId) {
        await saveFavoriteStation({
          stationId: homeStationId,
          label: 'home',
          addedAt: new Date().toISOString(),
        });
      }
      if (workStationId) {
        await saveFavoriteStation({
          stationId: workStationId,
          label: 'work',
          addedAt: new Date().toISOString(),
        });
      }
      await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
      await AsyncStorage.setItem('@metroride_alert_lines', JSON.stringify(selectedLines));
    } catch {}
    router.replace('/(tabs)');
  }, [homeStationId, workStationId, selectedLines, router]);

  const handleSkipSetup = useCallback(async () => {
    hapticLight();
    try {
      await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
    } catch {}
    router.replace('/(tabs)');
  }, [router]);

  const stationResults = useCallback((query: string) => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return ALL_STATIONS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.nearbyStreets ?? []).some((st: string) => st.toLowerCase().includes(q))
    ).slice(0, 4);
  }, []);

  // ── Slides View ──────────────────────────────────────────────────────────
  if (step === 'slides') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          scrollEventThrottle={16}
        >
          {SLIDES.map((slide, idx) => (
            <Animated.View
              key={slide.id}
              style={[styles.slide, { width: SCREEN_WIDTH }]}
              entering={idx === 0 ? FadeInDown.duration(600) : undefined}
            >
              {/* Background blob */}
              <View style={[styles.slideBlob, { backgroundColor: slide.bgColor }]} />

              <View style={styles.slideContent}>
                {/* Emoji */}
                <Animated.View style={[styles.emojiContainer, { backgroundColor: slide.bgColor }, cardAnimStyle]}>
                  <Text style={styles.emoji}>{slide.emoji}</Text>
                </Animated.View>

                {/* Title */}
                <Text style={[styles.slideTitle, { color: slide.accentColor }]}>
                  {slide.title}
                </Text>

                {/* Description */}
                <Text style={styles.slideDesc}>{slide.description}</Text>

                {/* Highlights */}
                <View style={styles.highlights}>
                  {slide.highlights.map((h) => (
                    <View key={h} style={[styles.highlightChip, { backgroundColor: slide.bgColor, borderColor: slide.accentColor + '40' }]}>
                      <View style={[styles.highlightDot, { backgroundColor: slide.accentColor }]} />
                      <Text style={[styles.highlightText, { color: slide.accentColor }]}>{h}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>
          ))}
        </ScrollView>

        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, idx) => (
            <Pressable key={idx} onPress={() => goToSlide(idx)}>
              <Animated.View
                style={[
                  styles.dot,
                  {
                    width: currentSlide === idx ? 24 : 8,
                    backgroundColor: currentSlide === idx
                      ? SLIDES[currentSlide].accentColor
                      : Colors.border,
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>

        {/* Navigation */}
        <View style={styles.navRow}>
          <Pressable onPress={handleSkipSetup} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
          <Pressable
            onPress={handleNext}
            style={[styles.nextBtn, { backgroundColor: SLIDES[currentSlide].accentColor }]}
          >
            <Text style={styles.nextText}>
              {currentSlide === SLIDES.length - 1 ? 'Get Started' : 'Next'}
            </Text>
            <Ionicons
              name={currentSlide === SLIDES.length - 1 ? 'arrow-forward' : 'chevron-forward'}
              size={18}
              color="#FFF"
            />
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Permissions View ─────────────────────────────────────────────────────
  if (step === 'permissions') {
    return (
      <View style={[styles.container, styles.centeredContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Animated.View entering={FadeInUp.duration(500)} style={styles.permCard}>
          <Text style={styles.permEmoji}>🔔</Text>
          <Text style={styles.permTitle}>Enable Permissions</Text>
          <Text style={styles.permSubtitle}>
            MetroRide works best with these permissions. We never sell your data.
          </Text>

          <View style={styles.permItems}>
            <View style={styles.permItem}>
              <View style={[styles.permIcon, { backgroundColor: Colors.primarySoft }]}>
                <Ionicons name="location" size={22} color={Colors.primary} />
              </View>
              <View style={styles.permText}>
                <Text style={styles.permItemTitle}>Location Access</Text>
                <Text style={styles.permItemDesc}>Find nearby stations and get personalized commute tips</Text>
              </View>
            </View>
            <View style={[styles.permDivider]} />
            <View style={styles.permItem}>
              <View style={[styles.permIcon, { backgroundColor: Colors.amberLight }]}>
                <Ionicons name="notifications" size={22} color={Colors.amber} />
              </View>
              <View style={styles.permText}>
                <Text style={styles.permItemTitle}>Push Notifications</Text>
                <Text style={styles.permItemDesc}>Get real-time alerts for delays, crowd changes, and your lines</Text>
              </View>
            </View>
          </View>

          <Pressable onPress={handleRequestPermissions} style={styles.enableBtn}>
            <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            <Text style={styles.enableBtnText}>Enable Permissions</Text>
          </Pressable>

          <Pressable onPress={handleSkipPermissions} style={styles.laterBtn}>
            <Text style={styles.laterText}>Maybe Later</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  // ── Quick Setup View ──────────────────────────────────────────────────────
  const homeResults = stationResults(homeSearch);
  const workResults = stationResults(workSearch);
  const homeStation = homeStationId ? ALL_STATIONS.find((s) => s.id === homeStationId) : null;
  const workStation = workStationId ? ALL_STATIONS.find((s) => s.id === workStationId) : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.md }]}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(500)} style={styles.setupHeader}>
          <Text style={styles.setupEmoji}>⚡</Text>
          <Text style={styles.setupTitle}>Quick Setup</Text>
          <Text style={styles.setupSubtitle}>Personalize MetroRide in seconds</Text>
        </Animated.View>

        {/* Home Station */}
        <Animated.View entering={FadeInDown.duration(500).delay(100)} style={styles.setupSection}>
          <View style={styles.sectionLabelRow}>
            <View style={[styles.sectionIcon, { backgroundColor: Colors.primarySoft }]}>
              <Ionicons name="home" size={16} color={Colors.primary} />
            </View>
            <Text style={styles.sectionLabel}>Home Station</Text>
            {homeStation && (
              <Pressable onPress={() => { setHomeStationId(null); setHomeSearch(''); }}>
                <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
              </Pressable>
            )}
          </View>

          {homeStation ? (
            <View style={[styles.selectedStation, { borderColor: Colors.primary }]}>
              <Ionicons name="train" size={16} color={Colors.primary} />
              <Text style={styles.selectedStationText}>{homeStation.name}</Text>
              <Text style={styles.selectedStationLine}>{homeStation.line}</Text>
            </View>
          ) : (
            <>
              <View style={styles.searchInputRow}>
                <Ionicons name="search" size={16} color={Colors.textTertiary} />
                <TextInput
                  style={styles.setupInput}
                  placeholder="Search home station..."
                  placeholderTextColor={Colors.textTertiary}
                  value={homeSearch}
                  onChangeText={setHomeSearch}
                  onFocus={() => setActiveField('home')}
                />
              </View>
              {activeField === 'home' && homeResults.length > 0 && (
                <View style={styles.resultsList}>
                  {homeResults.map((s) => (
                    <Pressable
                      key={s.id}
                      style={styles.resultItem}
                      onPress={() => {
                        hapticLight();
                        setHomeStationId(s.id);
                        setHomeSearch('');
                        setActiveField(null);
                      }}
                    >
                      <View style={[styles.resultDot, { backgroundColor: s.line === 'MRT-3' ? Colors.mrt3 : s.line === 'LRT-1' ? Colors.lrt1 : Colors.lrt2 }]} />
                      <Text style={styles.resultName}>{s.name}</Text>
                      <Text style={styles.resultLineBadge}>{s.line}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
        </Animated.View>

        {/* Work Station */}
        <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.setupSection}>
          <View style={styles.sectionLabelRow}>
            <View style={[styles.sectionIcon, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="business" size={16} color="#059669" />
            </View>
            <Text style={styles.sectionLabel}>Work Station</Text>
            {workStation && (
              <Pressable onPress={() => { setWorkStationId(null); setWorkSearch(''); }}>
                <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
              </Pressable>
            )}
          </View>

          {workStation ? (
            <View style={[styles.selectedStation, { borderColor: '#059669' }]}>
              <Ionicons name="train" size={16} color="#059669" />
              <Text style={styles.selectedStationText}>{workStation.name}</Text>
              <Text style={styles.selectedStationLine}>{workStation.line}</Text>
            </View>
          ) : (
            <>
              <View style={styles.searchInputRow}>
                <Ionicons name="search" size={16} color={Colors.textTertiary} />
                <TextInput
                  style={styles.setupInput}
                  placeholder="Search work station..."
                  placeholderTextColor={Colors.textTertiary}
                  value={workSearch}
                  onChangeText={setWorkSearch}
                  onFocus={() => setActiveField('work')}
                />
              </View>
              {activeField === 'work' && workResults.length > 0 && (
                <View style={styles.resultsList}>
                  {workResults.map((s) => (
                    <Pressable
                      key={s.id}
                      style={styles.resultItem}
                      onPress={() => {
                        hapticLight();
                        setWorkStationId(s.id);
                        setWorkSearch('');
                        setActiveField(null);
                      }}
                    >
                      <View style={[styles.resultDot, { backgroundColor: s.line === 'MRT-3' ? Colors.mrt3 : s.line === 'LRT-1' ? Colors.lrt1 : Colors.lrt2 }]} />
                      <Text style={styles.resultName}>{s.name}</Text>
                      <Text style={styles.resultLineBadge}>{s.line}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
        </Animated.View>

        {/* Line Alerts */}
        <Animated.View entering={FadeInDown.duration(500).delay(300)} style={styles.setupSection}>
          <View style={styles.sectionLabelRow}>
            <View style={[styles.sectionIcon, { backgroundColor: Colors.amberLight }]}>
              <Ionicons name="notifications" size={16} color={Colors.amber} />
            </View>
            <Text style={styles.sectionLabel}>Alert Lines</Text>
          </View>
          <Text style={styles.sectionHint}>Get push notifications for these lines</Text>
          <View style={styles.lineOptions}>
            {LINE_OPTIONS.map((line) => {
              const selected = selectedLines.includes(line.id);
              return (
                <Pressable
                  key={line.id}
                  onPress={() => toggleLine(line.id)}
                  style={[
                    styles.lineChip,
                    {
                      backgroundColor: selected ? line.color : Colors.background,
                      borderColor: line.color,
                    },
                  ]}
                >
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={selected ? '#FFF' : line.color}
                  />
                  <Text style={[styles.lineChipText, { color: selected ? '#FFF' : line.color }]}>
                    {line.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Finish Buttons */}
        <Animated.View entering={FadeInDown.duration(500).delay(400)} style={styles.setupActions}>
          <Pressable onPress={handleFinishSetup} style={styles.finishBtn}>
            <Ionicons name="rocket" size={20} color="#FFF" />
            <Text style={styles.finishBtnText}>Start Commuting!</Text>
          </Pressable>
          <Pressable onPress={handleSkipSetup} style={styles.skipSetupBtn}>
            <Text style={styles.skipSetupText}>Skip for now</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  centeredContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  slide: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: 40,
    position: 'relative',
  },
  slideBlob: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
    opacity: 0.4,
  },
  slideContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xl,
  },
  emojiContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.lg,
  },
  emoji: {
    fontSize: 56,
  },
  slideTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.heavy,
    textAlign: 'center',
    lineHeight: 38,
  },
  slideDesc: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  highlights: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  highlightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  highlightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  highlightText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.lg,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  skipBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  skipText: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
    fontWeight: FontWeight.medium,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    ...Shadow.md,
  },
  nextText: {
    fontSize: FontSize.md,
    color: '#FFF',
    fontWeight: FontWeight.bold,
  },
  // Permissions
  permCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xxl,
    ...Shadow.lg,
    alignItems: 'center',
  },
  permEmoji: {
    fontSize: 52,
    marginBottom: Spacing.md,
  },
  permTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.heavy,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  permSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  permItems: {
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  permItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  permIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permText: {
    flex: 1,
  },
  permItemTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  permItemDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  permDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  enableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xxxl,
    borderRadius: BorderRadius.full,
    width: '100%',
    justifyContent: 'center',
    ...Shadow.md,
  },
  enableBtnText: {
    fontSize: FontSize.lg,
    color: '#FFF',
    fontWeight: FontWeight.bold,
  },
  laterBtn: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
  },
  laterText: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
    fontWeight: FontWeight.medium,
  },
  // Setup
  setupHeader: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  setupEmoji: {
    fontSize: 44,
    marginBottom: Spacing.sm,
  },
  setupTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.heavy,
    color: Colors.text,
  },
  setupSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  setupSection: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionLabel: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  sectionHint: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  setupInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  selectedStation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
  },
  selectedStationText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: FontWeight.semibold,
  },
  selectedStationLine: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  resultsList: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  resultDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  resultName: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  resultLineBadge: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  lineOptions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  lineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  lineChipText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  setupActions: {
    margin: Spacing.lg,
    gap: Spacing.sm,
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
    ...Shadow.md,
  },
  finishBtnText: {
    fontSize: FontSize.lg,
    color: '#FFF',
    fontWeight: FontWeight.bold,
  },
  skipSetupBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  skipSetupText: {
    fontSize: FontSize.md,
    color: Colors.textTertiary,
    fontWeight: FontWeight.medium,
  },
});
