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
}

export function GlassCard({
  children,
  style,
  intensity = 60,
  tint = 'light',
  borderColor,
}: GlassCardProps) {
  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          styles.webFallback,
          borderColor ? { borderColor } : {},
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
  },
  inner: {
    flex: 1,
  },
  webFallback: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.85)',
    overflow: 'hidden',
  },
});
