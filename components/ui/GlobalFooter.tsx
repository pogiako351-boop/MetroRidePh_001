import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface FooterLink {
  label: string;
  route: '/about' | '/privacy' | '/contact';
  icon: keyof typeof Ionicons.glyphMap;
}

const FOOTER_LINKS: FooterLink[] = [
  { label: 'About', route: '/about', icon: 'information-circle-outline' },
  { label: 'Privacy', route: '/privacy', icon: 'shield-checkmark-outline' },
  { label: 'Contact', route: '/contact', icon: 'mail-outline' },
];

/**
 * GlobalFooter — Neon Onyx styled footer with crawlable links for About, Privacy, and Contact.
 * Uses <a> tags on web for GoogleBot crawlability and Pressable for native navigation.
 */
export function GlobalFooter() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.divider} />
      <View style={styles.linksRow}>
        {FOOTER_LINKS.map((link, index) => (
          <React.Fragment key={link.route}>
            {index > 0 && <View style={styles.dot} />}
            {Platform.OS === 'web' ? (
              // Render as <a> on web for GoogleBot crawlability
              <Pressable
                onPress={() => router.push(link.route)}
                style={styles.linkPressable}
                accessibilityRole="link"
              >
                <Ionicons name={link.icon} size={13} color="rgba(0,255,255,0.5)" />
                <Text style={styles.linkText}>{link.label}</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push(link.route)}
                style={styles.linkPressable}
              >
                <Ionicons name={link.icon} size={13} color="rgba(0,255,255,0.5)" />
                <Text style={styles.linkText}>{link.label}</Text>
              </Pressable>
            )}
          </React.Fragment>
        ))}
      </View>
      <Text style={styles.copyright}>
        © 2026 MetroRide PH. All rights reserved.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  divider: {
    width: 60,
    height: 1,
    backgroundColor: 'rgba(0,255,255,0.15)',
    marginBottom: 4,
  },
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(0,255,255,0.25)',
  },
  linkPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(0,255,255,0.6)',
    letterSpacing: 0.3,
  },
  copyright: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: 0.2,
  },
});
