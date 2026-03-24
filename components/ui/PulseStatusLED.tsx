/**
 * MetroRide PH — Pulse Status LED
 * A tiny, discreet LED-style indicator in the main screen header.
 * Reflects overall Guardian system health (Green / Yellow / Red).
 * Non-intrusive — only visible to the owner who knows what it means.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated as RNAnimated, TouchableOpacity, Text, Platform } from 'react-native';
import { getGuardianStatus } from '@/utils/guardian';

type LedStatus = 'healthy' | 'degraded' | 'critical' | 'unknown';

const LED_COLORS: Record<LedStatus, { core: string; glow: string }> = {
  healthy:  { core: '#22C55E', glow: 'rgba(34,197,94,0.45)' },
  degraded: { core: '#FFB800', glow: 'rgba(255,184,0,0.45)' },
  critical: { core: '#FF4444', glow: 'rgba(255,68,68,0.45)' },
  unknown:  { core: '#64748B', glow: 'rgba(100,116,139,0.3)' },
};

const STATUS_LABELS: Record<LedStatus, string> = {
  healthy:  'System Healthy',
  degraded: 'Service Degraded',
  critical: 'Critical Issues',
  unknown:  'Status Unknown',
};

interface PulseStatusLEDProps {
  /** Show tooltip label on tap (default: false) */
  tappable?: boolean;
}

export default function PulseStatusLED({ tappable = false }: PulseStatusLEDProps) {
  const [status, setStatus] = useState<LedStatus>('unknown');
  const [showLabel, setShowLabel] = useState(false);
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;
  const glowAnim = useRef(new RNAnimated.Value(0.4)).current;

  // Poll Guardian status every 30 seconds
  useEffect(() => {
    const poll = () => {
      const s = getGuardianStatus();
      setStatus(s.status);
    };
    poll();
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, []);

  // LED pulse animation
  useEffect(() => {
    const speed = status === 'critical' ? 600 : status === 'degraded' ? 1200 : 2000;
    const pulseLoop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, { toValue: 1.5, duration: speed, useNativeDriver: true }),
        RNAnimated.timing(pulseAnim, { toValue: 0.8, duration: speed, useNativeDriver: true }),
      ]),
    );
    const glowLoop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(glowAnim, { toValue: 1, duration: speed, useNativeDriver: true }),
        RNAnimated.timing(glowAnim, { toValue: 0.3, duration: speed, useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();
    glowLoop.start();
    return () => {
      pulseLoop.stop();
      glowLoop.stop();
    };
  }, [status, pulseAnim, glowAnim]);

  const { core, glow } = LED_COLORS[status];

  const ledContent = (
    <View style={styles.container}>
      {/* Glow ring */}
      <RNAnimated.View
        style={[
          styles.glowRing,
          { backgroundColor: glow, opacity: glowAnim },
        ]}
        pointerEvents="none"
      />
      {/* Core dot */}
      <RNAnimated.View
        style={[
          styles.coreDot,
          { backgroundColor: core, transform: [{ scale: pulseAnim }] },
        ]}
      />
      {/* Tooltip (tappable mode) */}
      {tappable && showLabel && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipText}>{STATUS_LABELS[status]}</Text>
        </View>
      )}
    </View>
  );

  if (tappable) {
    return (
      <TouchableOpacity
        onPress={() => setShowLabel((v) => !v)}
        style={styles.touchTarget}
        activeOpacity={0.8}
      >
        {ledContent}
      </TouchableOpacity>
    );
  }

  return ledContent;
}

const styles = StyleSheet.create({
  touchTarget: {
    padding: 4,
  },
  container: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  coreDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  tooltip: {
    position: 'absolute',
    top: 14,
    left: -40,
    backgroundColor: 'rgba(10,10,10,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(64,224,255,0.2)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    ...(Platform.OS === 'web' ? { zIndex: 9999 } as object : {}),
  },
  tooltipText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },
});
