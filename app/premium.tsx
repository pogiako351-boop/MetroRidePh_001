import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Animated as RNAnimated,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { adapty, shouldEnableMock } from 'react-native-adapty';
import type { AdaptyPaywallProduct, AdaptyProfile } from 'react-native-adapty';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing, Shadow } from '@/constants/theme';

const ADAPTY_API_KEY = process.env.EXPO_PUBLIC_ADAPTY_API_KEY ?? 'public_live_mock';
const PLACEMENT_ID = process.env.EXPO_PUBLIC_ADAPTY_PLACEMENT_ID ?? 'premium';

const FEATURES = [
  {
    icon: 'chatbubbles-outline' as const,
    color: Colors.violet,
    title: 'MetroAI Assistant',
    description: 'Chat with AI for instant route & fare advice',
    isPremium: false,
  },
  {
    icon: 'eye-outline' as const,
    color: Colors.violet,
    title: 'MetroAI Vision 🔒',
    description: 'Upload station photos for crowd & delay analysis',
    isPremium: true,
  },
  {
    icon: 'notifications-outline' as const,
    color: Colors.amber,
    title: 'Real-time Push Alerts 🔒',
    description: 'Get notified instantly of delays and service changes',
    isPremium: true,
  },
  {
    icon: 'map-outline' as const,
    color: Colors.primary,
    title: 'Interactive System Map',
    description: 'Pinch-to-zoom SVG map of all 3 metro lines',
    isPremium: false,
  },
  {
    icon: 'trending-up-outline' as const,
    color: Colors.success,
    title: 'Smart Crowd Predictions 🔒',
    description: 'Predicted crowd levels up to 2 hours ahead',
    isPremium: true,
  },
  {
    icon: 'alarm-outline' as const,
    color: Colors.amber,
    title: 'Departure Reminders',
    description: 'Smart alerts 30 min before your usual commute',
    isPremium: false,
  },
  {
    icon: 'star-outline' as const,
    color: '#F4B400',
    title: 'Unlimited Favorites',
    description: 'Save all your stations and routes without limits',
    isPremium: false,
  },
  {
    icon: 'shield-checkmark-outline' as const,
    color: Colors.success,
    title: 'Ad-Free Experience 🔒',
    description: 'Enjoy MetroRide completely distraction-free',
    isPremium: true,
  },
];

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [products, setProducts] = useState<AdaptyPaywallProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<AdaptyPaywallProduct | null>(null);
  const [profile, setProfile] = useState<AdaptyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isMock = shouldEnableMock();

  const shimmerAnim = useRef(new RNAnimated.Value(0)).current;
  const badgeAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    const shimmer = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(shimmerAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        RNAnimated.timing(shimmerAnim, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])
    );
    shimmer.start();
    RNAnimated.spring(badgeAnim, {
      toValue: 1,
      delay: 600,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start();
    return () => shimmer.stop();
  }, [shimmerAnim, badgeAnim]);

  const initAdapty = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      if (!isMock) {
        await adapty.activate(ADAPTY_API_KEY, {
          __ignoreActivationOnFastRefresh: __DEV__,
        });
      }
      const [pw, prof] = await Promise.all([
        adapty.getPaywall(PLACEMENT_ID),
        adapty.getProfile().catch(() => null),
      ]);
      setProfile(prof ?? null);
      const pwProducts = await adapty.getPaywallProducts(pw);
      setProducts(pwProducts);
      if (pwProducts.length > 0) {
        const annual = pwProducts.find(
          (p) =>
            p.subscription?.subscriptionPeriod?.unit === 'year' ||
            p.vendorProductId.toLowerCase().includes('annual') ||
            p.vendorProductId.toLowerCase().includes('yearly')
        );
        setSelectedProduct(annual ?? pwProducts[0]);
      }
    } catch {
      setLoadError('Could not load plans. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [isMock]);

  useEffect(() => {
    initAdapty();
  }, [initAdapty]);

  const isPremium = profile?.accessLevels?.['premium']?.isActive ?? false;

  const handlePurchase = async () => {
    if (!selectedProduct) {
      Alert.alert('No Plan Selected', 'Please select a subscription plan to continue.');
      return;
    }
    setIsPurchasing(true);
    try {
      const result = await adapty.makePurchase(selectedProduct);
      switch (result.type) {
        case 'success':
          setProfile(result.profile);
          Alert.alert(
            '🎉 Welcome to Premium!',
            'You now have full access to MetroAI Vision, Real-time Alerts, and all premium features!',
            [{ text: 'Explore Premium', onPress: () => router.back() }]
          );
          break;
        case 'user_cancelled':
          break;
        case 'pending':
          Alert.alert('Purchase Pending', 'Your purchase is being processed.', [{ text: 'OK' }]);
          break;
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Purchase failed. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      const prof = await adapty.restorePurchases();
      setProfile(prof);
      const hasPremium = prof?.accessLevels?.['premium']?.isActive ?? false;
      Alert.alert(
        hasPremium ? '✅ Restored!' : 'Nothing to Restore',
        hasPremium ? 'Your premium subscription has been restored.' : 'No previous purchases found.'
      );
    } catch {
      Alert.alert('Error', 'Could not restore purchases. Please try again.');
    }
  };

  const formatPrice = (product: AdaptyPaywallProduct): string =>
    product.price?.localizedString ?? 'N/A';

  const formatPeriod = (product: AdaptyPaywallProduct): string => {
    const period = product.subscription?.subscriptionPeriod;
    if (!period) return '';
    const { unit, numberOfUnits } = period;
    if (unit === 'month' && numberOfUnits === 1) return '/month';
    if (unit === 'year' && numberOfUnits === 1) return '/year';
    return `/${numberOfUnits} ${unit}s`;
  };

  const isAnnualProduct = (product: AdaptyPaywallProduct): boolean =>
    product.subscription?.subscriptionPeriod?.unit === 'year' ||
    product.vendorProductId.toLowerCase().includes('annual') ||
    product.vendorProductId.toLowerCase().includes('yearly');

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });

  if (isPremium) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()} style={[styles.closeBtn, { margin: Spacing.lg }]}>
          <Ionicons name="close" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.alreadyPremiumSection}>
          <Text style={styles.premiumEmoji}>👑</Text>
          <Text style={styles.alreadyPremiumTitle}>{"You're Premium!"}</Text>
          <Text style={styles.alreadyPremiumSub}>
            All features are unlocked. Enjoy the full MetroRide experience.
          </Text>
          <Pressable onPress={() => router.back()} style={styles.continueBtn}>
            <Text style={styles.continueBtnText}>Continue to App</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={Colors.text} />
        </Pressable>
        <Pressable onPress={handleRestore} style={styles.restoreBtn}>
          <Text style={styles.restoreBtnText}>Restore Purchases</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.heroSection}>
          <RNAnimated.View
            style={[
              styles.premiumBadge,
              { opacity: shimmerOpacity, transform: [{ scale: badgeAnim }] },
            ]}
          >
            <Ionicons name="diamond" size={16} color={Colors.gold} />
            <Text style={styles.premiumBadgeText}>MetroRide Premium</Text>
          </RNAnimated.View>
          <Text style={styles.heroTitle}>Commute Smarter{'\n'}Every Day</Text>
          <Text style={styles.heroSubtitle}>
            AI-powered transit assistance, real-time alerts, and advanced features.
          </Text>
          {isMock && (
            <View style={styles.mockBadge}>
              <Ionicons name="flask-outline" size={12} color={Colors.amber} />
              <Text style={styles.mockText}>Demo Mode – Tap Subscribe to simulate purchase</Text>
            </View>
          )}
        </Animated.View>

        {/* Early Bird Banner */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <View style={styles.earlyBirdBanner}>
            <Text style={styles.earlyBirdEmoji}>🐦</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.earlyBirdTitle}>Early Bird Offer – 40% Off Annual</Text>
              <Text style={styles.earlyBirdSub}>Limited time · Billed annually</Text>
            </View>
            <View style={styles.earlyBirdDiscount}>
              <Text style={styles.earlyBirdPct}>-40%</Text>
            </View>
          </View>
        </Animated.View>

        {/* Plans */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <Text style={styles.sectionTitle}>Choose Your Plan</Text>
          {isLoading ? (
            <View style={{ gap: Spacing.md, marginBottom: Spacing.xl }}>
              {[0, 1].map((i) => (
                <View key={i} style={styles.planSkeleton} />
              ))}
            </View>
          ) : loadError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{loadError}</Text>
              <Pressable onPress={initAdapty} style={styles.retryBtn}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          ) : products.length > 0 ? (
            <View style={styles.plansContainer}>
              {products.map((product) => {
                const annual = isAnnualProduct(product);
                const isSelected =
                  selectedProduct?.vendorProductId === product.vendorProductId;
                return (
                  <Pressable
                    key={product.vendorProductId}
                    onPress={() => setSelectedProduct(product)}
                    style={[
                      styles.planCard,
                      isSelected && styles.planCardSelected,
                      annual && styles.planCardAnnual,
                    ]}
                  >
                    {annual && (
                      <View style={styles.bestValueTag}>
                        <Text style={styles.bestValueText}>BEST VALUE</Text>
                      </View>
                    )}
                    <View style={styles.planRow}>
                      <View style={[styles.planRadio, isSelected && styles.planRadioActive]}>
                        {isSelected && <View style={styles.planRadioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planName}>{product.localizedTitle}</Text>
                        {product.localizedDescription ? (
                          <Text style={styles.planDesc}>{product.localizedDescription}</Text>
                        ) : null}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.planPrice, isSelected && { color: Colors.violet }]}>
                          {formatPrice(product)}
                        </Text>
                        <Text style={styles.planPeriod}>{formatPeriod(product)}</Text>
                        {annual && <Text style={styles.savingsText}>Save 40%</Text>}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            /* Fallback mock plans */
            <View style={styles.plansContainer}>
              {[
                { id: 'monthly', name: 'Monthly', price: '₱149', period: '/month', annual: false },
                { id: 'annual', name: 'Annual', price: '₱899', period: '/year', annual: true },
              ].map((plan) => (
                <Pressable
                  key={plan.id}
                  style={[
                    styles.planCard,
                    plan.annual && styles.planCardAnnual,
                    plan.annual && styles.planCardSelected,
                  ]}
                >
                  {plan.annual && (
                    <View style={styles.bestValueTag}>
                      <Text style={styles.bestValueText}>BEST VALUE</Text>
                    </View>
                  )}
                  <View style={styles.planRow}>
                    <View style={[styles.planRadio, plan.annual && styles.planRadioActive]}>
                      {plan.annual && <View style={styles.planRadioDot} />}
                    </View>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.planPrice, plan.annual && { color: Colors.violet }]}>
                        {plan.price}
                      </Text>
                      <Text style={styles.planPeriod}>{plan.period}</Text>
                      {plan.annual && <Text style={styles.savingsText}>Save 40%</Text>}
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </Animated.View>

        {/* Features */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <Text style={styles.sectionTitle}>{"What's Included"}</Text>
          <View style={styles.featuresCard}>
            {FEATURES.map((feat, idx) => (
              <View key={feat.title} style={[styles.featureRow, idx > 0 && styles.featureRowDivider]}>
                <View style={[styles.featureIconWrapper, { backgroundColor: feat.color + '18' }]}>
                  <Ionicons name={feat.icon} size={20} color={feat.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{feat.title}</Text>
                  <Text style={styles.featureDesc}>{feat.description}</Text>
                </View>
                {feat.isPremium ? (
                  <View style={styles.premiumTag}>
                    <Ionicons name="diamond" size={9} color={Colors.violet} />
                    <Text style={styles.premiumTagText}>Premium</Text>
                  </View>
                ) : (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                )}
              </View>
            ))}
          </View>
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={FadeInUp.duration(400).delay(200)}>
          <Pressable
            onPress={handlePurchase}
            disabled={isPurchasing || isLoading}
            style={[styles.ctaButton, (isPurchasing || isLoading) && styles.ctaButtonDisabled]}
          >
            <RNAnimated.View
              style={{
                opacity: shimmerOpacity,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Ionicons
                name={isPurchasing ? 'hourglass-outline' : 'diamond-outline'}
                size={20}
                color="#FFF"
              />
              <Text style={styles.ctaButtonText}>
                {isPurchasing ? 'Processing…' : isLoading ? 'Loading Plans…' : 'Start Premium Now'}
              </Text>
            </RNAnimated.View>
          </Pressable>
          <Text style={styles.legalText}>
            Auto-renews unless cancelled. Cancel anytime in App Store / Play Store.{'\n'}
            By subscribing you agree to our Terms & Privacy Policy.
          </Text>
          <View style={{ height: insets.bottom + 20 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  closeBtn: {
    padding: Spacing.sm,
    backgroundColor: Colors.borderLight,
    borderRadius: BorderRadius.full,
  },
  restoreBtn: { padding: Spacing.sm },
  restoreBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },
  heroSection: { alignItems: 'center', marginBottom: Spacing.xl },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.premium + '15',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.premium + '30',
  },
  premiumBadgeText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.premium, letterSpacing: 0.5 },
  heroTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.heavy,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: Spacing.md,
  },
  heroSubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  mockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.amberLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.amber + '40',
  },
  mockText: { fontSize: FontSize.xs, color: Colors.amberDark, fontWeight: FontWeight.medium },
  earlyBirdBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.amberLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.amber + '50',
  },
  earlyBirdEmoji: { fontSize: 24 },
  earlyBirdTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.amberDark },
  earlyBirdSub: { fontSize: FontSize.xs, color: Colors.amber },
  earlyBirdDiscount: {
    backgroundColor: Colors.amber,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  earlyBirdPct: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, color: '#FFF' },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.md },
  planSkeleton: { height: 80, backgroundColor: Colors.shimmer, borderRadius: BorderRadius.lg },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  errorText: { color: Colors.error, fontSize: FontSize.sm, textAlign: 'center' },
  retryBtn: { backgroundColor: Colors.error, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  retryBtnText: { color: '#FFF', fontWeight: FontWeight.semibold },
  plansContainer: { gap: Spacing.md, marginBottom: Spacing.xl },
  planCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    position: 'relative',
    overflow: 'hidden',
    ...Shadow.sm,
  },
  planCardSelected: { borderColor: Colors.violet, backgroundColor: Colors.violetLight },
  planCardAnnual: { borderColor: Colors.amber },
  bestValueTag: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.amber,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: BorderRadius.sm,
  },
  bestValueText: { fontSize: 9, fontWeight: FontWeight.heavy, color: '#FFF', letterSpacing: 0.5 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  planRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  planRadioActive: { borderColor: Colors.violet },
  planRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.violet },
  planName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, flex: 1 },
  planDesc: { fontSize: FontSize.xs, color: Colors.textSecondary },
  planPrice: { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, color: Colors.text },
  planPeriod: { fontSize: FontSize.xs, color: Colors.textTertiary },
  savingsText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.success, marginTop: 2 },
  featuresCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadow.sm,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  featureRowDivider: { borderTopWidth: 1, borderTopColor: Colors.borderLight },
  featureIconWrapper: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  featureTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  featureDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  premiumTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.violetLight,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  premiumTagText: { fontSize: FontSize.xs, color: Colors.violet, fontWeight: FontWeight.semibold },
  ctaButton: {
    backgroundColor: Colors.violet,
    borderRadius: BorderRadius.xl,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
    marginBottom: Spacing.lg,
  },
  ctaButtonDisabled: { backgroundColor: Colors.border },
  ctaButtonText: { fontSize: FontSize.lg, fontWeight: FontWeight.heavy, color: '#FFF' },
  legalText: { fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'center', lineHeight: 16 },
  // Already premium
  alreadyPremiumSection: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxxl },
  premiumEmoji: { fontSize: 64, marginBottom: Spacing.xl },
  alreadyPremiumTitle: { fontSize: FontSize.xxxl, fontWeight: FontWeight.heavy, color: Colors.text, marginBottom: Spacing.md },
  alreadyPremiumSub: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xxxl },
  continueBtn: { backgroundColor: Colors.violet, borderRadius: BorderRadius.xl, paddingVertical: 16, paddingHorizontal: Spacing.xxxl },
  continueBtnText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#FFF' },
});
