import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '@/constants/theme';
import { getStationById, LINE_COLORS, LINE_NAMES } from '@/constants/stations';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LineDot } from '@/components/ui/LineDot';
import { CrowdIndicator } from '@/components/ui/CrowdIndicator';
import {
  isFavoriteStation,
  saveFavoriteStation,
  removeFavoriteStation,
} from '@/utils/storage';
import { generateMockCrowdLevels } from '@/utils/mockData';

const PLACE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  food: 'restaurant-outline',
  shop: 'storefront-outline',
  landmark: 'flag-outline',
  mall: 'cart-outline',
  hospital: 'medkit-outline',
  school: 'school-outline',
};

export default function StationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isFav, setIsFav] = useState(false);
  const [, setFavLabel] = useState<'home' | 'work' | 'custom'>('custom');
  const [crowdLevel, setCrowdLevel] = useState<'light' | 'moderate' | 'heavy'>('light');

  const station = useMemo(() => getStationById(id || ''), [id]);

  useEffect(() => {
    if (station) {
      isFavoriteStation(station.id).then(setIsFav);
      const levels = generateMockCrowdLevels();
      const level = levels.find((l) => l.stationId === station.id);
      if (level) setCrowdLevel(level.level);
    }
  }, [station]);

  const handleToggleFavorite = useCallback(async () => {
    if (!station) return;

    if (isFav) {
      await removeFavoriteStation(station.id);
      setIsFav(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert('Add to Favorites', 'Choose a category for this station', [
        {
          text: 'Home',
          onPress: async () => {
            await saveFavoriteStation({
              stationId: station.id,
              label: 'home',
              addedAt: new Date().toISOString(),
            });
            setIsFav(true);
            setFavLabel('home');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
        {
          text: 'Work',
          onPress: async () => {
            await saveFavoriteStation({
              stationId: station.id,
              label: 'work',
              addedAt: new Date().toISOString(),
            });
            setIsFav(true);
            setFavLabel('work');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
        {
          text: 'Custom',
          onPress: async () => {
            await saveFavoriteStation({
              stationId: station.id,
              label: 'custom',
              addedAt: new Date().toISOString(),
            });
            setIsFav(true);
            setFavLabel('custom');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [station, isFav]);

  if (!station) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={56} color={Colors.textTertiary} />
        <Text style={styles.errorText}>Station not found</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const lineColor = LINE_COLORS[station.line];

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={styles.headerNav}>
            <Pressable
              style={styles.navButton}
              onPress={() => router.back()}
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </Pressable>
            <Pressable
              style={[styles.navButton, isFav && styles.favActive]}
              onPress={handleToggleFavorite}
              hitSlop={8}
            >
              <Ionicons
                name={isFav ? 'heart' : 'heart-outline'}
                size={24}
                color={isFav ? Colors.error : Colors.text}
              />
            </Pressable>
          </View>

          {/* Station Hero */}
          <View style={styles.heroSection}>
            <View style={[styles.lineTag, { backgroundColor: lineColor }]}>
              <Text style={styles.lineTagText}>{station.line}</Text>
            </View>
            <Text style={styles.stationTitle}>{station.name}</Text>
            <Text style={styles.stationSubtitle}>{LINE_NAMES[station.line]}</Text>
            <View style={styles.heroMeta}>
              <Badge
                text={station.status}
                variant={station.status === 'Normal' ? 'success' : 'warning'}
              />
              <CrowdIndicator level={crowdLevel} compact />
              {station.isTransfer && (
                <Badge text="Transfer Station" variant="primary" />
              )}
            </View>
          </View>
        </Animated.View>

        {/* Quick Info Cards */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.quickInfoRow}>
          <Card style={styles.quickInfoCard}>
            <Ionicons name="time-outline" size={20} color={Colors.primary} />
            <Text style={styles.quickInfoLabel}>First Train</Text>
            <Text style={styles.quickInfoValue}>{station.firstTrain}</Text>
          </Card>
          <Card style={styles.quickInfoCard}>
            <Ionicons name="moon-outline" size={20} color={Colors.primary} />
            <Text style={styles.quickInfoLabel}>Last Train</Text>
            <Text style={styles.quickInfoValue}>{station.lastTrain}</Text>
          </Card>
          <Card style={styles.quickInfoCard}>
            <Ionicons name="layers-outline" size={20} color={Colors.primary} />
            <Text style={styles.quickInfoLabel}>Platforms</Text>
            <Text style={styles.quickInfoValue}>{station.platforms}</Text>
          </Card>
        </Animated.View>

        {/* Transfer Info */}
        {station.isTransfer && station.transferTo && (
          <Animated.View entering={FadeInRight.duration(400).delay(200)}>
            <Card style={styles.transferCard}>
              <View style={styles.transferHeader}>
                <Ionicons name="swap-horizontal" size={20} color={Colors.primary} />
                <Text style={styles.transferTitle}>Transfer Available</Text>
              </View>
              <View style={styles.transferLines}>
                {station.transferTo.map((line) => (
                  <View key={line} style={styles.transferLineRow}>
                    <LineDot line={line} size={12} />
                    <Text style={styles.transferLineName}>{LINE_NAMES[line]}</Text>
                    <Ionicons name="arrow-forward" size={14} color={Colors.textTertiary} />
                  </View>
                ))}
              </View>
            </Card>
          </Animated.View>
        )}

        {/* Exits & Streets */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <Text style={styles.sectionTitle}>Exits & Nearby Streets</Text>
          <Card style={styles.exitsCard}>
            {station.exits.map((exit, i) => (
              <View key={i} style={[styles.exitRow, i > 0 && styles.exitRowBorder]}>
                <View style={styles.exitIcon}>
                  <Ionicons name="exit-outline" size={16} color={Colors.primary} />
                </View>
                <Text style={styles.exitText}>{exit}</Text>
              </View>
            ))}
            {station.nearbyStreets.length > 0 && (
              <View style={styles.streetsRow}>
                <Ionicons name="navigate-outline" size={14} color={Colors.textTertiary} />
                <Text style={styles.streetsText}>
                  Near: {station.nearbyStreets.join(', ')}
                </Text>
              </View>
            )}
          </Card>
        </Animated.View>

        {/* Nearby Places */}
        {station.nearbyPlaces.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(400)}>
            <Text style={styles.sectionTitle}>Points of Interest</Text>
            {station.nearbyPlaces.map((place, index) => (
              <Card key={index} style={styles.placeCard}>
                <View style={styles.placeRow}>
                  <View style={styles.placeIcon}>
                    <Ionicons
                      name={PLACE_ICONS[place.type] || 'location-outline'}
                      size={18}
                      color={Colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.placeName}>{place.name}</Text>
                    <Text style={styles.placeType}>
                      {place.type.charAt(0).toUpperCase() + place.type.slice(1)}
                    </Text>
                  </View>
                  <View style={styles.placeDistance}>
                    <Ionicons name="walk-outline" size={12} color={Colors.textTertiary} />
                    <Text style={styles.placeDistanceText}>{place.distance}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </Animated.View>
        )}

        {/* Action Buttons */}
        <Animated.View entering={FadeInDown.duration(400).delay(500)} style={styles.actionButtons}>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => router.push('/fare-calculator')}
          >
            <Ionicons name="calculator-outline" size={20} color={Colors.textOnPrimary} />
            <Text style={styles.actionBtnPrimaryText}>Calculate Fare</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={() => router.push('/route-planner')}
          >
            <Ionicons name="map-outline" size={20} color={Colors.primary} />
            <Text style={styles.actionBtnSecondaryText}>Plan Route</Text>
          </Pressable>
        </Animated.View>

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
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  headerNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  favActive: {
    backgroundColor: '#FCE8E6',
  },
  heroSection: {
    marginBottom: Spacing.xl,
  },
  lineTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.sm,
  },
  lineTagText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textOnPrimary,
  },
  stationTitle: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.heavy,
    color: Colors.text,
    letterSpacing: -1,
    marginBottom: 4,
  },
  stationSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  heroMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  quickInfoRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  quickInfoCard: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
  },
  quickInfoLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  quickInfoValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  transferCard: {
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.primarySoft,
    backgroundColor: '#F8FBFF',
  },
  transferHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  transferTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  transferLines: {
    gap: Spacing.sm,
  },
  transferLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  transferLineName: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.text,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  exitsCard: {
    marginBottom: Spacing.xl,
  },
  exitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  exitRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  exitIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exitText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  streetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  streetsText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  placeCard: {
    marginBottom: Spacing.sm,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  placeIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.text,
  },
  placeType: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  placeDistance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  placeDistanceText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.lg,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  actionBtnSecondary: {
    backgroundColor: Colors.primarySoft,
  },
  actionBtnPrimaryText: {
    color: Colors.textOnPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  actionBtnSecondaryText: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  errorText: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  backButton: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  backButtonText: {
    color: Colors.textOnPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
});
