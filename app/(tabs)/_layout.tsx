import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import { BlurView } from 'expo-blur';

/** CSS-only styles for web glassmorphism — cast to avoid RN type errors */
const WEB_GLASS_STYLE = {
  backgroundColor: 'rgba(8,9,10,0.80)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
} as unknown as object;

function TabBarBackground() {
  if (Platform.OS === 'web') {
    // On web, replicate the glassmorphism using CSS backdrop-filter.
    // Both -webkit- (Safari) and unprefixed (Chrome/Firefox) variants are set
    // so the effect renders consistently across mobile browsers.
    return (
      <View
        style={[StyleSheet.absoluteFill, WEB_GLASS_STYLE as never]}
        pointerEvents="none"
      />
    );
  }
  return (
    <BlurView
      intensity={40}
      tint="dark"
      style={StyleSheet.absoluteFill}
    />
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.electricCyan,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: FontSize.xs,
          fontWeight: FontWeight.medium,
          marginTop: -2,
        },
        tabBarStyle: {
          position: 'absolute',
          // On web, use transparent bg so the CSS backdrop-filter glass shines through.
          // On native, keep the semi-transparent Onyx fill.
          backgroundColor:
            Platform.OS === 'web' ? 'transparent' : 'rgba(8,9,10,0.85)',
          borderTopColor: Colors.glassBorder,
          borderTopWidth: 1,
          // Native safe area insets (iOS/Android) — read from SafeAreaContext
          paddingBottom: insets.bottom,
          height: 56 + insets.bottom,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.6,
              shadowRadius: 16,
            },
            android: {
              elevation: 16,
            },
            // Web: neomorphic shadow via CSS box-shadow equivalent
            web: {
              boxShadow: '0 -4px 24px rgba(0,0,0,0.6), 0 -1px 0 rgba(255,255,255,0.06)',
            } as object,
          }),
        },
        tabBarBackground: () => <TabBarBackground />,
        tabBarItemStyle: {
          paddingTop: 6,
        },
        tabBarActiveBackgroundColor: 'transparent',
        tabBarInactiveBackgroundColor: 'transparent',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={[focused && styles.activeIconBg]}>
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="stations"
        options={{
          title: 'Stations',
          tabBarIcon: ({ color, focused }) => (
            <View style={[focused && styles.activeIconBg]}>
              <Ionicons
                name={focused ? 'train' : 'train-outline'}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, focused }) => (
            <View style={[focused && styles.activeIconBg]}>
              <Ionicons
                name={focused ? 'notifications' : 'notifications-outline'}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favorites',
          tabBarIcon: ({ color, focused }) => (
            <View style={[focused && styles.activeIconBg]}>
              <Ionicons
                name={focused ? 'heart' : 'heart-outline'}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIconBg: {
    backgroundColor: 'rgba(64,224,255,0.12)',
    borderRadius: BorderRadius.md,
    padding: 4,
    shadowColor: Colors.electricCyan,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  // webGlass is applied directly on the View via a cast to avoid TS errors
  // for CSS-only properties (backdropFilter, WebkitBackdropFilter) that are
  // forwarded to the DOM by React Native Web but not typed in ViewStyle.

});
