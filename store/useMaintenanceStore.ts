import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  Zone,
  ZoneId,
  ButtonId,
  CallEvent,
  AppSettings,
  SystemStatus,
  ConnectionStatus,
} from '../types/maintenance';
import { INITIAL_ZONES, ZONE_CONFIGS, PANNE_TYPES } from '../constants/zones';
import { DatabaseService } from '../services/database';
import { NotificationService } from '../services/notifications';
import { Esp32Service } from '../services/esp32';
import { ApiService } from '../services/api';
import { SimulatorService } from '../services/simulator';

// Simple UUID without external library
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULT_SETTINGS: AppSettings = {
  wifiSsid: '',
  esp32IpAddress: '192.168.1.100',
  backendApiUrl: '',
  mqttBrokerUrl: '',
  notificationsEnabled: true,
  touchSafeMode: false,
  alertSound: 'default',
  pushToken: null,
  connectionMode: 'auto',
  simulationMode: true,
};

const SETTINGS_KEY = 'app_settings';
const SECURE_WIFI_KEY = 'wifi_password';

interface MaintenanceState {
  // Zone states
  zones: Zone[];

  // Call history
  history: CallEvent[];

  // System status
  systemStatus: SystemStatus;

  // App settings
  settings: AppSettings;

  // UI state
  isInitialized: boolean;
  isLoading: boolean;

  // Actions
  initialize: () => Promise<void>;
  receiveCall: (zoneId: ZoneId, buttonId: ButtonId, source?: CallEvent['source']) => Promise<void>;
  acknowledgeZone: (zoneId: ZoneId) => Promise<void>;
  acknowledgeAll: () => Promise<void>;
  loadHistory: () => Promise<void>;
  clearHistory: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  saveWifiPassword: (password: string) => Promise<void>;
  loadWifiPassword: () => Promise<string>;
  setConnectionStatus: (status: ConnectionStatus) => void;
  simulateCall: (zoneId: ZoneId, buttonId: ButtonId) => Promise<void>;
}

export const useMaintenanceStore = create<MaintenanceState>((set, get) => ({
  zones: INITIAL_ZONES,
  history: [],
  systemStatus: {
    connection: 'offline',
    lastSync: null,
    activeCallCount: 0,
    pushNotificationsActive: false,
  },
  settings: DEFAULT_SETTINGS,
  isInitialized: false,
  isLoading: false,

  initialize: async () => {
    set({ isLoading: true });

    try {
      // Load persisted settings
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      const settings: AppSettings = stored
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
        : DEFAULT_SETTINGS;
      set({ settings });

      // Configure services with loaded settings
      if (settings.esp32IpAddress) {
        Esp32Service.setEsp32BaseUrl(`http://${settings.esp32IpAddress}`);
      }
      if (settings.backendApiUrl) {
        ApiService.setBackendBaseUrl(settings.backendApiUrl);
      }

      // Load call history from SQLite
      const history = await DatabaseService.getAllCalls();
      set({ history });

      // Rebuild zone status from pending calls in DB
      const pending = await DatabaseService.getPendingCalls();
      const zones = [...INITIAL_ZONES];
      for (const call of pending) {
        const zone = zones.find((z) => z.id === call.zone);
        if (zone) {
          zone.status = 'CALL';
          zone.lastCallAt = call.startedAt;
          zone.activeButton = call.button;
          zone.activePanneLabel = call.panneLabel;
        }
      }
      set({ zones });

      // Register simulator handler
      SimulatorService.registerSimulatorHandler(async (zoneId: ZoneId, buttonId: ButtonId) => {
        await get().receiveCall(zoneId, buttonId, 'simulation');
      });

      // Setup push notifications
      if (settings.notificationsEnabled) {
        const token = await NotificationService.registerForPushNotifications();
        if (token) {
          await get().updateSettings({ pushToken: token });
          set((state) => ({
            systemStatus: { ...state.systemStatus, pushNotificationsActive: true },
          }));
          // TODO: Register token with backend → ApiService.registerPushToken(token, Platform.OS)
        }
      }

      // Compute active call count
      const activeCallCount = get().zones.filter((z) => z.status === 'CALL').length;
      set((state) => ({
        systemStatus: { ...state.systemStatus, activeCallCount },
        isInitialized: true,
        isLoading: false,
      }));
    } catch (error) {
      console.error('[Store] Initialization failed:', error);
      set({ isLoading: false, isInitialized: true });
    }
  },

  receiveCall: async (zoneId: ZoneId, buttonId: ButtonId, source: CallEvent['source'] = 'esp32') => {
    const now = new Date().toISOString();
    const config = ZONE_CONFIGS[zoneId];
    const panneLabel = PANNE_TYPES[buttonId].label;

    const callEvent: CallEvent = {
      id: generateId(),
      zone: zoneId,
      zoneName: config.name,
      button: buttonId,
      panneLabel,
      startedAt: now,
      acknowledgedAt: null,
      durationSeconds: null,
      status: 'pending',
      source,
      createdAt: now,
      pendingSync: false,
    };

    // Persist to SQLite
    await DatabaseService.insertCall(callEvent);

    // Update zone status in memory
    set((state) => {
      const zones = state.zones.map((z) =>
        z.id === zoneId
          ? {
              ...z,
              status: 'CALL' as const,
              lastCallAt: now,
              activeButton: buttonId,
              activePanneLabel: panneLabel,
            }
          : z
      );
      const history = [callEvent, ...state.history];
      const activeCallCount = zones.filter((z) => z.status === 'CALL').length;

      return {
        zones,
        history,
        systemStatus: { ...state.systemStatus, activeCallCount },
      };
    });

    // Fire local notification if enabled
    const { settings } = get();
    if (settings.notificationsEnabled) {
      await NotificationService.sendLocalCallNotification(zoneId, `${config.name} - ${panneLabel}`);
    }
  },

  acknowledgeZone: async (zoneId: ZoneId) => {
    const now = new Date().toISOString();
    // Capture active button before state is reset to null
    const activeButton = get().zones.find((z) => z.id === zoneId)?.activeButton ?? 'B1';

    // Update local SQLite
    await DatabaseService.acknowledgeZoneCalls(zoneId, now);

    // Update in-memory state
    set((state) => {
      const zones = state.zones.map((z) =>
        z.id === zoneId
          ? {
              ...z,
              status: 'OK' as const,
              acknowledgedAt: now,
              activeButton: null,
              activePanneLabel: null,
            }
          : z
      );
      const history = state.history.map((h) =>
        h.zone === zoneId && h.status === 'pending'
          ? {
              ...h,
              status: 'acknowledged' as const,
              acknowledgedAt: now,
              durationSeconds: Math.floor(
                (new Date(now).getTime() - new Date(h.startedAt).getTime()) / 1000
              ),
            }
          : h
      );
      const activeCallCount = zones.filter((z) => z.status === 'CALL').length;

      return {
        zones,
        history,
        systemStatus: { ...state.systemStatus, activeCallCount },
      };
    });

    // Send ACK to hardware/backend (non-blocking, handle failure gracefully)
    const { settings } = get();
    const ackPromises: Promise<boolean>[] = [];

    if (settings.connectionMode !== 'cloud') {
      ackPromises.push(Esp32Service.sendAckToEsp32(zoneId, activeButton));
    }
    if (settings.backendApiUrl && settings.connectionMode !== 'local') {
      ackPromises.push(ApiService.acknowledgeZoneOnBackend(zoneId));
    }

    const results = await Promise.allSettled(ackPromises);
    const allFailed = results.every(
      (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value)
    );

    if (allFailed && ackPromises.length > 0) {
      // Mark as pending sync for retry
      console.warn(`[Store] ACK for ${zoneId} failed to reach hardware/backend — pending sync`);
    }
  },

  acknowledgeAll: async () => {
    const now = new Date().toISOString();
    const { zones } = get();
    const activeZones = zones.filter((z) => z.status === 'CALL').map((z) => z.id);

    await DatabaseService.acknowledgeAllCalls(now);

    set((state) => {
      const zones = state.zones.map((z) => ({
        ...z,
        status: 'OK' as const,
        acknowledgedAt: now,
        activeButton: null,
        activePanneLabel: null,
      }));
      const history = state.history.map((h) =>
        h.status === 'pending'
          ? {
              ...h,
              status: 'acknowledged' as const,
              acknowledgedAt: now,
              durationSeconds: Math.floor(
                (new Date(now).getTime() - new Date(h.startedAt).getTime()) / 1000
              ),
            }
          : h
      );
      return {
        zones,
        history,
        systemStatus: { ...state.systemStatus, activeCallCount: 0 },
      };
    });

    const { settings } = get();
    if (settings.connectionMode !== 'cloud') {
      await Esp32Service.sendAckAllToEsp32().catch(console.error);
    }
    if (settings.backendApiUrl && settings.connectionMode !== 'local') {
      await ApiService.acknowledgeAllOnBackend().catch(console.error);
    }
  },

  loadHistory: async () => {
    const history = await DatabaseService.getAllCalls();
    set({ history });
  },

  clearHistory: async () => {
    await DatabaseService.clearAllHistory();
    set({ history: [] });
  },

  updateSettings: async (partial: Partial<AppSettings>) => {
    const current = get().settings;
    const updated = { ...current, ...partial };
    set({ settings: updated });
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));

    // Propagate to services
    if (partial.esp32IpAddress) {
      Esp32Service.setEsp32BaseUrl(`http://${partial.esp32IpAddress}`);
    }
    if (partial.backendApiUrl !== undefined) {
      ApiService.setBackendBaseUrl(partial.backendApiUrl);
    }
  },

  saveWifiPassword: async (password: string) => {
    await SecureStore.setItemAsync(SECURE_WIFI_KEY, password);
  },

  loadWifiPassword: async () => {
    return (await SecureStore.getItemAsync(SECURE_WIFI_KEY)) ?? '';
  },

  setConnectionStatus: (status: ConnectionStatus) => {
    set((state) => ({
      systemStatus: { ...state.systemStatus, connection: status },
    }));
  },

  simulateCall: async (zoneId: ZoneId, buttonId: ButtonId) => {
    await get().receiveCall(zoneId, buttonId, 'simulation');
  },
}));
