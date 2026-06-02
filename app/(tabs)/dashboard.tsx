import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMaintenanceStore } from '../../store/useMaintenanceStore';
import { ZoneCard } from '../../components/ZoneCard';
import { ConnectionStatusBadge } from '../../components/ConnectionStatus';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ZoneId, ButtonId } from '../../types/maintenance';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import { Esp32Service } from '../../services/esp32';

export default function DashboardScreen() {
  const {
    zones,
    systemStatus,
    settings,
    acknowledgeZone,
    acknowledgeAll,
    setConnectionStatus,
    receiveCall,
  } = useMaintenanceStore();

  const [refreshing, setRefreshing] = useState(false);
  const [confirmAckAll, setConfirmAckAll] = useState(false);
  const [ackingZone, setAckingZone] = useState<ZoneId | null>(null);

  const activeZones = zones.filter((z) => z.status === 'CALL');
  const hasActiveCalls = activeZones.length > 0;

  const syncCallsFromEsp32 = async () => {
    const status = await Esp32Service.getEsp32Status();
    if (!status) {
      setConnectionStatus('offline');
      return;
    }

    setConnectionStatus('local');

    const payload = status as {
      zones?: Record<string, Record<string, string> | string>;
      activeButtons?: Record<string, string>;
    };

    for (const zone of zones) {
      const zoneData = payload.zones?.[zone.id];
      let zoneIsCall = false;
      let buttonId: ButtonId = 'B1';

      if (typeof zoneData === 'string') {
        // Old firmware format: "CALL" | "OK"
        zoneIsCall = zoneData === 'CALL';
        const rawBtn = payload.activeButtons?.[zone.id];
        buttonId = (rawBtn?.match(/^B[1-4]$/)?.[0] as ButtonId) ?? 'B1';
      } else if (typeof zoneData === 'object' && zoneData !== null) {
        // New firmware format: {"B1":"PANNE","B2":"OK",...}
        const activeEntry = Object.entries(zoneData).find(([, v]) => v === 'PANNE');
        if (activeEntry) {
          zoneIsCall = true;
          buttonId = (activeEntry[0].match(/^B[1-4]$/)?.[0] as ButtonId) ?? 'B1';
        }
      }

      // Trigger receive flow only on edge (OK -> CALL) to avoid duplicate notifications.
      if (zoneIsCall && zone.status !== 'CALL') {
        await receiveCall(zone.id, buttonId, 'esp32');
      }
    }
  };

  // Ping ESP32/backend to update connection status
  useEffect(() => {
    const checkConnection = async () => {
      setConnectionStatus('connecting');
      if (settings.esp32IpAddress) {
        await syncCallsFromEsp32();
      } else {
        setConnectionStatus('offline');
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 3_000);
    return () => clearInterval(interval);
  }, [settings.esp32IpAddress, zones]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await syncCallsFromEsp32();
    setRefreshing(false);
  };

  const handleAcknowledgeZone = async (zoneId: ZoneId) => {
    setAckingZone(zoneId);
    await acknowledgeZone(zoneId);
    setAckingZone(null);
  };

  const handleAcknowledgeAll = async () => {
    setConfirmAckAll(false);
    await acknowledgeAll();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>Maintenance Call</Text>
          <Text style={styles.subtitle}>Système d'appel industriel</Text>
        </View>
        <ConnectionStatusBadge status={systemStatus.connection} />
      </View>

      {/* Global alert banner */}
      {hasActiveCalls && (
        <View style={styles.alertBanner}>
          <Ionicons name="alert-circle" size={20} color={COLORS.danger} />
          <Text style={styles.alertText}>
            {activeZones.length} appel{activeZones.length > 1 ? 's' : ''} en cours
          </Text>
          <TouchableOpacity
            style={styles.ackAllBtn}
            onPress={() => setConfirmAckAll(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.ackAllBtnText}>Acquitter tout</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Status row */}
      <View style={styles.statusRow}>
        <View style={styles.statusItem}>
          <Text style={styles.statusValue}>{activeZones.length}</Text>
          <Text style={styles.statusLabel}>Appels actifs</Text>
        </View>
        <View style={styles.statusDivider} />
        <View style={styles.statusItem}>
          <Text style={styles.statusValue}>{zones.filter((z) => z.status === 'OK').length}</Text>
          <Text style={styles.statusLabel}>Machines OK</Text>
        </View>
        <View style={styles.statusDivider} />
        <View style={styles.statusItem}>
          <View style={styles.notifIndicator}>
            <Ionicons
              name={systemStatus.pushNotificationsActive ? 'notifications' : 'notifications-off'}
              size={16}
              color={systemStatus.pushNotificationsActive ? COLORS.success : COLORS.textMuted}
            />
          </View>
          <Text style={styles.statusLabel}>Notifications</Text>
        </View>
      </View>

      {/* Machine cards */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          settings.touchSafeMode && styles.scrollContentTouchSafe,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
      >
        <Text style={styles.sectionTitle}>Machines de production</Text>
        {zones.map((zone) => (
          <ZoneCard
            key={zone.id}
            zone={zone}
            onAcknowledge={() => handleAcknowledgeZone(zone.id)}
          />
        ))}

        <View style={styles.footer}>
          <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.footerText}>
            {settings.simulationMode ? 'Mode simulation actif' : 'Connecté au système ESP32'}
          </Text>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmAckAll}
        title="Acquitter tout"
        message="Confirmer l'acquittement de tous les appels en cours ?"
        confirmLabel="Acquitter tout"
        onConfirm={handleAcknowledgeAll}
        onCancel={() => setConfirmAckAll(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  appName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.dangerMuted,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.danger,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  alertText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.danger,
    letterSpacing: 0.3,
  },
  ackAllBtn: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  ackAllBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  statusItem: {
    flex: 1,
    alignItems: 'center',
  },
  statusValue: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  statusLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  statusDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  notifIndicator: {
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl + 40,
  },
  scrollContentTouchSafe: {
    paddingBottom: SPACING.xxl + 70,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: SPACING.md,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
