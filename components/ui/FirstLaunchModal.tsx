import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const FIRST_LAUNCH_KEY = '@metroride_terms_accepted';

export const TERMS_VERSION = '1.0';

interface FirstLaunchModalProps {
  visible: boolean;
  onAccept: () => void;
}

export default function FirstLaunchModal({ visible, onAccept }: FirstLaunchModalProps) {
  const [termsScrolled, setTermsScrolled] = useState(false);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleScroll = (e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const nearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;
    if (nearBottom && !termsScrolled) {
      setTermsScrolled(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const toggleCheck = () => {
    if (!termsScrolled) return;
    Haptics.selectionAsync();
    setChecked((c) => !c);
  };

  const handleAccept = async () => {
    if (!checked || loading) return;
    setLoading(true);
    // Tactile pulse: heavy impact first, then success notification for a two-stage haptic feel
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.setItem(FIRST_LAUNCH_KEY, TERMS_VERSION);
    setLoading(false);
    onAccept();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent>
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoIcon}>🚇</Text>
            </View>
            <View>
              <Text style={styles.appName}>MetroRide PH</Text>
              <Text style={styles.tagline}>Elite Rail-Only Transit Engine</Text>
            </View>
          </View>
          {/* Rail line badge strip */}
          <View style={styles.lineBadgeRow}>
            <View style={[styles.lineBadge, { backgroundColor: 'rgba(245,197,0,0.15)', borderColor: 'rgba(245,197,0,0.35)' }]}>
              <View style={[styles.lineDot, { backgroundColor: '#F5C500' }]} />
              <Text style={[styles.lineBadgeText, { color: '#B8900A' }]}>LRT-1</Text>
            </View>
            <View style={[styles.lineBadge, { backgroundColor: 'rgba(17,67,168,0.15)', borderColor: 'rgba(17,67,168,0.35)' }]}>
              <View style={[styles.lineDot, { backgroundColor: '#1143A8' }]} />
              <Text style={[styles.lineBadgeText, { color: '#4A7FD4' }]}>MRT-3</Text>
            </View>
            <View style={[styles.lineBadge, { backgroundColor: 'rgba(156,39,176,0.15)', borderColor: 'rgba(156,39,176,0.35)' }]}>
              <View style={[styles.lineDot, { backgroundColor: '#9C27B0' }]} />
              <Text style={[styles.lineBadgeText, { color: '#CE93D8' }]}>LRT-2</Text>
            </View>
          </View>
          <Text style={styles.title}>Welcome Aboard</Text>
          <Text style={styles.subtitle}>
            {"MetroRide PH is a "}<Text style={styles.subtitleBold}>rail-only</Text>{" precision transit app for Metro Manila's LRT-1, MRT-3, and LRT-2 lines. Before you begin, please review our Terms of Service and Privacy Policy."}
          </Text>
        </View>

        {/* Scrollable terms */}
        <View style={styles.scrollContainer}>
          <Text style={styles.scrollHint}>
            {termsScrolled ? '✓ Terms reviewed' : 'Scroll to review terms'}
          </Text>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator
            onScroll={handleScroll}
            scrollEventThrottle={100}
          >
            <Text style={styles.sectionTitle}>Terms of Service</Text>
            <Text style={styles.body}>
              {'MetroRide PH is a high-precision, rail-only transit engine exclusively dedicated to Metro Manila\'s three urban rail lines: LRT-1 (Light Rail Manila Corporation), MRT-3 (Metro Rail Transit Corporation), and LRT-2 (Light Rail Transit Authority). This app does NOT cover buses, jeepneys, or any other transport mode.'}
              {'\n\n'}
              <Text style={styles.bold}>1. Rail-Only Scope & Informational Use</Text>
              {'\n'}
              All fare data, schedules, and transit information are sourced from official LRTA and MRTC publications (2026 Official Rail Fare Matrices) and provided for guidance purposes only. MetroRide PH covers only LRT-1, MRT-3, and LRT-2. Always verify current fares with official rail operator channels.
              {'\n\n'}
              <Text style={styles.bold}>2. 2026 Rail Fare Engine</Text>
              {'\n'}
              Fare calculations use the official 2026 station-to-station fare matrices for LRT-1 (20 stations), MRT-3 (13 stations), and LRT-2 (13 stations). Includes SJT surcharges and statutory 20% discounts for students, seniors, and PWDs.
              {'\n\n'}
              <Text style={styles.bold}>3. Live Cloud Sync</Text>
              {'\n'}
              Real-time data is synced from the MetroRide PH Supabase cloud (Singapore region). Live crowd reports and station statuses are community-sourced and may not reflect official transit authority data. The app functions fully offline when cloud sync is unavailable.
              {'\n\n'}
              <Text style={styles.bold}>4. MetroAI Rail Specialist Disclaimer</Text>
              {'\n'}
              MetroAI is powered by large language models and is strictly scoped to LRT-1, MRT-3, and LRT-2 operations. It does not provide information on buses, jeepneys, or other transport. AI responses are for informational use only and may not reflect real-time conditions.
              {'\n\n'}
              <Text style={styles.bold}>5. Community Reports</Text>
              {'\n'}
              User-submitted crowd and delay reports are community contributions and are not verified by MetroRide PH or any transit authority.
              {'\n\n'}
              <Text style={styles.bold}>6. No Liability</Text>
              {'\n'}
              MetroRide PH is not affiliated with LRTA, MRTC, or any Philippine government transit agency. We are not liable for missed trains, fare disputes, or decisions made based on app data.
              {'\n\n'}
              <Text style={styles.sectionTitle}>Privacy Policy Summary</Text>
              {'\n'}
              <Text style={styles.bold}>Data We Collect</Text>
              {'\n'}• Approximate location (optional, for nearby stations){'\n'}
              • App preferences stored locally on your device{'\n'}
              • Anonymous crash and performance analytics{'\n\n'}
              <Text style={styles.bold}>Data We DO NOT Collect</Text>
              {'\n'}• Precise GPS coordinates are never uploaded{'\n'}
              • No personally identifiable information is stored on our servers{'\n'}
              • No data is sold to third parties{'\n\n'}
              <Text style={styles.bold}>Permissions</Text>
              {'\n'}• <Text style={styles.mono}>INTERNET</Text>: Required for live data sync and AI features{'\n'}
              • <Text style={styles.mono}>ACCESS_NETWORK_STATE</Text>: Offline mode detection{'\n'}
              • <Text style={styles.mono}>ACCESS_FINE_LOCATION</Text>: Optional, nearest station detection{'\n\n'}
              <Text style={styles.bold}>Data Retention</Text>
              {'\n'}
              All user preferences and favorites are stored locally on your device via AsyncStorage. Uninstalling the app removes all local data.
              {'\n\n'}
              <Text style={styles.bold}>Changes to This Policy</Text>
              {'\n'}
              We may update our Privacy Policy periodically. Continued use of the app after changes constitutes acceptance of the revised policy.
              {'\n\n'}
              {'For the full Privacy Policy, visit our website or tap "View Full Policy" below.'}
            </Text>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => Linking.openURL('https://metrorideph.app/privacy')}
            >
              <Ionicons name="open-outline" size={14} color="#1A73E8" />
              <Text style={styles.linkText}>View Full Privacy Policy</Text>
            </TouchableOpacity>
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>

        {/* Checkbox */}
        <Pressable
          style={[styles.checkRow, !termsScrolled && styles.checkRowDisabled]}
          onPress={toggleCheck}
        >
          <View style={[styles.checkbox, checked && styles.checkboxChecked, !termsScrolled && styles.checkboxLocked]}>
            {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={[styles.checkLabel, !termsScrolled && styles.checkLabelDisabled]}>
            I have read and agree to the Terms of Service and Privacy Policy
          </Text>
        </Pressable>

        {!termsScrolled && (
          <Text style={styles.scrollWarning}>Please scroll to the bottom to review the terms</Text>
        )}

        {/* Accept button */}
        <TouchableOpacity
          style={[styles.acceptButton, (!checked || loading) && styles.acceptButtonDisabled]}
          onPress={handleAccept}
          activeOpacity={0.85}
          disabled={!checked || loading}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.acceptText}>{loading ? 'Getting started…' : 'Accept & Continue'}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>MetroRide PH v3.0 • Terms v{TERMS_VERSION}</Text>
      </View>
    </Modal>
  );
}

export async function checkFirstLaunchAccepted(): Promise<boolean> {
  const val = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
  return val === TERMS_VERSION;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0F1E',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 16,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(26,115,232,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(26,115,232,0.3)',
  },
  logoIcon: { fontSize: 26 },
  appName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  tagline: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 20,
  },
  scrollContainer: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  scrollHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginTop: 4,
    marginBottom: 8,
  },
  body: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
  },
  mono: {
    fontFamily: 'monospace',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  linkText: {
    fontSize: 13,
    color: '#1A73E8',
    fontWeight: '600',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
    paddingVertical: 4,
  },
  checkRowDisabled: { opacity: 0.4 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: '#1A73E8',
    borderColor: '#1A73E8',
  },
  checkboxLocked: {
    borderColor: 'rgba(255,255,255,0.15)',
  },
  checkLabel: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 19,
  },
  checkLabelDisabled: {
    color: 'rgba(255,255,255,0.35)',
  },
  scrollWarning: {
    fontSize: 11,
    color: '#F59E0B',
    textAlign: 'center',
    marginBottom: 10,
  },
  acceptButton: {
    backgroundColor: '#1A73E8',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  acceptButtonDisabled: {
    backgroundColor: 'rgba(26,115,232,0.35)',
  },
  acceptText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  version: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
  },

  lineBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  lineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  lineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  lineBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subtitleBold: {
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
  },
});
