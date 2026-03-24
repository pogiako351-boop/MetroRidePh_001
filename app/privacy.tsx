import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GlobalFooter } from '@/components/ui/GlobalFooter';

const LAST_UPDATED = 'March 2026';
const CONTACT_EMAIL = 'support@metrorideph.com';

interface PolicySection {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  content: string;
}

const SECTIONS: PolicySection[] = [
  {
    title: 'Information We Collect',
    icon: 'document-text',
    content: `MetroRide PH is designed with a privacy-first approach. We collect minimal data necessary to provide accurate transit information for Metro Manila commuters.

Automatically Collected:
• App crash reports and diagnostic data (anonymized)
• General usage patterns (screens visited, features used)
• Device type and operating system version

Optionally Provided:
• Approximate location (GPS) — only when you use "Nearest Station"
• Community crowd reports submitted voluntarily
• MetroAI chat queries (processed but not stored)`,
  },
  {
    title: 'Third-Party Disclosure & Google Cookies',
    icon: 'globe-outline',
    content: `MetroRide PH uses Google AdSense to display advertisements. Google, as a third-party vendor, uses cookies to serve ads based on your prior visits to this and other websites.

How Google Uses Cookies:
• Google's use of the DART cookie enables it and its partners to serve ads based on visits to MetroRide PH and/or other sites on the Internet.
• These cookies are used to provide ads tailored to your interests ("personalized ads").
• Google may collect and use data for ad personalization.

Third-Party Vendors:
• Third-party vendors, including Google, use cookies to serve ads based on your prior visits.
• These vendors may use information about your visits to this and other websites to provide relevant advertisements.`,
  },
  {
    title: 'Personalized Ads & Your Choices',
    icon: 'options-outline',
    content: `Google AdSense may serve personalized advertisements based on your browsing history and interests.

What Personalized Ads Means:
• Ads may be tailored based on your browsing activity across websites.
• Google and third-party ad networks may use cookies, web beacons, and similar technologies for personalization.
• Ad personalization helps show more relevant ads but is not required.

Opting Out of Personalized Ads:
• You may opt out of personalized advertising by visiting Google's Ads Settings at: https://www.google.com/settings/ads
• You can also opt out of third-party vendor cookies by visiting the Network Advertising Initiative opt-out page at: https://www.networkadvertising.org/choices/
• Users in the European Economic Area can manage consent through the TCF consent dialog.`,
  },
  {
    title: 'IAB TCF v2.3 Compliance',
    icon: 'shield-checkmark',
    content: `MetroRide PH is committed to compliance with the IAB Transparency & Consent Framework (TCF) v2.3 standards as of 2026.

Our Compliance Measures:
• We implement the IAB TCF v2.3 consent management platform (CMP) for users in applicable jurisdictions.
• Consent signals are passed to all participating vendors in the advertising supply chain.
• Users can granularly control which purposes and vendors can process their data.
• Consent preferences are stored securely and can be updated at any time.
• We participate in the Global Vendor List (GVL) framework for transparent vendor disclosure.

For users outside TCF-applicable regions, we still provide clear opt-out mechanisms and respect Do Not Track (DNT) browser signals where technically feasible.`,
  },
  {
    title: 'Data Storage & Security',
    icon: 'lock-closed',
    content: `Local Storage (On Your Device):
• User preferences, favorites, and settings stored via AsyncStorage
• Beep card information stored locally only
• Community reports cached locally before anonymous submission

Cloud Storage (Supabase — Singapore Region):
• Anonymous transit data synchronization (fare matrices, station updates)
• No personally identifiable information stored in cloud
• All connections encrypted via HTTPS/TLS 1.3
• Supabase infrastructure in ap-southeast-1 (Singapore)

Data Retention:
• Local data is deleted when you uninstall the app
• Server-side anonymous data is retained for service improvement
• You may request deletion by contacting ${CONTACT_EMAIL}`,
  },
  {
    title: 'Your Rights',
    icon: 'person-circle',
    content: `As a MetroRide PH user, you have the following rights:

Right to Access — All your data is stored locally and fully accessible to you.
Right to Delete — Uninstalling deletes all local data. Contact ${CONTACT_EMAIL} for server-side data deletion.
Right to Opt Out — Location permission can be revoked anytime. Ad personalization can be disabled via Google's Ads Settings.
Right to Portability — Export your favorites and settings via the Settings screen.
Right to Restrict Processing — You can disable specific features (AI, community reports) without affecting core functionality.

For any privacy concerns, contact: ${CONTACT_EMAIL}`,
  },
  {
    title: 'Policy Updates',
    icon: 'refresh-circle',
    content: `This Privacy Policy may be updated periodically to reflect changes in:
• App features or data practices
• Third-party service policies (Google AdSense, Supabase, etc.)
• Legal or regulatory requirements
• IAB TCF framework updates

Significant changes will be communicated via in-app notification. Continued use after changes constitutes acceptance.

Last Updated: ${LAST_UPDATED}
Policy Version: 2.0 (AdSense Compliant)`,
  },
];

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
          <Text style={styles.headerSub}>Last updated: {LAST_UPDATED}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro Glass Card */}
        <View style={styles.introCard}>
          <View style={styles.introIconWrapper}>
            <Ionicons name="shield-checkmark" size={28} color="#00FFFF" />
          </View>
          <Text style={styles.introTitle}>Your Privacy Matters</Text>
          <Text style={styles.introText}>
            MetroRide PH is committed to transparency and protecting your data. This policy explains how we collect, use, and protect your information, including how third-party advertising services operate within our app.
          </Text>
          <View style={styles.introBadgeRow}>
            <View style={styles.introBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#00FFFF" />
              <Text style={styles.introBadgeText}>AdSense Compliant</Text>
            </View>
            <View style={styles.introBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#00FFFF" />
              <Text style={styles.introBadgeText}>IAB TCF v2.3</Text>
            </View>
          </View>
        </View>

        {/* Policy Sections */}
        {SECTIONS.map((section, idx) => (
          <View key={section.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrapper}>
                <Ionicons name={section.icon} size={18} color="#00FFFF" />
              </View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionNum}>{String(idx + 1).padStart(2, '0')}</Text>
            </View>
            <Text style={styles.sectionBody}>{section.content}</Text>
          </View>
        ))}

        {/* Opt-Out Quick Links */}
        <View style={styles.optOutCard}>
          <Text style={styles.optOutTitle}>Quick Opt-Out Links</Text>
          <Pressable
            style={styles.optOutLink}
            onPress={() => Linking.openURL('https://www.google.com/settings/ads')}
          >
            <Ionicons name="open-outline" size={14} color="#00FFFF" />
            <Text style={styles.optOutLinkText}>Google Ads Settings (Opt Out)</Text>
          </Pressable>
          <Pressable
            style={styles.optOutLink}
            onPress={() => Linking.openURL('https://www.networkadvertising.org/choices/')}
          >
            <Ionicons name="open-outline" size={14} color="#00FFFF" />
            <Text style={styles.optOutLinkText}>NAI Opt-Out Page</Text>
          </Pressable>
          <Pressable
            style={styles.optOutLink}
            onPress={() => Linking.openURL('https://optout.aboutads.info/')}
          >
            <Ionicons name="open-outline" size={14} color="#00FFFF" />
            <Text style={styles.optOutLinkText}>DAA Opt-Out Tool</Text>
          </Pressable>
        </View>

        {/* Contact */}
        <View style={styles.contactCard}>
          <Ionicons name="mail" size={22} color="#00FFFF" />
          <View style={styles.contactContent}>
            <Text style={styles.contactTitle}>Questions About Privacy?</Text>
            <Text style={styles.contactSub}>Contact: {CONTACT_EMAIL}</Text>
          </View>
          <Pressable
            style={styles.contactBtn}
            onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
          >
            <Text style={styles.contactBtnText}>Email</Text>
          </Pressable>
        </View>

        <GlobalFooter />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,255,255,0.1)',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(0,255,255,0.08)',
  },
  headerCenter: { flex: 1, paddingHorizontal: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(0,255,255,0.4)', marginTop: 2 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },

  // Glassmorphic Intro Card
  introCard: {
    backgroundColor: 'rgba(0,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.2)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  introIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  introTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  introText: { fontSize: 13, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 20 },
  introBadgeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  introBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.25)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  introBadgeText: { fontSize: 11, fontWeight: '600', color: '#00FFFF' },

  // Section Cards
  section: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.08)',
    padding: 16,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(0,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#fff' },
  sectionNum: { fontSize: 11, color: 'rgba(0,255,255,0.25)', fontWeight: '600' },
  sectionBody: { fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 21 },

  // Opt-Out Card
  optOutCard: {
    backgroundColor: 'rgba(0,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.15)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 10,
  },
  optOutTitle: { fontSize: 14, fontWeight: '700', color: '#00FFFF', marginBottom: 2 },
  optOutLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  optOutLinkText: { fontSize: 13, color: 'rgba(0,255,255,0.7)', fontWeight: '500' },

  // Contact Card
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.2)',
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  contactContent: { flex: 1 },
  contactTitle: { fontSize: 14, fontWeight: '600', color: '#fff' },
  contactSub: { fontSize: 12, color: 'rgba(0,255,255,0.5)', marginTop: 2 },
  contactBtn: {
    backgroundColor: '#00FFFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  contactBtnText: { fontSize: 13, fontWeight: '700', color: '#000000' },
});
