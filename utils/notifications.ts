import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const REMINDERS_KEY = '@metroride_smart_reminders';
const PREFS_KEY = '@metroride_notification_prefs';

export interface CommuteReminder {
  id: string;
  type: 'departure' | 'proximity';
  label: string;
  stationId: string;
  stationName: string;
  departureTime: string; // "HH:MM"
  enabled: boolean;
  daysOfWeek: number[]; // 0=Sun, 1=Mon ... 6=Sat
}

export interface NotificationPrefs {
  departureAlertsEnabled: boolean;
  proximityAlertsEnabled: boolean;
  proximityRadiusKm: number;
}

export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const data = await AsyncStorage.getItem(PREFS_KEY);
    if (!data) return { departureAlertsEnabled: true, proximityAlertsEnabled: true, proximityRadiusKm: 1 };
    return JSON.parse(data);
  } catch {
    return { departureAlertsEnabled: true, proximityAlertsEnabled: true, proximityRadiusKm: 1 };
  }
}

export async function saveNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export async function getCommuteReminders(): Promise<CommuteReminder[]> {
  try {
    const data = await AsyncStorage.getItem(REMINDERS_KEY);
    if (!data) return getDefaultReminders();
    return JSON.parse(data);
  } catch {
    return getDefaultReminders();
  }
}

export async function saveCommuteReminder(reminder: CommuteReminder): Promise<void> {
  const existing = await getCommuteReminders();
  const idx = existing.findIndex((r) => r.id === reminder.id);
  if (idx >= 0) {
    existing[idx] = reminder;
  } else {
    existing.push(reminder);
  }
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(existing));
  if (reminder.enabled) {
    await scheduleReminderNotification(reminder);
  } else {
    await cancelReminderNotification(reminder.id);
  }
}

export async function deleteCommuteReminder(id: string): Promise<void> {
  const existing = await getCommuteReminders();
  const updated = existing.filter((r) => r.id !== id);
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(updated));
  await cancelReminderNotification(id);
}

async function scheduleReminderNotification(reminder: CommuteReminder): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await cancelReminderNotification(reminder.id);
    const [hoursStr, minutesStr] = reminder.departureTime.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    // Schedule 30 min before
    const reminderMinutes = minutes - 30;
    const reminderHours = reminderMinutes < 0 ? hours - 1 : hours;
    const adjustedMinutes = reminderMinutes < 0 ? reminderMinutes + 60 : reminderMinutes;

    await Notifications.scheduleNotificationAsync({
      identifier: `reminder_${reminder.id}`,
      content: {
        title: `🚇 Time to head to ${reminder.stationName}!`,
        body: `Your commute starts at ${reminder.departureTime}. Leave in 30 minutes to avoid delays.`,
        data: { reminderId: reminder.id, stationId: reminder.stationId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: reminderHours,
        minute: adjustedMinutes,
      },
    });
  } catch {
    // Silently fail if notifications not available
  }
}

async function cancelReminderNotification(id: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(`reminder_${id}`);
  } catch {
    // Silently fail
  }
}

export async function sendProximityAlert(stationName: string, nextStationName: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `proximity_${Date.now()}`,
      content: {
        title: `🚉 Almost there!`,
        body: `You're approaching ${stationName}. Next stop: ${nextStationName}.`,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
    });
  } catch {
    // Silently fail
  }
}

function getDefaultReminders(): CommuteReminder[] {
  return [
    {
      id: 'morning_commute',
      type: 'departure',
      label: 'Morning Commute',
      stationId: 'mrt3-north-avenue',
      stationName: 'North Avenue',
      departureTime: '07:30',
      enabled: false,
      daysOfWeek: [1, 2, 3, 4, 5],
    },
    {
      id: 'evening_commute',
      type: 'departure',
      label: 'Evening Commute',
      stationId: 'mrt3-ayala',
      stationName: 'Ayala',
      departureTime: '18:00',
      enabled: false,
      daysOfWeek: [1, 2, 3, 4, 5],
    },
  ];
}
