import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LineId, LINE_COLORS } from '@/constants/stations';

interface LineDotProps {
  line: LineId;
  size?: number;
  style?: ViewStyle;
  glow?: boolean;
}

export function LineDot({ line, size = 12, style, glow = false }: LineDotProps) {
  const color = LINE_COLORS[line];
  return (
    <View
      style={[
        styles.dot,
        {
          backgroundColor: color,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        glow && {
          shadowColor: color,
          shadowOpacity: 0.7,
          shadowRadius: size * 0.6,
          shadowOffset: { width: 0, height: 0 },
          elevation: 4,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {},
});
