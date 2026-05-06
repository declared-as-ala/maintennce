import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { ZoneId } from '../types/maintenance';

const ALERT_CHANNEL_ID = 'maintenance-alerts';

// expo-notifications remote push is not supported in Expo Go since SDK 53.
// Local notifications (scheduleNotificationAsync) still work fine in Expo Go.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

function setupForegroundHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: 'max' as Notifications.AndroidNotificationPriority,
    }),
  });
}

async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ALERT_CHANNEL_ID, {
    name: 'Alertes Maintenance',
    description: 'Notifications prioritaires pour les appels de maintenance',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250, 250, 250],
    lightColor: '#EF4444',
    sound: 'default',
    enableVibrate: true,
    enableLights: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  setupForegroundHandler();
  await setupAndroidChannel();

  if (!Device.isDevice) {
    console.log('[Notifications] Emulator — skipping permission request');
    return true;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowCriticalAlerts: true,
    },
  });

  return status === 'granted';
}

export async function registerForPushNotifications(): Promise<string | null> {
  // Remote push tokens are unavailable in Expo Go since SDK 53.
  // Use a development build (eas build --profile development) for real push tokens.
  if (IS_EXPO_GO) {
    console.log('[Notifications] Expo Go detected — skipping push token registration. Use a dev build for FCM push.');
    return null;
  }

  if (!Device.isDevice) return null;

  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId || projectId === 'YOUR_EAS_PROJECT_ID') {
      console.log('[Notifications] No EAS projectId configured — skipping push token.');
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (error) {
    console.error('[Notifications] Failed to get push token:', error);
    return null;
  }
}

export async function sendLocalCallNotification(zoneId: ZoneId, zoneName: string): Promise<void> {
  // Local notifications work in both Expo Go and development builds.
  if (!Device.isDevice) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🚨 APPEL MAINTENANCE — ${zoneName}`,
        body: `${zoneName} nécessite une intervention urgente`,
        sound: 'default',
        vibrate: [0, 250, 250, 250],
        color: '#EF4444',
        badge: 1,
        data: { zoneId, type: 'maintenance_call' },
        android: {
          channelId: ALERT_CHANNEL_ID,
          priority: 'max',
          sticky: false,
        },
      } as Notifications.NotificationContentInput,
      trigger: null,
    });
  } catch (error) {
    console.warn('[Notifications] sendLocalCallNotification failed:', error);
  }
}

export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}

export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

export function addForegroundNotificationListener(
  handler: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(handler);
}

export const NotificationService = {
  requestNotificationPermissions,
  registerForPushNotifications,
  sendLocalCallNotification,
  clearBadge,
  addNotificationResponseListener,
  addForegroundNotificationListener,
  setupForegroundHandler,
};
