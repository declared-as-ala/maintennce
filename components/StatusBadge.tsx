import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CallEventStatus } from '../types/maintenance';
import { COLORS, RADIUS } from '../constants/theme';

interface Props {
  status: CallEventStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<Props> = ({ status, size = 'md' }) => {
  const isAck = status === 'acknowledged';

  return (
    <View
      style={[
        styles.badge,
        size === 'sm' && styles.badgeSm,
        { backgroundColor: isAck ? COLORS.successMuted : COLORS.dangerMuted },
      ]}
    >
      <View
        style={[
          styles.dot,
          { backgroundColor: isAck ? COLORS.success : COLORS.danger },
        ]}
      />
      <Text
        style={[
          styles.text,
          size === 'sm' && styles.textSm,
          { color: isAck ? COLORS.success : COLORS.danger },
        ]}
      >
        {isAck ? 'Acquitté' : 'En attente'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  badgeSm: {
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  textSm: {
    fontSize: 10,
  },
});
