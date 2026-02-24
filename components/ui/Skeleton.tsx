import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { Colors, BorderRadius } from '@/constants/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/** Animated shimmer skeleton for loading states */
export function Skeleton({ width = '100%', height = 16, borderRadius = BorderRadius.sm, style }: SkeletonProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.9],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: Colors.shimmer,
          opacity,
        },
        style,
      ]}
    />
  );
}

/** Station card skeleton — mimics a station list item */
export function StationCardSkeleton() {
  return (
    <View style={skeletonStyles.stationCard}>
      <View style={skeletonStyles.leftStrip} />
      <View style={skeletonStyles.cardContent}>
        <View style={skeletonStyles.topRow}>
          <Skeleton width="55%" height={14} borderRadius={6} />
          <Skeleton width={48} height={20} borderRadius={10} />
        </View>
        <Skeleton width="35%" height={11} borderRadius={4} style={{ marginTop: 6 }} />
        <View style={skeletonStyles.bottomRow}>
          <Skeleton width={60} height={10} borderRadius={4} />
          <Skeleton width={60} height={10} borderRadius={4} />
        </View>
      </View>
    </View>
  );
}

/** Alert card skeleton */
export function AlertCardSkeleton() {
  return (
    <View style={skeletonStyles.alertCard}>
      <View style={skeletonStyles.alertLeft}>
        <Skeleton width={36} height={36} borderRadius={18} />
      </View>
      <View style={skeletonStyles.alertContent}>
        <Skeleton width="70%" height={13} borderRadius={5} />
        <Skeleton width="90%" height={11} borderRadius={4} style={{ marginTop: 6 }} />
        <Skeleton width="40%" height={10} borderRadius={4} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

/** Dashboard section skeleton (for home/work shortcuts) */
export function QuickActionSkeleton() {
  return (
    <View style={skeletonStyles.quickAction}>
      <Skeleton width={44} height={44} borderRadius={22} style={{ alignSelf: 'center' }} />
      <Skeleton width="80%" height={10} borderRadius={4} style={{ marginTop: 8, alignSelf: 'center' }} />
      <Skeleton width="60%" height={10} borderRadius={4} style={{ marginTop: 4, alignSelf: 'center' }} />
    </View>
  );
}

/** Insights chart skeleton */
export function ChartSkeleton() {
  return (
    <View style={skeletonStyles.chart}>
      <Skeleton width="40%" height={14} borderRadius={6} style={{ marginBottom: 16 }} />
      <View style={skeletonStyles.bars}>
        {[80, 50, 90, 60, 75, 40, 65].map((h, i) => (
          <Skeleton key={i} width={28} height={h} borderRadius={6} />
        ))}
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  stationCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: 8,
    overflow: 'hidden',
    height: 78,
  },
  leftStrip: {
    width: 4,
    backgroundColor: Colors.shimmer,
  },
  cardContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    gap: 12,
  },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  alertLeft: {
    justifyContent: 'center',
  },
  alertContent: {
    flex: 1,
  },
  quickAction: {
    width: 80,
    padding: 8,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginRight: 8,
  },
  chart: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: 16,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 100,
  },
});
