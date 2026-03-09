import React, { useEffect, useRef } from 'react';
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
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing, Shadow } from '@/constants/theme';

const FREE_FEATURES = [
  {
    icon: 'chatbubbles-outline' as const,
    color: Colors.electricCyan,
    title: 'MetroAI Assistant',
    description: 'Chat with AI for instant route & fare advice',
  },
  {
    icon: 'eye-outline' as const,
    color: Colors.lrt2,
    title: 'MetroAI Vision',
    description: 'Upload station photos for crowd & delay analysis',
  },
  {
    icon: 'notifications-outline' as const,
    color: Colors.warning,
    title: 'Real-time Push Alerts',
    description: 'Instant delay notifications for all 3 rail lines',
  },
  {
    icon: 'map-outline' as const,
    color: Colors.lrt1,
    title: 'Interactive System Map',
    description: 'Pinch-to-zoom SVG metro map of LRT-1, MRT-3, LRT-2',
  },
  {
    icon: 'people-outline' as const,
    color: Colors.mrt3,
    title: 'Smart Crowd Predictions',
    description: 'Crowd forecasting 2 hours ahead for all stations',
  },
  {
    icon: 'alarm-outline' as const,
    color: Colors.success,
    title: 'Departure Reminders',
    description: '30-min commute alerts tailored to your schedule',
  },
  {
    icon: 'star-outline' as const,
    color: Colors.amber,
    title: 'Unlimited Favorites',
    description: 'Save unlimited routes and stations for quick access',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    color: Colors.neonLime,
    title: 'Ad-Free Experience',
    description: 'Zero ads — pure, distraction-free commute intelligence',
  },
];

export default function FreeAccessScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const glowAnim = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(glowAnim, { toValue: 1.15, duration: 2000, useNativeDriver: true }),
        RNAnimated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, [glowAnim]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Total Free Access</Text>
        <View style={styles.freeBadge}>
          <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
          <Text style={styles.freeBadgeText}>Free</Text>
        </View>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Hero Section */}
        <Animated.View entering={FadeInDown.duration(500).delay(100)} style={styles.hero}>
          <View style={styles.heroBlobBg} />
          <RNAnimated.View style={[styles.heroIconWrapper, { transform: [{ scale: glowAnim }] }]}>
            <RNAnimated.View
              style={[
                styles.heroGlowRing,
                {
                  transform: [{ scale: glowAnim }],
                  opacity: glowAnim.interpolate({ inputRange: [1, 1.15], outputRange: [0.4, 0] }),
                },
              ]}
            />
            <View style={styles.heroIconInner}>
              <Ionicons name="shield-checkmark" size={44} color={Colors.success} />
            </View>
          </RNAnimated.View>

          <Text style={styles.heroTitle}>All Features Unlocked</Text>
          <Text style={styles.heroSubtitle}>
            MetroRide PH is now a{'\n'}
            <Text style={styles.heroAccent}>Total Free Access</Text> edition.{'\n'}
            Every feature is yours — no subscriptions, no gates.
          </Text>

          <View style={styles.heroPills}>
            {['LRT-1', 'MRT-3', 'LRT-2'].map((line) => (
              <View
                key={line}
                style={[
                  styles.linePill,
                  {
                    borderColor:
                      line === 'LRT-1' ? Colors.lrt1 + '50' :
                      line === 'MRT-3' ? Colors.mrt3 + '50' :
                      Colors.lrt2 + '50',
                    backgroundColor:
                      line === 'LRT-1' ? 'rgba(255,230,0,0.07)' :
                      line === 'MRT-3' ? 'rgba(68,153,255,0.07)' :
                      'rgba(187,68,255,0.07)',
                  },
                ]}
              >
                <View
                  style={[
                    styles.linePillDot,
                    {
                      backgroundColor:
                        line === 'LRT-1' ? Colors.lrt1 :
                        line === 'MRT-3' ? Colors.mrt3 :
                        Colors.lrt2,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.linePillText,
                    {
                      color:
                        line === 'LRT-1' ? Colors.lrt1 :
                        line === 'MRT-3' ? Colors.mrt3 :
                        Colors.lrt2,
                    },
                  ]}
                >
                  {line}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Features List */}
        <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>Everything Included — Free</Text>
          {FREE_FEATURES.map((feat, index) => (
            <Animated.View
              key={feat.title}
              entering={FadeInDown.duration(400).delay(250 + index * 50)}
              style={styles.featureRow}
            >
              <View style={[styles.featureIconBox, { backgroundColor: feat.color + '15' }]}>
                <Ionicons name={feat.icon} size={20} color={feat.color} />
              </View>
              <View style={styles.featureInfo}>
                <Text style={styles.featureTitle}>{feat.title}</Text>
                <Text style={styles.featureDesc}>{feat.description}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            </Animated.View>
          ))}
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={FadeInUp.duration(500).delay(700)} style={styles.ctaSection}>
          <View style={styles.ctaCard}>
            <View style={styles.ctaGlow} />
            <Ionicons name="rocket-outline" size={28} color={Colors.electricCyan} />
            <Text style={styles.ctaTitle}>Ready to ride smarter?</Text>
            <Text style={styles.ctaDesc}>
              Jump into the map, plan your route, or ask MetroAI — all features active, no limits.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.88 }]}
              onPress={() => router.push('/transit-map')}
            >
              <Ionicons name="map" size={18} color="#08090A" />
              <Text style={styles.ctaBtnText}>Open System Map</Text>
            </Pressable>
          </View>
        </Animated.View>
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
    borderBottomColor: Colors.glassBorder,
    ...Shadow.sm,
  },
  backBtn: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  freeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34,197,94,0.12)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
  },
  freeBadgeText: {
    fontSize: FontSize.sm,
    color: Colors.success,
    fontWeight: FontWeight.bold,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  // Hero Section
  hero: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xxl,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.20)',
    overflow: 'hidden',
    ...Shadow.md,
  },
  heroBlobBg: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.success,
    opacity: 0.04,
  },
  heroIconWrapper: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  heroGlowRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.success,
  },
  heroIconInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(34,197,94,0.30)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.success,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  heroTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.heavy,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  heroSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  heroAccent: {
    color: Colors.success,
    fontWeight: FontWeight.bold,
  },
  heroPills: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  linePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  linePillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  linePillText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  // Features Section
  featuresSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    ...Shadow.sm,
  },
  featuresTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  featureIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureInfo: {
    flex: 1,
  },
  featureTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  featureDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  // CTA
  ctaSection: {
    marginBottom: Spacing.md,
  },
  ctaCard: {
    backgroundColor: 'rgba(64,224,255,0.07)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(64,224,255,0.20)',
    overflow: 'hidden',
    gap: Spacing.md,
    ...Shadow.md,
  },
  ctaGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.electricCyan,
    opacity: 0.04,
  },
  ctaTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    textAlign: 'center',
  },
  ctaDesc: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.electricCyan,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
    shadowColor: Colors.electricCyan,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#08090A',
  },
});
