import React from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius } from '@/constants/theme';

type CrowdLevel = 'light' | 'moderate' | 'heavy';

interface CrowdIndicatorProps {
  level: CrowdLevel;
  compact?: boolean;
  style?: ViewStyle;
}

const CROWD_CONFIG: Record<
  CrowdLevel,
  { color: string; bg: string; label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  light: {
    color: Colors.crowdLight,
    bg: '#E6F4EA',
    label: 'Light',
    icon: 'people-outline',
  },
  moderate: {
    color: Colors.crowdModerate,
    bg: '#FEF7E0',
    label: 'Moderate',
    icon: 'people',
  },
  heavy: {
    color: Colors.crowdHeavy,
    bg: '#FCE8E6',
    label: 'Heavy',
    icon: 'people-sharp',
  },
};

export function CrowdIndicator({ level, compact = false, style }: CrowdIndicatorProps) {
  const config = CROWD_CONFIG[level];

  if (compact) {
    return (
      <View style={[styles.compact, { backgroundColor: config.bg }, style]}>
        <View style={[styles.compactDot, { backgroundColor: config.color }]} />
        <Text style={[styles.compactText, { color: config.color }]}>{config.label}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: config.bg }, style]}>
      <Ionicons name={config.icon} size={18} color={config.color} />
      <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
      <View style={styles.bars}>
        <View style={[styles.bar, { backgroundColor: config.color }]} />
        <View
          style={[
            styles.bar,
            {
              backgroundColor:
                level === 'moderate' || level === 'heavy' ? config.color : Colors.border,
            },
          ]}
        />
        <View
          style={[
            styles.bar,
            { backgroundColor: level === 'heavy' ? config.color : Colors.border },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  text: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  bars: {
    flexDirection: 'row',
    gap: 3,
    marginLeft: Spacing.xs,
  },
  bar: {
    width: 4,
    height: 12,
    borderRadius: 2,
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  compactDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  compactText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
});
