import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing } from '@/constants/theme';
import { SyncStatus } from '@/utils/transitDataSync';

interface LiveStatusBarProps {
  syncStatus: SyncStatus;
  isLiveData: boolean;
  lastSync: Date | null;
  onRefresh: () => void;
}

export function LiveStatusBar({ syncStatus, isLiveData, lastSync, onRefresh }: LiveStatusBarProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Pulsing dot animation when live
  useEffect(() => {
    if (isLiveData) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.8,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isLiveData, pulseAnim]);

  // Spinning refresh icon when syncing
  useEffect(() => {
    if (syncStatus === 'syncing') {
      spinAnim.setValue(0);
      const loop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    } else {
      spinAnim.setValue(0);
    }
  }, [syncStatus, spinAnim]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const formatSync = (d: Date) => {
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 10) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const isOnline = isLiveData && syncStatus === 'success';
  const isSyncing = syncStatus === 'syncing';
  const isError = syncStatus === 'error';
  const isOffline = syncStatus === 'offline';

  // Determine colors and text based on precise state
  const dotColor = isOnline
    ? '#00FFFF'
    : isSyncing
      ? '#00FFFF'
      : isError
        ? '#FF4444'
        : '#FFB800';
  const bgColor = isOnline
    ? 'rgba(0,255,255,0.06)'
    : isSyncing
      ? 'rgba(0,255,255,0.04)'
      : isError
        ? 'rgba(255,68,68,0.06)'
        : 'rgba(255,184,0,0.06)';
  const borderColor = isOnline
    ? 'rgba(0,255,255,0.20)'
    : isSyncing
      ? 'rgba(0,255,255,0.12)'
      : isError
        ? 'rgba(255,68,68,0.20)'
        : 'rgba(255,184,0,0.15)';
  const statusText = isSyncing
    ? 'SYNCING...'
    : isOnline
      ? 'LIVE DATA ACTIVE'
      : isError
        ? 'SYNC ERROR — TAP TO RETRY'
        : isOffline
          ? 'OFFLINE MODE (CACHED)'
          : 'CONNECTING...';
  const textColor = isOnline
    ? '#00FFFF'
    : isSyncing
      ? '#00FFFF'
      : isError
        ? '#FF4444'
        : '#FFB800';

  return (
    <View style={[styles.container, { backgroundColor: bgColor, borderColor }]}>
      <View style={styles.leftSection}>
        {/* Pulsing dot */}
        <View style={styles.dotWrapper}>
          {isOnline && (
            <Animated.View
              style={[
                styles.dotRing,
                {
                  backgroundColor: dotColor,
                  transform: [{ scale: pulseAnim }],
                  opacity: pulseAnim.interpolate({
                    inputRange: [1, 1.8],
                    outputRange: [0.4, 0],
                  }),
                },
              ]}
            />
          )}
          <View style={[styles.dotCore, { backgroundColor: dotColor }]} />
        </View>

        <View style={styles.textSection}>
          <Text style={[styles.statusText, { color: textColor }]}>
            {statusText}
          </Text>
          {lastSync && !isSyncing && (
            <Text style={styles.syncTime}>
              Synced {formatSync(lastSync)}
            </Text>
          )}
        </View>
      </View>

      {/* Refresh button */}
      <Pressable
        onPress={onRefresh}
        style={({ pressed }) => [
          styles.refreshButton,
          { borderColor: textColor + '30' },
          pressed && styles.refreshPressed,
        ]}
        hitSlop={8}
        disabled={isSyncing}
      >
        <Animated.View style={{ transform: [{ rotate: isSyncing ? spinInterpolate : '0deg' }] }}>
          <Ionicons
            name="refresh"
            size={14}
            color={textColor}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  dotWrapper: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotRing: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotCore: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  textSection: {
    flex: 1,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
  },
  syncTime: {
    fontSize: 9,
    color: Colors.textTertiary,
    fontWeight: FontWeight.medium,
    marginTop: 1,
  },
  refreshButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  refreshPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.92 }],
  },
});

export default LiveStatusBar;
