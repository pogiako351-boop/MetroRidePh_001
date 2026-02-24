import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isSupported = Platform.OS === 'ios' || Platform.OS === 'android';

/** Light tap — navigation, selections */
export async function hapticLight(): Promise<void> {
  if (!isSupported) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Haptics not available on this device
  }
}

/** Medium tap — successful actions, reports */
export async function hapticMedium(): Promise<void> {
  if (!isSupported) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
}

/** Heavy tap — confirmations, errors */
export async function hapticHeavy(): Promise<void> {
  if (!isSupported) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {}
}

/** Double tap — adding to favorites */
export async function hapticDoubleTap(): Promise<void> {
  if (!isSupported) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 120);
  } catch {}
}

/** Success notification — completed reports, saved stations */
export async function hapticSuccess(): Promise<void> {
  if (!isSupported) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}

/** Warning notification — alerts, low balance */
export async function hapticWarning(): Promise<void> {
  if (!isSupported) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {}
}

/** Error notification — failed actions */
export async function hapticError(): Promise<void> {
  if (!isSupported) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {}
}

/** Selection changed — list scrolling, picker changes */
export async function hapticSelection(): Promise<void> {
  if (!isSupported) return;
  try {
    await Haptics.selectionAsync();
  } catch {}
}
