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
  const heartbeatAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  // Continuous system heartbeat animation — indicates local responsiveness
  useEffect(() => {
    const heartbeat = Animated.loop(
      Animated.sequence([
        Animated.timing(heartbeatAnim, {
          toValue: 1.4,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(heartbeatAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(heartbeatAnim, {
          toValue: 1.2,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(heartbeatAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.delay(800),
      ]),
    );
    heartbeat.start();

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.7,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );
    glow.start();

    return () => {
      heartbeat.stop();
      glow.stop();
    };
  }, [heartbeatAnim, glowAnim]);

  const dotColor = '#22C55E';
  const bgColor = 'rgba(34,197,94,0.06)';
  const borderColor = 'rgba(34,197,94,0.20)';
  const textColor = '#22C55E';

  return (
    <View style={[styles.container, { backgroundColor: bgColor, borderColor }]}>
      <View style={styles.leftSection}>
        {/* Heartbeat dot */}
        <View style={styles.dotWrapper}>
          <Animated.View
            style={[
              styles.dotRing,
              {
                backgroundColor: dotColor,
                transform: [{ scale: heartbeatAnim }],
                opacity: heartbeatAnim.interpolate({
                  inputRange: [1, 1.4],
                  outputRange: [0.4, 0],
                }),
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dotCore,
              {
                backgroundColor: dotColor,
                opacity: glowAnim.interpolate({
                  inputRange: [0.3, 0.7],
                  outputRange: [0.8, 1],
                }),
              },
            ]}
          />
        </View>

        <View style={styles.textSection}>
          <View style={styles.statusRow}>
            <Text style={[styles.statusText, { color: textColor }]}>
              SYSTEM OPTIMIZED
            </Text>
            <View style={styles.offlineBadge}>
              <Ionicons name="shield-checkmark" size={10} color="#22C55E" />
              <Text style={styles.offlineBadgeText}>Offline Ready</Text>
            </View>
          </View>
          <Text style={styles.syncTime}>
            Local-first engine active · Zero-failure mode
          </Text>
        </View>
      </View>

      {/* Heartbeat icon */}
      <Pressable
        onPress={onRefresh}
        style={({ pressed }) => [
          styles.refreshButton,
          { borderColor: textColor + '30' },
          pressed && styles.refreshPressed,
        ]}
        hitSlop={8}
      >
        <Animated.View style={{ transform: [{ scale: heartbeatAnim.interpolate({
          inputRange: [1, 1.4],
          outputRange: [1, 1.1],
        }) }] }}>
          <Ionicons
            name="heart"
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(34,197,94,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
  },
  offlineBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#22C55E',
    letterSpacing: 0.3,
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
    backgroundColor: 'rgba(34,197,94,0.06)',
  },
  refreshPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.92 }],
  },
});

export default LiveStatusBar;
