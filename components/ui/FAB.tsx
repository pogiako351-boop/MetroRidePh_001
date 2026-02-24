import React, { useRef, useEffect } from 'react';
import {
  Animated as RNAnimated,
  Pressable,
  StyleSheet,
  Text,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadow, BorderRadius, FontSize, FontWeight } from '@/constants/theme';

interface FABAction {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}

interface FABProps {
  onPress: () => void;
  actions?: FABAction[];
  expanded?: boolean;
}

export function FAB({ onPress, expanded = false }: FABProps) {
  const scaleAnim = useRef(new RNAnimated.Value(1)).current;
  const rotateAnim = useRef(new RNAnimated.Value(0)).current;
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    const pulse = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 900,
          useNativeDriver: true,
        }),
        RNAnimated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    RNAnimated.spring(rotateAnim, {
      toValue: expanded ? 1 : 0,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start();
  }, [expanded, rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const handlePressIn = () => {
    RNAnimated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      tension: 80,
      friction: 5,
    }).start();
  };

  const handlePressOut = () => {
    RNAnimated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 80,
      friction: 5,
    }).start();
  };

  return (
    <RNAnimated.View style={[styles.fabWrapper, { transform: [{ scale: pulseAnim }] }]}>
      <RNAnimated.View style={[styles.fabGlow]} />
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={styles.fabPressable}
      >
        <RNAnimated.View
          style={[
            styles.fab,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <RNAnimated.View style={{ transform: [{ rotate }] }}>
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </RNAnimated.View>
          <Text style={styles.fabLabel}>Report</Text>
        </RNAnimated.View>
      </Pressable>
    </RNAnimated.View>
  );
}

interface FABMenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  delay?: number;
  visible: boolean;
}

export function FABMenuItem({ icon, label, color, onPress, delay = 0, visible }: FABMenuItemProps) {
  const slideAnim = useRef(new RNAnimated.Value(30)).current;
  const opacityAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      RNAnimated.parallel([
        RNAnimated.spring(slideAnim, {
          toValue: 0,
          delay,
          useNativeDriver: true,
          tension: 70,
          friction: 8,
        }),
        RNAnimated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          delay,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      RNAnimated.parallel([
        RNAnimated.timing(slideAnim, {
          toValue: 30,
          duration: 150,
          useNativeDriver: true,
        }),
        RNAnimated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, delay, slideAnim, opacityAnim]);

  return (
    <RNAnimated.View
      style={[
        styles.menuItem,
        { opacity: opacityAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Text style={styles.menuItemLabel}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={[styles.menuItemButton, { backgroundColor: color }]}
      >
        <Ionicons name={icon} size={22} color="#FFFFFF" />
      </Pressable>
    </RNAnimated.View>
  );
}

const styles = StyleSheet.create({
  fabWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabGlow: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.amber + '40',
    transform: [{ scale: 1.3 }],
  },
  fabPressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.amber,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.lg,
    ...Platform.select({
      android: { elevation: 10 },
    }),
  },
  fabLabel: {
    fontSize: 8,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    marginTop: -2,
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  menuItemLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    ...Shadow.sm,
  },
  menuItemButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.md,
  },
});
