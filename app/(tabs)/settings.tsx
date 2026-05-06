import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMaintenanceStore } from '../../store/useMaintenanceStore';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { SimulatorService } from '../../services/simulator';
import { NotificationService } from '../../services/notifications';
import { Esp32Service } from '../../services/esp32';
import { ZONE_IDS, ZONE_CONFIGS, BUTTON_IDS, PANNE_TYPES } from '../../constants/zones';
import { ZoneId, ButtonId } from '../../types/maintenance';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function SettingsRow({
  label,
  sublabel,
  children,
  last,
}: {
  label: string;
  sublabel?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.rowLabel}>
        <Text style={styles.rowLabelText}>{label}</Text>
        {sublabel && <Text style={styles.rowSublabel}>{sublabel}</Text>}
      </View>
      <View style={styles.rowControl}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const {
    settings,
    updateSettings,
    saveWifiPassword,
    loadWifiPassword,
    clearHistory,
    simulateCall,
    setConnectionStatus,
  } =
    useMaintenanceStore();

  const [wifiPassword, setWifiPassword] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [testingNotif, setTestingNotif] = useState(false);
  const [simulatingKey, setSimulatingKey] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    loadWifiPassword().then(setWifiPassword);
  }, []);

  const handleSavePassword = async () => {
    await saveWifiPassword(wifiPassword);
    Alert.alert('Enregistré', 'Mot de passe WiFi sauvegardé de manière sécurisée.');
  };

  const handleTestNotification = async () => {
    setTestingNotif(true);
    await NotificationService.sendLocalCallNotification('Z1', 'Zone 1');
    setTimeout(() => setTestingNotif(false), 2000);
  };

  const handleSimulateCall = async (zoneId: ZoneId, buttonId: ButtonId) => {
    const key = `${zoneId}-${buttonId}`;
    setSimulatingKey(key);
    await simulateCall(zoneId, buttonId);
    setTimeout(() => setSimulatingKey(null), 1500);
  };

  const handleClearAll = async () => {
    setShowClearConfirm(false);
    await clearHistory();
    Alert.alert('Réinitialisé', 'Toutes les données locales ont été supprimées.');
  };

  const handleReconnectEsp32 = async () => {
    if (!settings.esp32IpAddress.trim()) {
      Alert.alert('IP manquante', 'Veuillez renseigner l’adresse IP ESP32 avant de reconnecter.');
      return;
    }

    setReconnecting(true);
    setConnectionStatus('connecting');
    const alive = await Esp32Service.pingEsp32();
    setConnectionStatus(alive ? 'local' : 'offline');
    setReconnecting(false);

    Alert.alert(
      alive ? 'Connexion OK' : 'Connexion échouée',
      alive
        ? `ESP32 joignable sur ${settings.esp32IpAddress}`
        : `Impossible de joindre ESP32 sur ${settings.esp32IpAddress}. Vérifiez WiFi/IP.`
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Paramètres</Text>
        <Text style={styles.subtitle}>Configuration du système</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          settings.touchSafeMode && styles.scrollContentTouchSafe,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Network settings */}
        <SettingsSection title="Réseau local">
          <SettingsRow label="SSID WiFi usine" sublabel="Réseau de l'ESP32 récepteur">
            <TextInput
              style={styles.input}
              placeholder="usine-wifi"
              placeholderTextColor={COLORS.textMuted}
              value={settings.wifiSsid}
              onChangeText={(v) => updateSettings({ wifiSsid: v })}
              autoCapitalize="none"
            />
          </SettingsRow>
          <SettingsRow label="Mot de passe WiFi" sublabel="Stocké de manière sécurisée">
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textMuted}
                value={wifiPassword}
                onChangeText={setWifiPassword}
                secureTextEntry
              />
              <TouchableOpacity style={styles.saveBtn} onPress={handleSavePassword}>
                <Ionicons name="save-outline" size={16} color={COLORS.accent} />
              </TouchableOpacity>
            </View>
          </SettingsRow>
          <SettingsRow label="Adresse IP ESP32" sublabel="Ex: 192.168.1.100" last>
            <TextInput
              style={styles.input}
              placeholder="192.168.1.100"
              placeholderTextColor={COLORS.textMuted}
              value={settings.esp32IpAddress}
              onChangeText={(v) => updateSettings({ esp32IpAddress: v })}
              keyboardType="numeric"
            />
          </SettingsRow>
          <View style={styles.reconnectWrap}>
            <TouchableOpacity
              style={[styles.actionBtn, reconnecting && styles.actionBtnDisabled]}
              onPress={handleReconnectEsp32}
              disabled={reconnecting}
            >
              <Ionicons
                name="refresh"
                size={14}
                color={reconnecting ? COLORS.textMuted : COLORS.accent}
              />
              <Text style={[styles.actionBtnText, reconnecting && { color: COLORS.textMuted }]}>
                {reconnecting ? 'Reconnexion...' : 'Reconnecter ESP32'}
              </Text>
            </TouchableOpacity>
          </View>
        </SettingsSection>

        {/* Backend / Cloud */}
        <SettingsSection title="Backend / Cloud">
          <SettingsRow label="URL API backend" sublabel="https://your-api.com">
            <TextInput
              style={styles.input}
              placeholder="https://api.exemple.com"
              placeholderTextColor={COLORS.textMuted}
              value={settings.backendApiUrl}
              onChangeText={(v) => updateSettings({ backendApiUrl: v })}
              autoCapitalize="none"
              keyboardType="url"
            />
          </SettingsRow>
          <SettingsRow label="Broker MQTT" sublabel="mqtt://broker.exemple.com:1883" last>
            <TextInput
              style={styles.input}
              placeholder="mqtt://broker.exemple.com"
              placeholderTextColor={COLORS.textMuted}
              value={settings.mqttBrokerUrl}
              onChangeText={(v) => updateSettings({ mqttBrokerUrl: v })}
              autoCapitalize="none"
            />
          </SettingsRow>
        </SettingsSection>

        {/* Push token */}
        {settings.pushToken && (
          <SettingsSection title="Token de notification">
            <SettingsRow label="Token Expo Push" sublabel={settings.pushToken.slice(0, 40) + '...'} last>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
            </SettingsRow>
          </SettingsSection>
        )}

        {/* Notifications */}
        <SettingsSection title="Notifications">
          <SettingsRow label="Activer les alertes" sublabel="Notifications push prioritaires">
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={(v) => updateSettings({ notificationsEnabled: v })}
              trackColor={{ false: COLORS.border, true: COLORS.accent }}
              thumbColor="#fff"
            />
          </SettingsRow>
          <SettingsRow label="Tester notification" sublabel="Envoie une alerte test Zone 1" last>
            <TouchableOpacity
              style={[styles.actionBtn, testingNotif && styles.actionBtnDisabled]}
              onPress={handleTestNotification}
              disabled={testingNotif}
            >
              <Ionicons name="notifications" size={14} color={testingNotif ? COLORS.textMuted : COLORS.accent} />
              <Text style={[styles.actionBtnText, testingNotif && { color: COLORS.textMuted }]}>
                {testingNotif ? 'Envoi...' : 'Tester'}
              </Text>
            </TouchableOpacity>
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="Confort tactile">
          <SettingsRow
            label="Touch-Safe Mode"
            sublabel="Augmente l'espace bas pour eviter les conflits avec gestes systeme"
            last
          >
            <Switch
              value={settings.touchSafeMode}
              onValueChange={(v) => updateSettings({ touchSafeMode: v })}
              trackColor={{ false: COLORS.border, true: COLORS.accent }}
              thumbColor="#fff"
            />
          </SettingsRow>
        </SettingsSection>

        {/* Simulation mode */}
        <SettingsSection title="Mode simulation">
          <SettingsRow label="Simulation active" sublabel="Tester sans matériel ESP32" last={false}>
            <Switch
              value={settings.simulationMode}
              onValueChange={(v) => updateSettings({ simulationMode: v })}
              trackColor={{ false: COLORS.border, true: COLORS.warning }}
              thumbColor="#fff"
            />
          </SettingsRow>

          <View style={styles.simGrid}>
            <Text style={styles.simLabel}>Déclencher un appel simulé (machine + type panne) :</Text>
            <View style={styles.simButtons}>
              {ZONE_IDS.map((zoneId) => {
                const color = ZONE_CONFIGS[zoneId].color;
                return (
                  <View key={zoneId} style={styles.machineGroup}>
                    <Text style={[styles.machineTitle, { color }]}>{ZONE_CONFIGS[zoneId].name}</Text>
                    {BUTTON_IDS.map((buttonId) => {
                      const key = `${zoneId}-${buttonId}`;
                      const isActive = simulatingKey === key;
                      return (
                        <TouchableOpacity
                          key={key}
                          style={[styles.simBtn, { borderColor: color }, isActive && { backgroundColor: `${color}22` }]}
                          onPress={() => handleSimulateCall(zoneId, buttonId)}
                          disabled={simulatingKey !== null}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={isActive ? 'radio-button-on' : 'radio-button-off'}
                            size={14}
                            color={color}
                          />
                          <Text style={[styles.simBtnText, { color }]}>
                            {isActive ? 'CALL...' : `CALL:${zoneId}${buttonId}`}
                          </Text>
                          <Text style={styles.simBtnSubtext}>{PANNE_TYPES[buttonId].label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          </View>
        </SettingsSection>

        {/* Danger zone */}
        <SettingsSection title="Zone danger">
          <TouchableOpacity
            style={styles.dangerBtn}
            onPress={() => setShowClearConfirm(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash" size={18} color={COLORS.danger} />
            <Text style={styles.dangerBtnText}>Réinitialiser toutes les données</Text>
          </TouchableOpacity>
        </SettingsSection>

        {/* About */}
        <View style={styles.about}>
          <Text style={styles.aboutText}>Maintenance Call v1.0.0</Text>
          <Text style={styles.aboutText}>Architecture: ESP32 → LoRa → WiFi → FCM → Expo</Text>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={showClearConfirm}
        title="Réinitialiser les données"
        message="Tout l'historique local sera supprimé définitivement. Cette action est irréversible."
        confirmLabel="Supprimer"
        destructive
        onConfirm={handleClearAll}
        onCancel={() => setShowClearConfirm(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  subtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  scrollContent: { paddingBottom: 120 },
  scrollContentTouchSafe: { paddingBottom: 160 },
  section: { marginTop: SPACING.md, marginHorizontal: SPACING.md },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    gap: SPACING.sm,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  rowLabel: { flex: 1 },
  rowLabelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  rowSublabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  rowControl: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.textPrimary,
    minWidth: 180,
    fontFamily: 'monospace',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  saveBtn: {
    padding: 10,
    backgroundColor: `${COLORS.accent}22`,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: `${COLORS.accent}44`,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: `${COLORS.accent}22`,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: `${COLORS.accent}44`,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accent,
  },
  reconnectWrap: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  simGrid: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  simLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
    fontWeight: '600',
  },
  simButtons: {
    gap: SPACING.md,
  },
  machineGroup: {
    gap: SPACING.sm,
  },
  machineTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  simBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    backgroundColor: COLORS.surface,
    width: '100%',
  },
  simBtnText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: 'monospace',
  },
  simBtnSubtext: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginLeft: 2,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.dangerMuted,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: `${COLORS.danger}44`,
  },
  dangerBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.danger,
  },
  about: {
    padding: SPACING.xl,
    alignItems: 'center',
    gap: 4,
  },
  aboutText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: 'monospace',
  },
});
