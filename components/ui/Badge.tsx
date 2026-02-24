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

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  primary: { bg: Colors.primarySoft, text: Colors.primary },
  success: { bg: '#E6F4EA', text: Colors.success },
  warning: { bg: '#FEF7E0', text: '#E37400' },
  error: { bg: '#FCE8E6', text: Colors.error },
  info: { bg: '#E8F0FE', text: Colors.info },
  mrt3: { bg: '#E3F2FD', text: Colors.mrt3 },
  lrt1: { bg: '#E8F5E9', text: Colors.lrt1 },
  lrt2: { bg: '#F3E5F5', text: Colors.lrt2 },
};

export function Badge({ text, variant = 'primary', style, small = false }: BadgeProps) {
  const colors = variantColors[variant];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colors.bg },
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
