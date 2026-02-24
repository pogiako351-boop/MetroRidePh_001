import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, FontSize, FontWeight, BorderRadius, Spacing, Shadow } from '@/constants/theme';
import {
  getCommuteReminders,
  saveCommuteReminder,
  deleteCommuteReminder,
  requestPermissions,
  CommuteReminder,
} from '@/utils/notifications';
import { getCommuterProfile, CommuterProfile } from '@/utils/commuterPoints';
import { CommuterBadge } from '@/components/ui/CommuterBadge';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function RemindersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [reminders, setReminders] = useState<CommuteReminder[]>([]);
  const [profile, setProfile] = useState<CommuterProfile | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  const loadData = useCallback(async () => {
    const [rems, prof] = await Promise.all([getCommuteReminders(), getCommuterProfile()]);
    setReminders(rems);
    setProfile(prof);
  }, []);

  useEffect(() => {
    loadData();
    requestPermissions().then(setHasPermission);
  }, [loadData]);

  const handleToggle = useCallback(
    async (reminder: CommuteReminder, value: boolean) => {
      if (value && !hasPermission) {
        const granted = await requestPermissions();
        if (!granted) {
          Alert.alert(
            'Permission Required',
            'Please enable notifications in your device settings to receive departure reminders.',
            [{ text: 'OK' }]
          );
          return;
        }
        setHasPermission(true);
      }
      const updated = { ...reminder, enabled: value };
      await saveCommuteReminder(updated);
      setReminders((prev) => prev.map((r) => (r.id === reminder.id ? updated : r)));
    },
    [hasPermission]
  );

  const handleDelete = useCallback(async (id: string) => {
    Alert.alert('Delete Reminder', 'Remove this commute reminder?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCommuteReminder(id);
          setReminders((prev) => prev.filter((r) => r.id !== id));
        },
      },
    ]);
  }, []);

  const formatTime = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Smart Reminders</Text>
          <Text style={styles.headerSub}>Departure & proximity alerts</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Commuter Profile */}
        {profile && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <CommuterBadge profile={profile} />
          </Animated.View>
        )}

        {/* Permission Banner */}
        {!hasPermission && Platform.OS !== 'web' && (
          <Animated.View entering={FadeInDown.duration(400).delay(100)}>
            <Pressable
              style={styles.permissionBanner}
              onPress={() => requestPermissions().then(setHasPermission)}
            >
              <Ionicons name="notifications-off-outline" size={20} color={Colors.amber} />
              <View style={{ flex: 1 }}>
                <Text style={styles.permissionTitle}>Notifications Disabled</Text>
                <Text style={styles.permissionSub}>Tap to enable departure alerts</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.amber} />
            </Pressable>
          </Animated.View>
        )}

        {/* How it works */}
        <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: Colors.amberLight }]}>
              <Text style={styles.infoEmoji}>⏰</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Departure Alerts</Text>
              <Text style={styles.infoDesc}>Get notified 30 min before your scheduled commute if there are delays.</Text>
            </View>
          </View>
          <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: Spacing.md }]}>
            <View style={[styles.infoIcon, { backgroundColor: Colors.violetLight }]}>
              <Text style={styles.infoEmoji}>📍</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Station Proximity Alerts</Text>
              <Text style={styles.infoDesc}>{"Get notified when you're 1 station away from your destination."}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Reminders List */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <Text style={styles.sectionTitle}>Commute Reminders</Text>
          {reminders.map((reminder, idx) => (
            <Animated.View
              key={reminder.id}
              entering={FadeInDown.duration(400).delay(250 + idx * 80)}
            >
              <View style={styles.reminderCard}>
                <View style={styles.reminderHeader}>
                  <View style={[styles.reminderIconWrapper, { backgroundColor: reminder.enabled ? Colors.amberLight : Colors.borderLight }]}>
                    <Ionicons
                      name={reminder.label.toLowerCase().includes('morning') ? 'sunny-outline' : 'moon-outline'}
                      size={20}
                      color={reminder.enabled ? Colors.amber : Colors.textTertiary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reminderLabel}>{reminder.label}</Text>
                    <Text style={styles.reminderStation}>{reminder.stationName}</Text>
                  </View>
                  <View style={styles.reminderRight}>
                    <Text style={[styles.reminderTime, reminder.enabled && { color: Colors.amber }]}>
                      {formatTime(reminder.departureTime)}
                    </Text>
                    <Switch
                      value={reminder.enabled}
                      onValueChange={(v) => handleToggle(reminder, v)}
                      trackColor={{ false: Colors.border, true: Colors.amber + '80' }}
                      thumbColor={reminder.enabled ? Colors.amber : Colors.textTertiary}
                    />
                  </View>
                </View>

                {/* Days of week */}
                <View style={styles.daysRow}>
                  {DAY_LABELS.map((day, i) => (
                    <View
                      key={day}
                      style={[
                        styles.dayChip,
                        reminder.daysOfWeek.includes(i) && { backgroundColor: Colors.amber + '25', borderColor: Colors.amber },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          reminder.daysOfWeek.includes(i) && { color: Colors.amberDark },
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                  ))}
                  <Pressable onPress={() => handleDelete(reminder.id)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={14} color={Colors.textTertiary} />
                  </Pressable>
                </View>

                {reminder.enabled && (
                  <View style={styles.enabledBanner}>
                    <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                    <Text style={styles.enabledText}>
                      Alert set for 30 min before {formatTime(reminder.departureTime)}
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>
          ))}
        </Animated.View>

        {/* Proximity Alert Info */}
        <Animated.View entering={FadeInDown.duration(400).delay(400)}>
          <Text style={styles.sectionTitle}>Proximity Alerts</Text>
          <View style={styles.proximityCard}>
            <View style={styles.proximityRow}>
              <View style={[styles.proximityIcon, { backgroundColor: Colors.violetLight }]}>
                <Ionicons name="location-outline" size={22} color={Colors.violet} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.proximityTitle}>1-Station Warning</Text>
                <Text style={styles.proximityDesc}>
                  {"When traveling, you'll get a notification when you're 1 station away from your saved destination."}
                </Text>
              </View>
            </View>
            <View style={styles.proximityStatus}>
              <Ionicons
                name={hasPermission ? 'checkmark-circle' : 'alert-circle'}
                size={16}
                color={hasPermission ? Colors.success : Colors.amber}
              />
              <Text style={[styles.proximityStatusText, { color: hasPermission ? Colors.success : Colors.amber }]}>
                {hasPermission ? 'Ready – uses your favorites for destination' : 'Enable notifications to use this feature'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Tips */}
        <Animated.View entering={FadeInDown.duration(400).delay(500)}>
          <Text style={styles.sectionTitle}>Commuter Tips</Text>
          <View style={styles.tipsCard}>
            {[
              { icon: '🚇', tip: 'Rush hours are 7-9 AM and 5-7 PM. Leave 15 min earlier to avoid crowds.' },
              { icon: '💳', tip: 'Keep your Beep card loaded to at least ₱50 to avoid delays at fare gates.' },
              { icon: '📱', tip: 'Earn Commuter Points by reporting station issues to help fellow riders.' },
            ].map((tip, i) => (
              <View key={i} style={[styles.tipRow, i > 0 && { borderTopWidth: 1, borderTopColor: Colors.borderLight }]}>
                <Text style={styles.tipEmoji}>{tip.icon}</Text>
                <Text style={styles.tipText}>{tip.tip}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: Spacing.md,
    ...Shadow.sm,
  },
  backBtn: { padding: Spacing.sm, marginLeft: -Spacing.sm },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  headerSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.amberLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.amber + '40',
  },
  permissionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.amberDark },
  permissionSub: { fontSize: FontSize.xs, color: Colors.amber },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.md },
  infoIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  infoEmoji: { fontSize: 20 },
  infoTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text, marginBottom: 2 },
  infoDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.md },
  reminderCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  reminderHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  reminderIconWrapper: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  reminderLabel: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  reminderStation: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  reminderRight: { alignItems: 'flex-end', gap: 4 },
  reminderTime: { fontSize: FontSize.lg, fontWeight: FontWeight.heavy, color: Colors.textSecondary },
  daysRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'center', flexWrap: 'wrap' },
  dayChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.background,
  },
  dayText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: Colors.textTertiary },
  deleteBtn: { marginLeft: 'auto', padding: 4 },
  enabledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.md,
  },
  enabledText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.medium },
  proximityCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  proximityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.md },
  proximityIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  proximityTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 2 },
  proximityDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  proximityStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  proximityStatusText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  tipsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.xl,
  },
  tipRow: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg, alignItems: 'flex-start' },
  tipEmoji: { fontSize: 20 },
  tipText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
});
