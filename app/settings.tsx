import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '@/constants/theme';
import { hapticLight, hapticSuccess } from '@/utils/haptics';

const KEYS = {
  QUIET_HOURS_ENABLED: '@metroride_quiet_hours_enabled',
  QUIET_START: '@metroride_quiet_start',
  QUIET_END: '@metroride_quiet_end',
  ALERT_LINES: '@metroride_alert_lines',
  NOTIF_DELAYS: '@metroride_notif_delays',
  NOTIF_CROWD: '@metroride_notif_crowd',
  NOTIF_SERVICE: '@metroride_notif_service',
};

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 === 0 ? 12 : i % 12;
  const ampm = i < 12 ? 'AM' : 'PM';
  return { value: i, label: `${h}:00 ${ampm}` };
});

const LINE_OPTIONS = [
  { id: 'MRT-3', label: 'MRT-3', color: Colors.mrt3, description: 'North Ave – Taft Ave' },
  { id: 'LRT-1', label: 'LRT-1', color: Colors.lrt1, description: 'Fernando Poe Jr – Baclaran' },
  { id: 'LRT-2', label: 'LRT-2', color: Colors.lrt2, description: 'Antipolo – Recto' },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState(22); // 10 PM
  const [quietEnd, setQuietEnd] = useState(6); // 6 AM
  const [selectedLines, setSelectedLines] = useState<string[]>(['MRT-3', 'LRT-1', 'LRT-2']);
  const [notifDelays, setNotifDelays] = useState(true);
  const [notifCrowd, setNotifCrowd] = useState(true);
  const [notifService, setNotifService] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [qe, qs, qen, lines, nd, nc, ns] = await Promise.all([
        AsyncStorage.getItem(KEYS.QUIET_HOURS_ENABLED),
        AsyncStorage.getItem(KEYS.QUIET_START),
        AsyncStorage.getItem(KEYS.QUIET_END),
        AsyncStorage.getItem(KEYS.ALERT_LINES),
        AsyncStorage.getItem(KEYS.NOTIF_DELAYS),
        AsyncStorage.getItem(KEYS.NOTIF_CROWD),
        AsyncStorage.getItem(KEYS.NOTIF_SERVICE),
      ]);
      if (qe) setQuietEnabled(JSON.parse(qe));
      if (qs) setQuietStart(JSON.parse(qs));
      if (qen) setQuietEnd(JSON.parse(qen));
      if (lines) setSelectedLines(JSON.parse(lines));
      if (nd !== null) setNotifDelays(JSON.parse(nd));
      if (nc !== null) setNotifCrowd(JSON.parse(nc));
      if (ns !== null) setNotifService(JSON.parse(ns));
    } catch {}
  };

  const saveSettings = useCallback(async () => {
    hapticSuccess();
    try {
      await Promise.all([
        AsyncStorage.setItem(KEYS.QUIET_HOURS_ENABLED, JSON.stringify(quietEnabled)),
        AsyncStorage.setItem(KEYS.QUIET_START, JSON.stringify(quietStart)),
        AsyncStorage.setItem(KEYS.QUIET_END, JSON.stringify(quietEnd)),
        AsyncStorage.setItem(KEYS.ALERT_LINES, JSON.stringify(selectedLines)),
        AsyncStorage.setItem(KEYS.NOTIF_DELAYS, JSON.stringify(notifDelays)),
        AsyncStorage.setItem(KEYS.NOTIF_CROWD, JSON.stringify(notifCrowd)),
        AsyncStorage.setItem(KEYS.NOTIF_SERVICE, JSON.stringify(notifService)),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  }, [quietEnabled, quietStart, quietEnd, selectedLines, notifDelays, notifCrowd, notifService]);

  const toggleLine = useCallback((lineId: string) => {
    hapticLight();
    setSelectedLines((prev) =>
      prev.includes(lineId) ? prev.filter((l) => l !== lineId) : [...prev, lineId]
    );
  }, []);

  const hourLabel = (h: number) =>
    HOUR_OPTIONS.find((o) => o.value === h)?.label ?? `${h}:00`;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <Pressable onPress={saveSettings} style={[styles.saveBtn, saved && styles.saveBtnSuccess]}>
          <Ionicons name={saved ? 'checkmark' : 'save-outline'} size={18} color={saved ? '#FFF' : Colors.primary} />
          <Text style={[styles.saveBtnText, saved && styles.saveBtnTextSuccess]}>
            {saved ? 'Saved!' : 'Save'}
          </Text>
        </Pressable>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Notification Quiet Hours */}
        <Animated.View entering={FadeInDown.duration(500).delay(100)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="moon" size={18} color={Colors.violet} />
            </View>
            <View style={styles.sectionTitleBlock}>
              <Text style={styles.sectionTitle}>Quiet Hours</Text>
              <Text style={styles.sectionSub}>Silence notifications during set times</Text>
            </View>
            <Switch
              value={quietEnabled}
              onValueChange={(v) => {
                hapticLight();
                setQuietEnabled(v);
              }}
              trackColor={{ false: Colors.border, true: Colors.violet }}
              thumbColor={Colors.surface}
              ios_backgroundColor={Colors.border}
            />
          </View>

          {quietEnabled && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.quietConfig}>
              {/* Start Time */}
              <Pressable
                style={styles.timeRow}
                onPress={() => {
                  hapticLight();
                  setShowStartPicker(!showStartPicker);
                  setShowEndPicker(false);
                }}
              >
                <View style={styles.timeLabel}>
                  <Ionicons name="moon-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.timeLabelText}>Start Time</Text>
                </View>
                <View style={styles.timeValue}>
                  <Text style={styles.timeValueText}>{hourLabel(quietStart)}</Text>
                  <Ionicons
                    name={showStartPicker ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={Colors.violet}
                  />
                </View>
              </Pressable>
              {showStartPicker && (
                <ScrollView style={styles.pickerList} nestedScrollEnabled>
                  {HOUR_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      style={[styles.pickerItem, opt.value === quietStart && styles.pickerItemSelected]}
                      onPress={() => {
                        hapticLight();
                        setQuietStart(opt.value);
                        setShowStartPicker(false);
                      }}
                    >
                      <Text style={[styles.pickerItemText, opt.value === quietStart && styles.pickerItemTextSelected]}>
                        {opt.label}
                      </Text>
                      {opt.value === quietStart && <Ionicons name="checkmark" size={16} color={Colors.violet} />}
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              {/* End Time */}
              <Pressable
                style={[styles.timeRow, { marginTop: Spacing.sm }]}
                onPress={() => {
                  hapticLight();
                  setShowEndPicker(!showEndPicker);
                  setShowStartPicker(false);
                }}
              >
                <View style={styles.timeLabel}>
                  <Ionicons name="sunny-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.timeLabelText}>End Time</Text>
                </View>
                <View style={styles.timeValue}>
                  <Text style={styles.timeValueText}>{hourLabel(quietEnd)}</Text>
                  <Ionicons
                    name={showEndPicker ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={Colors.violet}
                  />
                </View>
              </Pressable>
              {showEndPicker && (
                <ScrollView style={styles.pickerList} nestedScrollEnabled>
                  {HOUR_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      style={[styles.pickerItem, opt.value === quietEnd && styles.pickerItemSelected]}
                      onPress={() => {
                        hapticLight();
                        setQuietEnd(opt.value);
                        setShowEndPicker(false);
                      }}
                    >
                      <Text style={[styles.pickerItemText, opt.value === quietEnd && styles.pickerItemTextSelected]}>
                        {opt.label}
                      </Text>
                      {opt.value === quietEnd && <Ionicons name="checkmark" size={16} color={Colors.violet} />}
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              <View style={styles.quietSummary}>
                <Ionicons name="information-circle-outline" size={14} color={Colors.textTertiary} />
                <Text style={styles.quietSummaryText}>
                  No alerts from {hourLabel(quietStart)} to {hourLabel(quietEnd)}
                </Text>
              </View>
            </Animated.View>
          )}
        </Animated.View>

        {/* Line Filter Customization */}
        <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.section}>
          <View style={[styles.sectionHeader, { marginBottom: Spacing.md }]}>
            <View style={[styles.sectionIcon, { backgroundColor: Colors.primarySoft }]}>
              <Ionicons name="train" size={18} color={Colors.primary} />
            </View>
            <View style={styles.sectionTitleBlock}>
              <Text style={styles.sectionTitle}>Line Filter</Text>
              <Text style={styles.sectionSub}>Only follow alerts from these lines</Text>
            </View>
          </View>

          {LINE_OPTIONS.map((line) => {
            const selected = selectedLines.includes(line.id);
            return (
              <Pressable
                key={line.id}
                onPress={() => toggleLine(line.id)}
                style={[styles.lineRow, selected && { borderColor: line.color + '40', backgroundColor: line.color + '08' }]}
              >
                <View style={[styles.lineDotBig, { backgroundColor: line.color }]} />
                <View style={styles.lineInfo}>
                  <Text style={styles.lineLabel}>{line.label}</Text>
                  <Text style={styles.lineDesc}>{line.description}</Text>
                </View>
                <View style={[styles.lineToggle, { backgroundColor: selected ? line.color : Colors.border }]}>
                  <Ionicons
                    name={selected ? 'checkmark' : 'remove'}
                    size={14}
                    color="#FFF"
                  />
                </View>
              </Pressable>
            );
          })}
          {selectedLines.length === 0 && (
            <Text style={styles.noLineWarning}>{"⚠️ No lines selected — you won't receive any alerts"}</Text>
          )}
        </Animated.View>

        {/* Notification Types */}
        <Animated.View entering={FadeInDown.duration(500).delay(300)} style={styles.section}>
          <View style={[styles.sectionHeader, { marginBottom: Spacing.md }]}>
            <View style={[styles.sectionIcon, { backgroundColor: Colors.amberLight }]}>
              <Ionicons name="notifications" size={18} color={Colors.amber} />
            </View>
            <View style={styles.sectionTitleBlock}>
              <Text style={styles.sectionTitle}>Alert Types</Text>
              <Text style={styles.sectionSub}>Choose which events notify you</Text>
            </View>
          </View>

          {[
            { label: 'Service Delays', desc: 'Train delays and speed restrictions', value: notifDelays, setter: setNotifDelays },
            { label: 'Heavy Crowds', desc: 'When a station reaches heavy crowd level', value: notifCrowd, setter: setNotifCrowd },
            { label: 'Service Updates', desc: 'Scheduled maintenance and new announcements', value: notifService, setter: setNotifService },
          ].map((item) => (
            <View key={item.label} style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>{item.label}</Text>
                <Text style={styles.toggleDesc}>{item.desc}</Text>
              </View>
              <Switch
                value={item.value}
                onValueChange={(v) => {
                  hapticLight();
                  item.setter(v);
                }}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.surface}
                ios_backgroundColor={Colors.border}
              />
            </View>
          ))}
        </Animated.View>

        {/* Navigation Links */}
        <Animated.View entering={FadeInDown.duration(500).delay(400)} style={styles.section}>
          <View style={[styles.sectionHeader, { marginBottom: Spacing.md }]}>
            <View style={[styles.sectionIcon, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="grid" size={18} color="#059669" />
            </View>
            <Text style={styles.sectionTitle}>More</Text>
          </View>

          {[
            { icon: 'card', label: 'Beep Card Manager', desc: 'Manage your transit card balance', route: '/beep-card', color: '#059669', bg: '#D1FAE5' },
            { icon: 'stats-chart', label: 'My Insights', desc: 'View commute stats and badges', route: '/insights', color: Colors.violet, bg: Colors.violetLight },
            { icon: 'diamond', label: 'Go Premium', desc: 'Unlock AI Vision and advanced features', route: '/premium', color: Colors.gold, bg: Colors.amberLight },
          ].map((item) => (
            <Pressable
              key={item.label}
              onPress={() => { hapticLight(); router.push(item.route as '/beep-card'); }}
              style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
            >
              <View style={[styles.linkIcon, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon as 'card'} size={18} color={item.color} />
              </View>
              <View style={styles.linkInfo}>
                <Text style={styles.linkLabel}>{item.label}</Text>
                <Text style={styles.linkDesc}>{item.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </Pressable>
          ))}
        </Animated.View>

        {/* App Info */}
        <Animated.View entering={FadeInDown.duration(500).delay(500)} style={styles.appInfo}>
          <Text style={styles.appName}>MetroRide PH</Text>
          <Text style={styles.appVersion}>Version 3.0 • Phase 3 Elite</Text>
          <Text style={styles.appCopyright}>© 2024 MetroRide PH. All rights reserved.</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    ...Shadow.sm,
  },
  backBtn: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  saveBtnSuccess: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  saveBtnText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  saveBtnTextSuccess: {
    color: '#FFF',
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitleBlock: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  sectionSub: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  quietConfig: {
    marginTop: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  timeLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  timeLabelText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  timeValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeValueText: {
    fontSize: FontSize.md,
    color: Colors.violet,
    fontWeight: FontWeight.bold,
  },
  pickerList: {
    maxHeight: 180,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  pickerItemSelected: {
    backgroundColor: Colors.violetLight,
  },
  pickerItemText: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  pickerItemTextSelected: {
    color: Colors.violet,
    fontWeight: FontWeight.semibold,
  },
  quietSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  quietSummaryText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.sm,
  },
  lineDotBig: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  lineInfo: {
    flex: 1,
  },
  lineLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  lineDesc: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  lineToggle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noLineWarning: {
    fontSize: FontSize.sm,
    color: Colors.warning,
    fontWeight: FontWeight.medium,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  toggleInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  toggleLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  toggleDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  pressed: {
    opacity: 0.7,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkInfo: {
    flex: 1,
  },
  linkLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  linkDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: 4,
  },
  appName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  appVersion: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  appCopyright: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
});
