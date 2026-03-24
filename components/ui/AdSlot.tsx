import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Animated,
  Text,
} from 'react-native';

interface AdSlotProps {
  /** Ad slot type for styling variations */
  type?: 'display' | 'anchor';
  /** Optional custom height (default 250) */
  height?: number;
  /** Optional style overrides */
  style?: object;
}

/**
 * AdSlot — Neon Onyx styled ad container with Electric Cyan skeleton loader.
 * On web, it renders a Google AdSense ad unit placeholder.
 * On native, it renders a styled placeholder.
 */
export function AdSlot({ type = 'display', height = 250, style }: AdSlotProps) {
  const [adLoaded, setAdLoaded] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Cyan pulse animation for skeleton loader
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    // Simulate ad load after a delay (in production, AdSense handles this)
    const timer = setTimeout(() => {
      setAdLoaded(true);
    }, 3000);

    return () => {
      pulse.stop();
      clearTimeout(timer);
    };
  }, [pulseAnim]);

  useEffect(() => {
    // Push ads on web when component mounts
    if (Platform.OS === 'web' && adLoaded) {
      try {
        const adsbygoogle = (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle;
        if (adsbygoogle) {
          adsbygoogle.push({});
        }
      } catch {
        // AdSense not available
      }
    }
  }, [adLoaded]);

  const isAnchor = type === 'anchor';
  const containerHeight = isAnchor ? 90 : height;

  return (
    <View
      style={[
        styles.container,
        { height: containerHeight },
        isAnchor && styles.anchorContainer,
        style,
      ]}
    >
      {!adLoaded ? (
        // Skeleton loader with glowing cyan pulse
        <Animated.View
          style={[
            styles.skeleton,
            { height: containerHeight - 2, opacity: pulseAnim },
          ]}
        >
          <View style={styles.skeletonContent}>
            <View style={styles.skeletonIcon}>
              <Text style={styles.skeletonIconText}>AD</Text>
            </View>
            <View style={styles.skeletonLines}>
              <View style={[styles.skeletonLine, { width: '60%' }]} />
              <View style={[styles.skeletonLine, { width: '40%' }]} />
            </View>
          </View>
        </Animated.View>
      ) : (
        // Ad content area
        <View style={styles.adContent}>
          {Platform.OS === 'web' ? (
            <View style={styles.webAdWrapper}>
              {/* In production, this would be a real AdSense unit */}
              <View style={styles.adPlaceholder}>
                <Text style={styles.adLabel}>Advertisement</Text>
                <Text style={styles.adSublabel}>
                  {isAnchor ? 'Anchor Ad Unit' : 'Responsive Display Ad'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.adPlaceholder}>
              <Text style={styles.adLabel}>Advertisement</Text>
              <Text style={styles.adSublabel}>Ad content loads on web</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#00FFFF',
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 12,
  },
  anchorContainer: {
    borderRadius: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    marginVertical: 0,
    marginHorizontal: -16,
  },
  skeleton: {
    flex: 1,
    backgroundColor: 'rgba(0,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  skeletonIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(0,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonIconText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(0,255,255,0.5)',
    letterSpacing: 1,
  },
  skeletonLines: {
    flex: 1,
    gap: 8,
  },
  skeletonLine: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,255,255,0.10)',
  },
  adContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webAdWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  adLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(0,255,255,0.4)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  adSublabel: {
    fontSize: 11,
    color: 'rgba(0,255,255,0.25)',
  },
});
