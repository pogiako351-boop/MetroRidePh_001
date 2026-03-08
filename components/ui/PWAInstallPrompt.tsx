/**
 * PWAInstallPrompt
 *
 * Premium-styled glass notification that suggests users install MetroRide PH
 * to their home screen. Handles both the Chrome/Android `beforeinstallprompt`
 * event and the manual iOS Safari share-sheet flow.
 *
 * Only renders on web. Automatically dismissed once the user installs,
 * declines, or if they are already running in standalone mode.
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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BorderRadius,
  Colors,
  FontSize,
  FontWeight,
  Spacing,
} from '@/constants/theme';

const DISMISSED_KEY = '@metroride_pwa_prompt_dismissed';

// How long (ms) to wait after mount before showing the prompt
const SHOW_DELAY_MS = 4000;

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}

export function PWAInstallPrompt() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  const slideY = useRef(new Animated.Value(160)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Only relevant on web
    if (Platform.OS !== 'web') return;

    // Don't show if already running as an installed PWA
    if (
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    ) {
      return;
    }

    const iosDevice = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const safariOnly =
      iosDevice && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    setIsIOS(iosDevice);

    AsyncStorage.getItem(DISMISSED_KEY).then((dismissed) => {
      if (dismissed) return;

      const show = () => {
        setVisible(true);
        Animated.parallel([
          Animated.spring(slideY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 60,
            friction: 9,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      };

      // Chrome / Android — listen for the native install prompt
      const promptHandler = (e: Event) => {
        e.preventDefault();
        deferredPrompt.current = e as BeforeInstallPromptEvent;
        setTimeout(show, SHOW_DELAY_MS);
      };
      window.addEventListener('beforeinstallprompt', promptHandler);

      // iOS Safari — show manual guide (no native prompt available)
      if (safariOnly) {
        const timer = setTimeout(show, SHOW_DELAY_MS + 1000);
        return () => {
          clearTimeout(timer);
          window.removeEventListener('beforeinstallprompt', promptHandler);
        };
      }

      return () => window.removeEventListener('beforeinstallprompt', promptHandler);
    });
  }, [slideY, opacity]);

  const dismiss = (persist = true) => {
    Animated.parallel([
      Animated.timing(slideY, { toValue: 160, duration: 280, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(() => setVisible(false));
    if (persist) AsyncStorage.setItem(DISMISSED_KEY, 'true');
  };

  const handleInstall = async () => {
    if (deferredPrompt.current) {
      await deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      deferredPrompt.current = null;
      if (outcome === 'accepted') {
        dismiss(true);
        return;
      }
    }
    dismiss(true);
  };

  if (!visible || Platform.OS !== 'web') return null;

  const bottomOffset = insets.bottom + Spacing.lg;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { bottom: bottomOffset, transform: [{ translateY: slideY }], opacity },
      ]}
    >
      {/* Electric Cyan glow accent line */}
      <View style={styles.accentLine} />

      {/* Glass card */}
      <View style={styles.card}>
        {/* Subtle radial glow in the top-left corner */}
        <View style={styles.cornerGlow} pointerEvents="none" />

        {/* ── Header Row ───────────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <View style={styles.iconBadge}>
            <Ionicons name="train" size={18} color={Colors.electricCyan} />
          </View>

          <View style={styles.headerText}>
            <Text style={styles.title}>Install MetroRide PH</Text>
            <Text style={styles.subtitle}>Full app experience, zero storage</Text>
          </View>

          <Pressable
            onPress={() => dismiss(true)}
            style={styles.closeBtn}
            hitSlop={10}
            accessibilityLabel="Dismiss install prompt"
          >
            <Ionicons name="close" size={17} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <View style={styles.divider} />

        {/* ── Body ─────────────────────────────────────────────────────── */}
        {isIOS ? (
          // iOS Safari cannot trigger a native install prompt — show a guide
          <View style={styles.iosGuide}>
            <View style={styles.iosStep}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNum}>1</Text>
              </View>
              <Text style={styles.stepText}>
                Tap the{' '}
                <Text style={styles.highlight}>
                  Share{' '}
                </Text>
                <Ionicons name="share-outline" size={13} color={Colors.electricCyan} />
                {' '}button in Safari
              </Text>
            </View>
            <View style={styles.iosStep}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNum}>2</Text>
              </View>
              <Text style={styles.stepText}>
                Select{' '}
                <Text style={styles.highlight}>&ldquo;Add to Home Screen&rdquo;</Text>
              </Text>
            </View>

            <Pressable onPress={() => dismiss(true)} style={styles.gotItBtn}>
              <Text style={styles.gotItText}>Got it</Text>
            </Pressable>
          </View>
        ) : (
          // Chrome / Android / Desktop — show native install CTA
          <View style={styles.androidActions}>
            <Text style={styles.bodyText}>
              Add MetroRide to your home screen for instant access, offline
              viewing, and an immersive full-screen experience.
            </Text>
            <View style={styles.buttonRow}>
              <Pressable
                onPress={() => dismiss(true)}
                style={styles.laterBtn}
              >
                <Text style={styles.laterText}>Not now</Text>
              </Pressable>
              <Pressable
                onPress={handleInstall}
                style={styles.installBtn}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={16}
                  color={Colors.background}
                  style={styles.installIcon}
                />
                <Text style={styles.installText}>Add to Home Screen</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 9998,
  },

  // Thin Electric Cyan accent line above the card
  accentLine: {
    height: 2,
    marginHorizontal: Spacing.xl,
    borderRadius: 1,
    backgroundColor: Colors.electricCyan,
    opacity: 0.7,
    marginBottom: 0,
    // Glow
    shadowColor: Colors.electricCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 8,
  },

  card: {
    backgroundColor: 'rgba(13,14,16,0.95)',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderTopWidth: 0,
    borderRadius: BorderRadius.xl,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    overflow: 'hidden',
    // Deep shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 20,
  },

  // Subtle radial glow — purely decorative
  cornerGlow: {
    position: 'absolute',
    top: -40,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.electricCyan,
    opacity: 0.05,
  },

  // ── Header ─────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },

  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(64,224,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(64,224,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    letterSpacing: -0.2,
  },

  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },

  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginHorizontal: Spacing.lg,
  },

  // ── iOS Guide ──────────────────────────────────────────────────────────
  iosGuide: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },

  iosStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },

  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(64,224,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(64,224,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  stepNum: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: Colors.electricCyan,
  },

  stepText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },

  highlight: {
    color: Colors.electricCyan,
    fontWeight: FontWeight.medium,
  },

  gotItBtn: {
    marginTop: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(64,224,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(64,224,255,0.25)',
    alignSelf: 'flex-end',
  },

  gotItText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.electricCyan,
  },

  // ── Android / Chrome actions ───────────────────────────────────────────
  androidActions: {
    padding: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },

  bodyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },

  laterBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },

  laterText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },

  installBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.electricCyan,
    shadowColor: Colors.electricCyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },

  installIcon: {
    marginRight: Spacing.xs,
  },

  installText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.background,
  },
});
