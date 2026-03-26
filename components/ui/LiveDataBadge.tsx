import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Platform } from 'react-native';

interface LiveDataBadgeProps {
  visible?: boolean;
  lastSync?: Date | null;
  compact?: boolean;
  supabaseMode?: boolean;
}

export default function LiveDataBadge({ visible = true, compact = false }: LiveDataBadgeProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: visible ? 1 : 0,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [visible, opacityAnim]);

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.6,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulseAnim]);

  if (!visible) return null;

  const handleTooltipToggle = () => {
    setShowTooltip((p) => !p);
  };

  const dotColor = '#22C55E';

  return (
    <View style={styles.wrapper}>
      <Pressable onPress={handleTooltipToggle} accessibilityRole="button" accessibilityLabel="System health status">
        <Animated.View style={[styles.container, compact && styles.compact, { opacity: opacityAnim }]}>
          <View style={styles.dotWrapper}>
            <Animated.View
              style={[
                styles.dotRing,
                {
                  backgroundColor: dotColor,
                  transform: [{ scale: pulseAnim }],
                  opacity: pulseAnim.interpolate({
                    inputRange: [1, 1.6],
                    outputRange: [0.35, 0],
                  }),
                },
              ]}
            />
            <View style={[styles.dotCore, { backgroundColor: dotColor }]} />
          </View>
          <Text style={[styles.label, compact && styles.labelCompact, { color: dotColor }]}>
            Local Data Active
          </Text>
        </Animated.View>
      </Pressable>

      {showTooltip && (
        <View
          style={[
            styles.tooltip,
            Platform.OS === 'web' && ({
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            } as object),
          ]}
        >
          <View style={[styles.tooltipArrow, { borderBottomColor: 'rgba(34,197,94,0.2)' }]} />
          <View style={styles.tooltipInner}>
            <View style={styles.tooltipRow}>
              <View style={[styles.tooltipStatusDot, { backgroundColor: dotColor }]} />
              <Text style={styles.tooltipKey}>Data Source</Text>
              <Text style={[styles.tooltipVal, { color: dotColor }]}>Local Assets</Text>
            </View>
            <View style={[styles.tooltipDivider, { backgroundColor: dotColor + '28' }]} />
            <View style={styles.tooltipRow}>
              <View style={[styles.tooltipStatusDot, { backgroundColor: dotColor + '80' }]} />
              <Text style={styles.tooltipKey}>Mode</Text>
              <Text style={styles.tooltipVal}>Zero-Failure</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
  },
  compact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dotWrapper: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotRing: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  labelCompact: {
    fontSize: 10,
  },
  // Tooltip
  tooltip: {
    marginTop: 6,
    backgroundColor: 'rgba(10,12,15,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
    borderRadius: 10,
    overflow: 'hidden',
    minWidth: 210,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  tooltipArrow: {
    width: 0,
    height: 0,
    alignSelf: 'flex-start',
    marginLeft: 14,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  tooltipInner: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 6,
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  tooltipStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  tooltipKey: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    flex: 1,
  },
  tooltipVal: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '600',
  },
  tooltipDivider: {
    height: 1,
    marginHorizontal: -12,
  },
});
