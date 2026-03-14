/**
 * PWA Install Singleton
 *
 * Captures the `beforeinstallprompt` event once at module load time so that
 * multiple components can read installability state and trigger the native
 * install dialog without competing for the same event.
 *
 * Pattern: module-level state + subscriber set → every usePWAInstall()
 * consumer re-renders when installability changes.
 */

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Storage key ────────────────────────────────────────────────────────────────
export const PWA_INSTALL_DISMISSED_KEY = '@metroride_pwa_install_dismissed';

// ── BeforeInstallPromptEvent typing (not in standard TS lib) ──────────────────
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}

// ── Module-level singleton state ───────────────────────────────────────────────
let _deferredPrompt: BeforeInstallPromptEvent | null = null;
let _isInstallable = false;
let _isStandalone = false;
const _subscribers = new Set<() => void>();

function _notifyAll() {
  _subscribers.forEach((fn) => fn());
}

// Only register browser-specific listeners in actual browser environments.
// `document` is defined in real browsers but not in React Native's JS runtime.
if (typeof document !== 'undefined') {
  // Detect if already running as an installed PWA
  if (
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
  ) {
    _isStandalone = true;
  }

  // Capture the deferred install prompt
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    // Prevent Chrome's default mini-infobar
    e.preventDefault();
    _deferredPrompt = e as BeforeInstallPromptEvent;
    _isInstallable = true;
    _notifyAll();
  });

  // Clear state once the app is successfully installed
  window.addEventListener('appinstalled', () => {
    _deferredPrompt = null;
    _isInstallable = false;
    _notifyAll();
    // Persist installed flag so we never show the prompt again
    AsyncStorage.setItem(PWA_INSTALL_DISMISSED_KEY, 'installed').catch(() => {});
  });
}

// ── Hook ────────────────────────────────────────────────────────────────────────

export interface UsePWAInstallResult {
  /** True when the browser has fired `beforeinstallprompt` and the app can be installed */
  isInstallable: boolean;
  /** True when the app is already running as a standalone PWA */
  isStandalone: boolean;
  /** Trigger the native browser install dialog. Returns the user's choice. */
  triggerInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export function usePWAInstall(): UsePWAInstallResult {
  const [isInstallable, setIsInstallable] = useState(_isInstallable);

  useEffect(() => {
    // Sync with whatever module state is at mount time
    const syncState = () => setIsInstallable(_isInstallable);
    _subscribers.add(syncState);
    syncState(); // immediate sync in case event already fired before mount
    return () => {
      _subscribers.delete(syncState);
    };
  }, []);

  const triggerInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!_deferredPrompt) return 'unavailable';
    try {
      await _deferredPrompt.prompt();
      const { outcome } = await _deferredPrompt.userChoice;
      // Consume the prompt — it can only be used once
      _deferredPrompt = null;
      _isInstallable = false;
      _notifyAll();
      return outcome;
    } catch {
      return 'unavailable';
    }
  };

  return { isInstallable, isStandalone: _isStandalone, triggerInstall };
}
