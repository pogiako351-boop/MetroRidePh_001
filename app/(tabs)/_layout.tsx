import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import { BlurView } from 'expo-blur';

/** CSS-only styles for web light-mode tab bar */
const WEB_LIGHT_STYLE = {
  backgroundColor: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(20px) saturate(160%)',
  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
} as unknown as object;

function TabBarBackground() {
  if (Platform.OS === 'web') {
    return (
      <View
        style={[StyleSheet.absoluteFill, WEB_LIGHT_STYLE as never]}
        pointerEvents="none"
      />
    );
  }
  return (
    <BlurView
      intensity={60}
      tint="light"
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
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: FontSize.xs,
          fontWeight: FontWeight.medium,
          marginTop: -2,
        },
        tabBarStyle: {
          position: 'absolute',
          // On web, use transparent bg so the CSS backdrop-filter shines through.
          // On native, keep the semi-transparent white fill.
          backgroundColor:
            Platform.OS === 'web' ? 'transparent' : 'rgba(255,255,255,0.92)',
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          // Native safe area insets (iOS/Android) — read from SafeAreaContext
          paddingBottom: insets.bottom,
          height: 56 + insets.bottom,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
            },
            android: {
              elevation: 8,
            },
            web: {
              boxShadow: '0 -1px 0 rgba(0,0,0,0.08), 0 -4px 16px rgba(0,0,0,0.06)',
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
    backgroundColor: 'rgba(0,112,204,0.10)',
    borderRadius: BorderRadius.md,
    padding: 4,
  },
  // webGlass is applied directly on the View via a cast to avoid TS errors
  // for CSS-only properties (backdropFilter, WebkitBackdropFilter) that are
  // forwarded to the DOM by React Native Web but not typed in ViewStyle.

});
