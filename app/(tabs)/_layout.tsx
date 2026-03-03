import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import { BlurView } from 'expo-blur';

function TabBarBackground() {
  if (Platform.OS === 'web') {
    return <View style={StyleSheet.absoluteFill} pointerEvents="none" />;
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
          backgroundColor: 'rgba(8,9,10,0.85)',
          borderTopColor: Colors.glassBorder,
          borderTopWidth: 1,
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
});
