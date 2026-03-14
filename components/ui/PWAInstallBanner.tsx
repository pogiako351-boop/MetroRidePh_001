/**
 * PWAInstallBanner
 *
 * A slim, high-visibility top banner that invites users to install MetroRide PH
 * to their home screen. It uses the shared `usePWAInstall` hook so it doesn't
 * compete with other install-prompt components for the `beforeinstallprompt`
 * event.
 *
 * Behaviour:
 *  – Hidden by default (off-screen above the top edge).
 *  – Slides down gracefully ~1.5 s after the browser confirms installability.
 *  – Persists across sessions until the user installs or explicitly dismisses.
 *  – Triggers the native browser install dialog on the "Install" CTA.
 *  – Hides immediately after install or dismissal.
 *  – Web-only: returns null on native platforms.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Spacing,
} from '@/constants/theme';
import {
  usePWAInstall,
  PWA_INSTALL_DISMISSED_KEY,
} from '@/utils/pwaInstall';

/** Delay (ms) between `isInstallable` becoming true and the banner appearing */
const SHOW_DELAY_MS = 1500;

/** Height budget used to calculate the initial off-screen translateY */
const BANNER_HEIGHT = 56;

export function PWAInstallBanner() {
  const insets = useSafeAreaInsets();
  const { isInstallable, isStandalone, triggerInstall } = usePWAInstall();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  const translateY = useRef(new Animated.Value(-(BANNER_HEIGHT + 20))).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load persisted dismissed flag on mount ──────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (isStandalone) {
      setDismissed(true);
      return;
    }
    AsyncStorage.getItem(PWA_INSTALL_DISMISSED_KEY)
      .then((val) => setDismissed(!!val))
      .catch(() => setDismissed(false));
  }, [isStandalone]);

  // ── Show banner once installable and not dismissed ──────────────────────────
  useEffect(() => {
    if (!isInstallable || dismissed === null || dismissed) return;

    showTimer.current = setTimeout(() => {
      setVisible(true);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
      ]).start();
    }, SHOW_DELAY_MS);

    return () => {
      if (showTimer.current) clearTimeout(showTimer.current);
    };
  }, [isInstallable, dismissed, translateY, opacity]);

  // ── When installability is lost (e.g. installed from another prompt) ─────────
  useEffect(() => {
    if (!isInstallable && visible) {
      hideAndDestroy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInstallable]);

  const hideAndDestroy = (persist: boolean) => {
    if (showTimer.current) clearTimeout(showTimer.current);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -(BANNER_HEIGHT + 20),
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => setVisible(false));
    if (persist) {
      setDismissed(true);
      AsyncStorage.setItem(PWA_INSTALL_DISMISSED_KEY, 'dismissed').catch(() => {});
    }
  };

  const handleInstall = async () => {
    const outcome = await triggerInstall();
    hideAndDestroy(true);
    if (outcome === 'accepted') {
      // App installed — nothing extra needed
    }
  };

  const handleDismiss = () => hideAndDestroy(true);

  // ── Guard: only render on web when visible ──────────────────────────────────
  if (Platform.OS !== 'web' || !visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      {/* ── Neon cyan glow line at bottom edge ──────────────────────────────── */}
      <View style={styles.glowLine} pointerEvents="none" />

      {/* ── Subtle radial glow blob (top-left, purely decorative) ────────────── */}
      <View style={styles.glowBlob} pointerEvents="none" />

      <View style={styles.inner}>
        {/* Left — icon + message */}
        <View style={styles.leftGroup}>
          <View style={styles.iconWrap}>
            <Ionicons
              name="phone-portrait-outline"
              size={15}
              color={Colors.electricCyan}
            />
          </View>
          <Text style={styles.message} numberOfLines={1}>
            <Text style={styles.highlight}>Install MetroRide PH </Text>
            <Text style={styles.subtext}>— offline transit, full experience</Text>
          </Text>
        </View>

        {/* Right — CTA + close */}
        <View style={styles.rightGroup}>
          <Pressable
            onPress={handleInstall}
            style={({ pressed }) => [
              styles.installBtn,
              pressed && styles.installBtnPressed,
            ]}
            accessibilityLabel="Install MetroRide PH as a home screen app"
            accessibilityRole="button"
          >
            <Ionicons
              name="add"
              size={13}
              color={Colors.background}
              style={styles.installIcon}
            />
            <Text style={styles.installText}>Install</Text>
          </Pressable>

          <Pressable
            onPress={handleDismiss}
            style={styles.closeBtn}
            hitSlop={10}
            accessibilityLabel="Dismiss install banner"
          >
            <Ionicons name="close" size={13} color={Colors.textTertiary} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: 'rgba(8,9,10,0.97)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(64,224,255,0.35)',
    // Neon glow shadow below the banner
    shadowColor: Colors.electricCyan,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 10,
    overflow: 'hidden',
  },

  // Bright 1 px Electric Cyan rule at the very bottom of the banner
  glowLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.electricCyan,
    opacity: 0.55,
    shadowColor: Colors.electricCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },

  // Soft radial blob — purely decorative, adds depth
  glowBlob: {
    position: 'absolute',
    top: -30,
    left: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.electricCyan,
    opacity: 0.04,
  },

  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
    minHeight: 46,
  },

  // ── Left group ────────────────────────────────────────────────────────────
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    minWidth: 0,
  },

  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: 'rgba(64,224,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(64,224,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  message: {
    flex: 1,
  },

  highlight: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.electricCyan,
  },

  subtext: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },

  // ── Right group ───────────────────────────────────────────────────────────
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 0,
  },

  installBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.electricCyan,
    // Neon glow effect
    shadowColor: Colors.electricCyan,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },

  installBtnPressed: {
    opacity: 0.82,
  },

  installIcon: {
    marginRight: 3,
  },

  installText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.background,
    letterSpacing: 0.2,
  },

  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
