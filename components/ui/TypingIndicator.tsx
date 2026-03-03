import React, { useEffect, useRef } from 'react';
import { Animated as RNAnimated, View, StyleSheet } from 'react-native';
import { Colors, BorderRadius } from '@/constants/theme';

const DOT_COUNT = 3;
const DOT_SIZE = 8;

export function TypingIndicator() {
  const dots = useRef(
    Array.from({ length: DOT_COUNT }, () => new RNAnimated.Value(0))
  ).current;

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.delay(i * 150),
          RNAnimated.spring(dot, {
            toValue: -8,
            useNativeDriver: true,
            tension: 300,
            friction: 6,
          }),
          RNAnimated.spring(dot, {
            toValue: 0,
            useNativeDriver: true,
            tension: 300,
            friction: 6,
          }),
          RNAnimated.delay((DOT_COUNT - i) * 150 + 200),
        ])
      )
    );

    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [dots]);

  return (
    <View style={styles.container}>
      <View style={styles.bubble}>
        {dots.map((dot, i) => (
          <RNAnimated.View
            key={i}
            style={[
              styles.dot,
              { transform: [{ translateY: dot }] },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: Colors.electricCyan,
  },
});
