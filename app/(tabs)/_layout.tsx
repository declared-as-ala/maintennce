import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaintenanceStore } from '../../store/useMaintenanceStore';
import { COLORS, RADIUS } from '../../constants/theme';

export default function TabLayout() {
  const { systemStatus, settings } = useMaintenanceStore();
  const activeCount = systemStatus.activeCallCount;
  const insets = useSafeAreaInsets();
  const touchSafeBoost = settings.touchSafeMode ? 12 : 0;
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 10) + touchSafeBoost;
  const baseHeight = Platform.OS === 'android' ? 64 : 70;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: baseHeight + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 8,
          elevation: 24,
          shadowColor: '#000',
          shadowOpacity: 0.5,
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Tableau de bord',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="grid" size={size} color={color} />
              {activeCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -6,
                    backgroundColor: COLORS.danger,
                    borderRadius: RADIUS.full,
                    minWidth: 16,
                    height: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 3,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
                    {activeCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historique',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Paramètres',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
