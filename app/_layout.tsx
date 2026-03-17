import { useEffect, useState } from 'react';
import { Stack, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/theme';
import { syncOfflineData } from '@/utils/storage';
import { startGuardian, stopGuardian } from '@/utils/guardian';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import FirstLaunchModal, { checkFirstLaunchAccepted } from '@/components/ui/FirstLaunchModal';
import { PWAInstallPrompt } from '@/components/ui/PWAInstallPrompt';
import { PWAInstallBanner } from '@/components/ui/PWAInstallBanner';

const ONBOARDING_DONE_KEY = '@metroride_onboarded';

export default function RootLayout() {
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    syncOfflineData();

    // Start Guardian monitoring in the background
    startGuardian();

    Promise.all([
      AsyncStorage.getItem(ONBOARDING_DONE_KEY),
      checkFirstLaunchAccepted(),
    ]).then(([onboarded, accepted]) => {
      setHasOnboarded(!!onboarded);
      setTermsAccepted(accepted);
    });

    // Cleanup Guardian on unmount (hot reload / dev only)
    return () => {
      stopGuardian();
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
