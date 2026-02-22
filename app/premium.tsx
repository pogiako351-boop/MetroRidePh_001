import React, { useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '@/constants/theme';

const PREMIUM_FEATURES = [
  {
    icon: 'ban-outline' as const,
    title: 'Ad-Free Experience',
    description: 'Enjoy MetroRide PH without any ads or interruptions',
  },
  {
    icon: 'notifications-outline' as const,
    title: 'Push Notifications',
    description: 'Get instant alerts for delays, maintenance, and schedule changes',
  },
  {
    icon: 'cloud-offline-outline' as const,
    title: 'Full Offline Mode',
    description: 'Access all features without internet — maps, fares, and schedules',
  },
  {
    icon: 'people-outline' as const,
    title: 'Real-time Crowd Data',
    description: 'Live crowd predictions powered by AI for all stations',
  },
  {
    icon: 'star-outline' as const,
    title: 'Unlimited Favorites',
    description: 'Save unlimited stations and routes with custom labels',
  },
  {
    icon: 'color-palette-outline' as const,
    title: 'Premium Themes',
    description: 'Customize your app with exclusive dark mode and color themes',
  },
];

const PLANS = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: '₱149',
    period: '/month',
    savings: null,
    popular: false,
  },
  {
    id: 'annual',
    name: 'Annual',
    price: '₱999',
    period: '/year',
    savings: 'Save 44%',
    popular: true,
  },
];

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = React.useState('annual');
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [fadeAnim, slideAnim, shimmerAnim]);

  const glowOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
      >
        {/* Header */}
        <View style={styles.headerNav}>
          <Pressable style={styles.closeButton} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="close" size={24} color={Colors.textOnPrimary} />
          </Pressable>
        </View>

        {/* Hero */}
        <Animated.View
          style={[
            styles.hero,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Animated.View style={[styles.diamondGlow, { opacity: glowOpacity }]} />
          <View style={styles.diamondIcon}>
            <Ionicons name="diamond" size={40} color={Colors.gold} />
          </View>
          <Text style={styles.heroTitle}>MetroRide Premium</Text>
          <Text style={styles.heroSubtitle}>
            Unlock the ultimate commuting experience with exclusive features
          </Text>
        </Animated.View>

        {/* Features */}
        <Animated.View
          style={[
            styles.featuresContainer,
            { opacity: fadeAnim },
          ]}
        >
          {PREMIUM_FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={feature.icon} size={22} color={Colors.gold} />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDesc}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* Plan Selection */}
        <Animated.View
          style={[
            styles.plansContainer,
            { opacity: fadeAnim },
          ]}
        >
          <Text style={styles.plansTitle}>Choose Your Plan</Text>
          <View style={styles.plans}>
            {PLANS.map((plan) => (
              <Pressable
                key={plan.id}
                style={[
                  styles.planCard,
                  selectedPlan === plan.id && styles.planCardSelected,
                  plan.popular && styles.planCardPopular,
                ]}
                onPress={() => setSelectedPlan(plan.id)}
              >
                {plan.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>BEST VALUE</Text>
                  </View>
                )}
                <View style={styles.planRadio}>
                  <View
                    style={[
                      styles.planRadioOuter,
                      selectedPlan === plan.id && styles.planRadioOuterSelected,
                    ]}
                  >
                    {selectedPlan === plan.id && <View style={styles.planRadioInner} />}
                  </View>
                </View>
                <View style={styles.planInfo}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <View style={styles.planPriceRow}>
                    <Text style={styles.planPrice}>{plan.price}</Text>
                    <Text style={styles.planPeriod}>{plan.period}</Text>
                  </View>
                </View>
                {plan.savings && (
                  <View style={styles.savingsBadge}>
                    <Text style={styles.savingsText}>{plan.savings}</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* CTA */}
        <Animated.View
          style={[styles.ctaContainer, { opacity: fadeAnim }]}
        >
          <Pressable
            style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
            onPress={() => {
              // Premium subscription would be handled here
              router.back();
            }}
          >
            <Ionicons name="diamond" size={20} color={Colors.textOnPrimary} />
            <Text style={styles.ctaText}>Start Free Trial</Text>
          </Pressable>
          <Text style={styles.ctaSubtext}>
            7-day free trial • Cancel anytime • No commitment
          </Text>
        </Animated.View>

        {/* Trust indicators */}
        <View style={styles.trustRow}>
          <View style={styles.trustItem}>
            <Ionicons name="shield-checkmark-outline" size={16} color={Colors.textTertiary} />
            <Text style={styles.trustText}>Secure Payment</Text>
          </View>
          <View style={styles.trustDot} />
          <View style={styles.trustItem}>
            <Ionicons name="refresh-outline" size={16} color={Colors.textTertiary} />
            <Text style={styles.trustText}>Cancel Anytime</Text>
          </View>
          <View style={styles.trustDot} />
          <View style={styles.trustItem}>
            <Ionicons name="lock-closed-outline" size={16} color={Colors.textTertiary} />
            <Text style={styles.trustText}>Privacy First</Text>
          </View>
        </View>

        <Pressable onPress={() => router.back()} style={styles.restoreLink}>
          <Text style={styles.restoreLinkText}>Restore Purchase</Text>
        </Pressable>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
  },
  scrollContent: {
    paddingBottom: Spacing.xxxl,
  },
  headerNav: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
    marginBottom: Spacing.xxxl,
  },
  diamondGlow: {
    position: 'absolute',
    top: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.gold,
  },
  diamondIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(244, 180, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 2,
    borderColor: 'rgba(244, 180, 0, 0.3)',
  },
  heroTitle: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.heavy,
    color: Colors.textOnPrimary,
    textAlign: 'center',
    letterSpacing: -1,
    marginBottom: Spacing.sm,
  },
  heroSubtitle: {
    fontSize: FontSize.lg,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresContainer: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xxxl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(244, 180, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244, 180, 0, 0.2)',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 20,
  },
  plansContainer: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  plansTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textOnPrimary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  plans: {
    gap: Spacing.md,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: Spacing.md,
  },
  planCardSelected: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(244, 180, 0, 0.08)',
  },
  planCardPopular: {
    overflow: 'visible',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: Spacing.lg,
    backgroundColor: Colors.gold,
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  popularBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#1A1A1A',
  },
  planRadio: {
    padding: 2,
  },
  planRadioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  planRadioOuterSelected: {
    borderColor: Colors.gold,
  },
  planRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.gold,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  planPrice: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.heavy,
    color: Colors.textOnPrimary,
  },
  planPeriod: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.4)',
  },
  savingsBadge: {
    backgroundColor: 'rgba(52, 168, 83, 0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  savingsText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.success,
  },
  ctaContainer: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.gold,
    width: '100%',
    paddingVertical: Spacing.lg + 2,
    borderRadius: BorderRadius.lg,
    ...Shadow.lg,
  },
  ctaButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: '#1A1A1A',
  },
  ctaSubtext: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.4)',
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trustText: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.3)',
  },
  trustDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  restoreLink: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  restoreLinkText: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.4)',
    textDecorationLine: 'underline',
  },
});
