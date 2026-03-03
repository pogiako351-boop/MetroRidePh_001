import React from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { Colors, BorderRadius, Spacing, FontSize, FontWeight } from '@/constants/theme';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'mrt3' | 'lrt1' | 'lrt2';

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  small?: boolean;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  primary: { bg: 'rgba(64,224,255,0.12)', text: Colors.electricCyan, border: 'rgba(64,224,255,0.25)' },
  success: { bg: 'rgba(34,197,94,0.12)', text: '#22C55E', border: 'rgba(34,197,94,0.25)' },
  warning: { bg: 'rgba(255,184,0,0.12)', text: '#FFB800', border: 'rgba(255,184,0,0.25)' },
  error: { bg: 'rgba(255,68,68,0.12)', text: '#FF4444', border: 'rgba(255,68,68,0.25)' },
  info: { bg: 'rgba(64,224,255,0.12)', text: Colors.electricCyan, border: 'rgba(64,224,255,0.25)' },
  mrt3: { bg: 'rgba(68,153,255,0.12)', text: Colors.mrt3, border: 'rgba(68,153,255,0.30)' },
  lrt1: { bg: 'rgba(255,230,0,0.10)', text: Colors.lrt1, border: 'rgba(255,230,0,0.28)' },
  lrt2: { bg: 'rgba(187,68,255,0.12)', text: Colors.lrt2, border: 'rgba(187,68,255,0.28)' },
};

export function Badge({ text, variant = 'primary', style, small = false }: BadgeProps) {
  const colors = variantColors[variant];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colors.bg, borderColor: colors.border },
        small && styles.small,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: colors.text },
          small && styles.smallText,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  small: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  text: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  smallText: {
    fontSize: FontSize.xs,
  },
});
