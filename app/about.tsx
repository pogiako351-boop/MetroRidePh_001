import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

const APP_VERSION = Constants.expoConfig?.version ?? '3.0.0';
const BUILD_DATE = '2026';
const DATA_VERSION = '2026 Official Fare Matrix';

interface InfoRow {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
  color?: string;
}

interface LinkItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel: string;
  url: string;
  color: string;
}

const OFFICIAL_LINKS: LinkItem[] = [
  {
    icon: 'train',
    label: 'LRT-1 Official',
    sublabel: 'Light Rail Manila Corporation',
    url: 'https://www.lrta.gov.ph',
    color: '#F5C500',
  },
  {
    icon: 'subway',
    label: 'LRT-2 Official',
    sublabel: 'Light Rail Transit Authority',
    url: 'https://lrt2.lrta.gov.ph',
    color: '#9C27B0',
  },
  {
    icon: 'navigate',
    label: 'MRT-3 Official',
    sublabel: 'Metro Rail Transit Corporation',
    url: 'https://www.mrtc.com.ph',
    color: '#1143A8',
  },
  {
    icon: 'card',
    label: 'Beep Card',
    sublabel: 'AF Payments Inc.',
    url: 'https://beep.com.ph',
    color: '#1A73E8',
  },
  {
    icon: 'business',
    label: 'DOTC / DOTr',
    sublabel: 'Dept. of Transportation',
    url: 'https://dotr.gov.ph',
    color: '#34A853',
  },
];

const TEAM_CREDITS = [
  { role: 'Fare Data Source', value: 'LRTA & MRTC Official Rates 2026' },
  { role: 'AI Engine', value: 'Newell AI (fastshot.ai)' },
  { role: 'Backend', value: 'Supabase (Singapore Region)' },
  { role: 'Payments', value: 'Adapty (In-App Purchases)' },
  { role: 'Framework', value: 'Expo + React Native' },
];

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const openLink = async (url: string) => {
    Haptics.selectionAsync();
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert('Error', 'Cannot open this link');
    } catch {
      Alert.alert('Error', 'Failed to open link');
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1E" />

      {/* Header */}
      <LinearGradient
        colors={['#0D1B3E', '#0A0F1E']}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => { Haptics.selectionAsync(); router.back(); }}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.appIconWrapper}>
            <Text style={styles.appIconEmoji}>🚇</Text>
            <View style={styles.liveRing} />
          </View>
          <Text style={styles.appName}>MetroRide PH</Text>
          <Text style={styles.appSlogan}>{"Metro Manila's Official Transit Companion"}</Text>

          <View style={styles.badgeRow}>
            <View style={styles.versionBadge}>
              <Ionicons name="code-slash" size={11} color="#1A73E8" />
              <Text style={styles.versionText}>v{APP_VERSION}</Text>
            </View>
            <View style={[styles.versionBadge, { borderColor: 'rgba(52,168,83,0.3)', backgroundColor: 'rgba(52,168,83,0.08)' }]}>
              <Ionicons name="checkmark-circle" size={11} color="#34A853" />
              <Text style={[styles.versionText, { color: '#34A853' }]}>Production</Text>
            </View>
            <View style={[styles.versionBadge, { borderColor: 'rgba(245,197,0,0.3)', backgroundColor: 'rgba(245,197,0,0.08)' }]}>
              <Ionicons name="calendar" size={11} color="#F5C500" />
              <Text style={[styles.versionText, { color: '#F5C500' }]}>{BUILD_DATE}</Text>
            </View>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>App Information</Text>
          {([
            { icon: 'information-circle', label: 'Version', value: `${APP_VERSION} (Phase 6)` },
            { icon: 'server', label: 'Data Version', value: DATA_VERSION },
            { icon: 'globe', label: 'Backend Region', value: 'Supabase Singapore (ap-southeast-1)' },
            { icon: 'shield-checkmark', label: 'Compliance', value: 'Google Play Store Ready' },
          ] as InfoRow[]).map((item) => (
            <View key={item.label} style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name={item.icon} size={16} color="rgba(255,255,255,0.6)" />
              </View>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Description */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>About MetroRide PH</Text>
          <Text style={styles.bodyText}>
            MetroRide PH is a comprehensive transit assistant built for Metro Manila commuters. It provides real-time fare calculations, route planning, crowd monitoring, and AI-powered commuter assistance for the MRT-3, LRT-1, and LRT-2 lines.
          </Text>
          <Text style={[styles.bodyText, { marginTop: 10 }]}>
            Fare data is sourced from official LRTA and MRTC publications and reflects the 2026 official fare matrix. The app operates independently from and is not affiliated with any government transit agency.
          </Text>
        </View>

        {/* Official Sources */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Official Transit Sources</Text>
          <Text style={styles.cardSubtitle}>Tap to visit official websites</Text>
          {OFFICIAL_LINKS.map((link) => (
            <TouchableOpacity
              key={link.label}
              style={styles.linkRow}
              onPress={() => openLink(link.url)}
              activeOpacity={0.75}
            >
              <View style={[styles.linkIcon, { backgroundColor: `${link.color}18`, borderColor: `${link.color}30` }]}>
                <Ionicons name={link.icon} size={18} color={link.color} />
              </View>
              <View style={styles.linkContent}>
                <Text style={styles.linkLabel}>{link.label}</Text>
                <Text style={styles.linkSub}>{link.sublabel}</Text>
              </View>
              <Ionicons name="open-outline" size={15} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Technology Credits */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Technology Stack</Text>
          {TEAM_CREDITS.map((c) => (
            <View key={c.role} style={styles.creditRow}>
              <Text style={styles.creditRole}>{c.role}</Text>
              <Text style={styles.creditValue}>{c.value}</Text>
            </View>
          ))}
        </View>

        {/* Legal */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Legal</Text>
          <TouchableOpacity
            style={styles.legalRow}
            onPress={() => { Haptics.selectionAsync(); router.push('/privacy-policy'); }}
          >
            <Ionicons name="document-text" size={18} color="rgba(255,255,255,0.6)" />
            <Text style={styles.legalText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
          <View style={styles.separator} />
          <TouchableOpacity
            style={styles.legalRow}
            onPress={() => openLink('https://metrorideph.app/terms')}
          >
            <Ionicons name="shield" size={18} color="rgba(255,255,255,0.6)" />
            <Text style={styles.legalText}>Terms of Service</Text>
            <Ionicons name="open-outline" size={15} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.3)" />
          <Text style={styles.disclaimerText}>
            MetroRide PH is an independent app and is NOT affiliated with LRTA, MRTC, DOTr, or any Philippine government agency. All fare data is for informational purposes only.
          </Text>
        </View>

        <Text style={styles.copyright}>
          © {BUILD_DATE} MetroRide PH. All rights reserved.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0F1E' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },

  hero: { alignItems: 'center', paddingVertical: 32 },
  appIconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(26,115,232,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(26,115,232,0.3)',
  },
  appIconEmoji: { fontSize: 44 },
  liveRing: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#34A853',
    borderWidth: 2.5,
    borderColor: '#0A0F1E',
  },
  appName: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 6 },
  appSlogan: { fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginBottom: 16 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  versionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(26,115,232,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(26,115,232,0.3)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  versionText: { fontSize: 11, fontWeight: '600', color: '#1A73E8' },

  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 4 },
  cardSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12 },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  infoIcon: { width: 28, alignItems: 'center' },
  infoLabel: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  infoValue: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)', maxWidth: '55%', textAlign: 'right' },

  bodyText: { fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 20 },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  linkIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  linkContent: { flex: 1 },
  linkLabel: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 2 },
  linkSub: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },

  creditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  creditRole: { fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  creditValue: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)', maxWidth: '55%', textAlign: 'right' },

  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  legalText: { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },

  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    marginBottom: 12,
  },
  disclaimerText: { flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 16 },

  copyright: { fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginBottom: 8 },
});
