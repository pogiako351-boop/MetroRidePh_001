import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp, Pressable } from 'react-native';
import { Colors, BorderRadius, Shadow, Spacing } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  elevated?: boolean;
  glass?: boolean;
  neonGlow?: boolean;
  glowColor?: string;
}

export function Card({ children, style, onPress, elevated = false, glass = false, neonGlow = false, glowColor = Colors.neonLime }: CardProps) {
  const cardStyle = [
    styles.card,
    elevated && styles.elevated,
    glass && styles.glassCard,
    neonGlow && { shadowColor: glowColor, shadowOpacity: 0.35, shadowRadius: 14, elevation: 10 },
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          ...cardStyle,
          pressed && styles.pressed,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[...cardStyle, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    ...Shadow.sm,
  },
  elevated: {
    ...Shadow.md,
    backgroundColor: Colors.surfaceElevated,
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
