import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useMaintenanceStore } from '../store/useMaintenanceStore';
import { COLORS } from '../constants/theme';
import { ZoneId } from '../types/maintenance';
import { NotificationService } from '../services/notifications';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { initialize, isInitialized, receiveCall } = useMaintenanceStore();
  const router = useRouter();

  useEffect(() => {
    initialize().finally(() => SplashScreen.hideAsync());
  }, []);

  // Handle notification tap (background → app opens)
  useEffect(() => {
    const sub = NotificationService.addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as { zoneId?: ZoneId };
      if (data?.zoneId) {
        router.push('/(tabs)/dashboard');
      }
    });

    // Handle foreground notifications (already received call via receiveCall,
    // but handle if notification arrives from backend push while app is open)
    const fgSub = NotificationService.addForegroundNotificationListener(
      (_notification) => {
        // Push notification from backend arrived while app is in foreground.
        // The receiveCall flow already handles UI updates for local simulation.
        // For backend pushes, update state here if needed.
      }
    );

    return () => {
      sub.remove();
      fgSub.remove();
    };
  }, []);

  return (
    <>
      <StatusBar style="light" backgroundColor={COLORS.bg} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}
