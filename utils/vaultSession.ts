/**
 * MetroRide PH — Neon Onyx Vault Session Manager
 * Manages the temporary admin session with a 5-minute background timeout.
 * Session is invalidated when the app is backgrounded for more than 5 minutes
 * or when the app is terminated.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';

const VAULT_SESSION_KEY = '@metroride_vault_session';
const BG_TIMEOUT_MS = 5 * 60_000; // 5 minutes

interface VaultSession {
  ts: number; // when session was granted
}

// ── Module-level state (in-memory, resets on app close) ───────────────────
let backgroundedAt: number | null = null;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

// ── AppState tracking ──────────────────────────────────────────────────────
/**
 * Call once in the root layout to track background/foreground transitions.
 * Returns a cleanup function.
 */
export function initVaultAppStateTracking(): () => void {
  // Remove any existing subscription to avoid duplicates
  appStateSubscription?.remove();

  appStateSubscription = AppState.addEventListener(
    'change',
    (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        // App going to background — record the time
        if (backgroundedAt === null) {
          backgroundedAt = Date.now();
        }
      } else if (nextState === 'active') {
        // App returning to foreground — check elapsed time
        if (backgroundedAt !== null) {
          const elapsed = Date.now() - backgroundedAt;
          if (elapsed > BG_TIMEOUT_MS) {
            // Session expired while in background
            AsyncStorage.removeItem(VAULT_SESSION_KEY).catch(() => {});
            console.log('[Vault] Session expired — backgrounded for', Math.round(elapsed / 1000), 's');
          }
          backgroundedAt = null;
        }
      }
    },
  );

  return () => {
    appStateSubscription?.remove();
    appStateSubscription = null;
  };
}

// ── Session management ─────────────────────────────────────────────────────

/** Grant a new vault session. Call after successful PIN entry. */
export async function grantVaultSession(): Promise<void> {
  const session: VaultSession = { ts: Date.now() };
  await AsyncStorage.setItem(VAULT_SESSION_KEY, JSON.stringify(session));
  backgroundedAt = null; // Reset background timer
}

/**
 * Check whether a valid vault session exists.
 * Returns false if:
 * - No session stored
 * - App has been backgrounded for > 5 minutes since session was granted
 */
export async function hasValidVaultSession(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(VAULT_SESSION_KEY);
    if (!raw) return false;

    // If currently backgrounded for too long, deny
    if (backgroundedAt !== null) {
      const elapsed = Date.now() - backgroundedAt;
      if (elapsed > BG_TIMEOUT_MS) {
        await AsyncStorage.removeItem(VAULT_SESSION_KEY);
        return false;
      }
    }

    // Session exists and background timer hasn't expired
    return true;
  } catch {
    return false;
  }
}

/** Revoke the current vault session immediately. */
export async function invalidateVaultSession(): Promise<void> {
  await AsyncStorage.removeItem(VAULT_SESSION_KEY).catch(() => {});
  backgroundedAt = null;
}
