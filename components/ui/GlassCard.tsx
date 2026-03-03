import React from 'react';
import { StyleSheet, View, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, BorderRadius } from '@/constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  borderColor?: string;
  neonGlow?: boolean;
  glowColor?: string;
}

export function GlassCard({
  children,
  style,
  intensity = 25,
  tint = 'dark',
  borderColor,
  neonGlow = false,
  glowColor = Colors.neonLime,
}: GlassCardProps) {
  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.webFallback,
          borderColor ? { borderColor } : {},
          neonGlow && { shadowColor: glowColor, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <BlurView
      intensity={intensity}
      tint={tint}
      style={[
        styles.glass,
        borderColor ? { borderColor } : {},
        neonGlow && { shadowColor: glowColor, shadowOpacity: 0.4, shadowRadius: 14, elevation: 10 },
        style,
      ]}
    >
      <View style={styles.inner}>{children}</View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: 'hidden',
    backgroundColor: 'rgba(13,14,16,0.6)',
  },
  inner: {
    flex: 1,
  },
  webFallback: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    backgroundColor: 'rgba(13,14,16,0.92)',
    overflow: 'hidden',
  },
});
