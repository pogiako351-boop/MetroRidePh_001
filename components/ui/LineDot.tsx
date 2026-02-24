import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LineId, LINE_COLORS } from '@/constants/stations';

interface LineDotProps {
  line: LineId;
  size?: number;
  style?: ViewStyle;
}

export function LineDot({ line, size = 12, style }: LineDotProps) {
  return (
    <View
      style={[
        styles.dot,
        {
          backgroundColor: LINE_COLORS[line],
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {},
});
