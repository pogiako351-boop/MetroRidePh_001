import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface LiveDataBadgeProps {
  visible?: boolean;
  lastSync?: Date | null;
  compact?: boolean;
  supabaseMode?: boolean;
}

export default function LiveDataBadge({ visible = true, lastSync, compact = false, supabaseMode = false }: LiveDataBadgeProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

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

  const formatSync = (d: Date) => {
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const dotColor = supabaseMode ? '#3ECF8E' : '#22C55E';

  return (
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
        {supabaseMode ? 'Verified via Supabase' : 'Live Data'}
      </Text>
      {!compact && lastSync && (
        <Text style={[styles.sub, { color: dotColor + 'AA' }]}>Synced {formatSync(lastSync)}</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(62,207,142,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(62,207,142,0.25)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
    alignSelf: 'flex-start',
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
  sub: {
    fontSize: 10,
    fontWeight: '400',
  },
});
