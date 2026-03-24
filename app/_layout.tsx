import { useEffect, useState } from 'react';
import { Stack, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/theme';
import { syncOfflineData, handleQueuedCrowdLevel } from '@/utils/storage';
import { startGuardian, stopGuardian } from '@/utils/guardian';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import FirstLaunchModal, { checkFirstLaunchAccepted } from '@/components/ui/FirstLaunchModal';
import { PWAInstallPrompt } from '@/components/ui/PWAInstallPrompt';
import { PWAInstallBanner } from '@/components/ui/PWAInstallBanner';
import {
  startSyncQueueListener,
  stopSyncQueueListener,
  registerOperationHandler,
} from '@/utils/offlineSyncQueue';
import { handleQueuedReport, handleQueuedUpvote } from '@/utils/communityReports';
import { initVaultAppStateTracking } from '@/utils/vaultSession';
import { logSecurityHandshake } from '@/utils/vaultAuditLog';

const ONBOARDING_DONE_KEY = '@metroride_onboarded';

export default function RootLayout() {
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    syncOfflineData();

    // ── Service Worker registration (web only) ────────────────────────────
    // Register /sw.js so the Pulse diagnostic can detect an active worker and
    // the PWA can serve cached station/fare data offline.  Runs once on mount.
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.log('[MetroRide] Service Worker registered:', reg.scope);
          // Send SKIP_WAITING so any pending worker activates immediately
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        })
        .catch((err) => {
          console.warn('[MetroRide] Service Worker registration failed:', err);
        });
    }

    // Start Guardian monitoring in the background
    startGuardian();

    // Log the security handshake status to vault_audit_log (non-blocking)
    logSecurityHandshake();

    // Initialize vault session AppState tracking (5-min background timeout)
    const cleanupVault = initVaultAppStateTracking();

    // ── Background sync queue setup ──────────────────────────────────────
    // Register per-type handlers so the queue knows how to replay each
    // operation that was queued while the app was offline.
    registerOperationHandler('submit_report',     handleQueuedReport);
    registerOperationHandler('upvote_report',     handleQueuedUpvote);
    registerOperationHandler('update_crowd_level', handleQueuedCrowdLevel);

    // Start listening for online/offline events and flush on reconnect.
    // On web this also registers a Background Sync tag so the browser
    // can trigger a flush even when the tab is backgrounded.
    startSyncQueueListener();

    Promise.all([
      AsyncStorage.getItem(ONBOARDING_DONE_KEY),
      checkFirstLaunchAccepted(),
    ]).then(([onboarded, accepted]) => {
      setHasOnboarded(!!onboarded);
      setTermsAccepted(accepted);
    });

    // Cleanup on unmount (hot reload / dev only)
    return () => {
      stopGuardian();
      stopSyncQueueListener();
      cleanupVault();
    };
  }, []);

  // Wait for storage checks
  if (hasOnboarded === null || termsAccepted === null) {
    return <View style={{ flex: 1, backgroundColor: Colors.surface }} />;
  }

  const handleTermsAccepted = () => {
    setTermsAccepted(true);
  };

  return (
    <ErrorBoundary>
      <>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="onboarding"
            options={{ headerShown: false, animation: 'fade', gestureEnabled: false }}
          />
          <Stack.Screen
            name="station/[id]"
            options={{ headerShown: false, animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="fare-calculator"
            options={{ headerShown: false, animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="route-planner"
            options={{ headerShown: false, animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="premium"
            options={{
              headerShown: false,
              animation: 'slide_from_bottom',
              presentation: 'modal',
            }}
          />
          <Stack.Screen
            name="metro-ai"
            options={{ headerShown: false, animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="transit-map"
            options={{ headerShown: false, animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="reminders"
            options={{ headerShown: false, animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="insights"
            options={{ headerShown: false, animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="settings"
            options={{ headerShown: false, animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="beep-card"
            options={{ headerShown: false, animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="about"
            options={{ headerShown: false, animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="privacy-policy"
            options={{ headerShown: false, animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="diagnostics"
            options={{ headerShown: false, animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="admin"
            options={{ headerShown: false, animation: 'slide_from_right' }}
          />
        </Stack>

        {!hasOnboarded && <Redirect href="/onboarding" />}

        {/* First-launch terms & privacy acceptance modal */}
        {hasOnboarded && !termsAccepted && (
          <FirstLaunchModal visible onAccept={handleTermsAccepted} />
        )}

        {/* PWA top banner — web only, slides in from top when installable */}
        {hasOnboarded && termsAccepted && <PWAInstallBanner />}

        {/* PWA install prompt — web only, shown as bottom sheet after a brief delay */}
        {hasOnboarded && termsAccepted && <PWAInstallPrompt />}

        {/* Light status bar icons for the Neon Onyx dark theme */}
        <StatusBar style={Platform.OS === 'web' ? 'auto' : 'light'} />
      </>
    </ErrorBoundary>
  );
}
