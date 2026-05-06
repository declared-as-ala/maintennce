import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ConnectionStatus as ConnectionStatusType } from '../types/maintenance';
import { COLORS, RADIUS } from '../constants/theme';

interface Props {
  status: ConnectionStatusType;
}

const CONFIG: Record<
  ConnectionStatusType,
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  online: { label: 'En ligne', color: COLORS.success, icon: 'wifi' },
  local: { label: 'Mode local', color: COLORS.warning, icon: 'home' },
  offline: { label: 'Hors ligne', color: COLORS.danger, icon: 'wifi-outline' },
  connecting: { label: 'Connexion...', color: COLORS.textMuted, icon: 'sync' },
};

export const ConnectionStatusBadge: React.FC<Props> = ({ status }) => {
  const cfg = CONFIG[status];

  return (
    <View style={[styles.badge, { borderColor: `${cfg.color}44` }]}>
      <View style={[styles.dot, { backgroundColor: cfg.color }]} />
      <Ionicons name={cfg.icon} size={12} color={cfg.color} />
      <Text style={[styles.label, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
