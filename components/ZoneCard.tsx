import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Zone } from '../types/maintenance';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { ZONE_CONFIGS } from '../constants/zones';

interface ZoneCardProps {
  zone: Zone;
  onAcknowledge: () => void;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Aucun appel';
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  if (isToday) return `Aujourd'hui ${formatTime(iso)}`;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ZoneCard: React.FC<ZoneCardProps> = ({ zone, onAcknowledge }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const isActive = zone.status === 'CALL';
  const zoneColor = ZONE_CONFIGS[zone.id].color;

  useEffect(() => {
    if (isActive) {
      // Pulse animation for active call
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      // Glow opacity pulse
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      glow.start();
      return () => {
        pulse.stop();
        glow.stop();
      };
    } else {
      pulseAnim.setValue(1);
      glowAnim.setValue(0);
    }
  }, [isActive]);

  const cardBorderColor = isActive ? COLORS.danger : COLORS.border;
  const statusColor = isActive ? COLORS.danger : COLORS.success;

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        { transform: [{ scale: pulseAnim }] },
      ]}
    >
      {/* Glow layer — only visible during active call */}
      {isActive && (
        <Animated.View
          style={[styles.glowLayer, { opacity: glowAnim }]}
          pointerEvents="none"
        />
      )}

      <View
        style={[
          styles.card,
          { borderColor: cardBorderColor },
          isActive && styles.cardActive,
        ]}
      >
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: isActive ? COLORS.danger : zoneColor }]} />

        <View style={styles.body}>
          {/* Header row */}
          <View style={styles.header}>
            <View style={styles.zoneInfo}>
              {/* Zone icon badge */}
              <View style={[styles.zoneBadge, { backgroundColor: isActive ? COLORS.dangerMuted : `${zoneColor}22` }]}>
                <Ionicons
                  name="location"
                  size={16}
                  color={isActive ? COLORS.danger : zoneColor}
                />
              </View>
              <View>
                <Text style={styles.zoneName}>{zone.name}</Text>
                <Text style={styles.zoneLabel}>{ZONE_CONFIGS[zone.id].label.split(' — ')[1] ?? ''}</Text>
              </View>
            </View>

            {/* Status badge */}
            <View style={[styles.statusBadge, { backgroundColor: isActive ? COLORS.dangerMuted : COLORS.successMuted }]}>
              {isActive && (
                <View style={styles.statusDot} />
              )}
              <Text style={[styles.statusText, { color: statusColor }]}>
                {isActive ? 'APPEL EN COURS' : 'OK'}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Last call info */}
          <View style={styles.meta}>
            <Ionicons name="time-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.metaLabel}>Dernier appel</Text>
            <Text style={styles.metaValue}>{formatDate(zone.lastCallAt)}</Text>
          </View>
          {zone.activePanneLabel && (
            <View style={styles.meta}>
              <Ionicons name="build-outline" size={14} color={COLORS.warning} />
              <Text style={styles.metaLabel}>Type panne</Text>
              <Text style={styles.metaValue}>
                {zone.activeButton} - {zone.activePanneLabel}
              </Text>
            </View>
          )}

          {/* ACK button — only when active */}
          {isActive && (
            <TouchableOpacity
              style={styles.ackButton}
              onPress={onAcknowledge}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.ackButtonText}>Acquitter</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  glowLayer: {
    position: 'absolute',
    inset: -4,
    borderRadius: RADIUS.lg + 4,
    backgroundColor: COLORS.danger,
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 20,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cardActive: {
    backgroundColor: '#1A0A0A',
  },
  accentBar: {
    width: 5,
    borderTopLeftRadius: RADIUS.lg,
    borderBottomLeftRadius: RADIUS.lg,
  },
  body: {
    flex: 1,
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  zoneInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  zoneBadge: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  zoneLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.danger,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginRight: 4,
  },
  metaValue: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  ackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.danger,
    marginTop: SPACING.sm,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  ackButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
