import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMaintenanceStore } from '../../store/useMaintenanceStore';
import { StatusBadge } from '../../components/StatusBadge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CallEvent, ZoneId } from '../../types/maintenance';
import { ZONE_IDS, ZONE_CONFIGS } from '../../constants/zones';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

type FilterZone = ZoneId | 'ALL';
type FilterStatus = 'all' | 'pending' | 'acknowledged';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}min${s > 0 ? ` ${s}s` : ''}`;
}

interface HistoryItemProps {
  item: CallEvent;
}

const HistoryItem: React.FC<HistoryItemProps> = ({ item }) => {
  const zoneColor = ZONE_CONFIGS[item.zone].color;
  return (
    <View style={styles.item}>
      {/* Zone color indicator */}
      <View style={[styles.itemAccent, { backgroundColor: zoneColor }]} />

      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <View style={styles.itemTitleRow}>
            <Text style={styles.itemZone}>{item.zoneName}</Text>
            <Text style={[styles.itemSource, { color: `${zoneColor}99` }]}>
              {item.source === 'simulation' ? 'SIM' : item.source.toUpperCase()}
            </Text>
          </View>
          <StatusBadge status={item.status} size="sm" />
        </View>

        <View style={styles.itemMeta}>
          <View style={styles.metaRow}>
            <Ionicons name="construct-outline" size={13} color={COLORS.warning} />
            <Text style={styles.metaText}>
              {item.button} - {item.panneLabel}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="play-circle-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.metaText}>{formatDateTime(item.startedAt)}</Text>
          </View>
          {item.acknowledgedAt && (
            <View style={styles.metaRow}>
              <Ionicons name="checkmark-circle-outline" size={13} color={COLORS.success} />
              <Text style={styles.metaText}>{formatDateTime(item.acknowledgedAt)}</Text>
            </View>
          )}
          <View style={styles.metaRow}>
            <Ionicons name="timer-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.metaText}>Délai : {formatDuration(item.durationSeconds)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default function HistoryScreen() {
  const { history, clearHistory } = useMaintenanceStore();
  const [zoneFilter, setZoneFilter] = useState<FilterZone>('ALL');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filtered = useMemo(() => {
    return history.filter((item) => {
      if (zoneFilter !== 'ALL' && item.zone !== zoneFilter) return false;
      if (statusFilter === 'pending' && item.status !== 'pending') return false;
      if (statusFilter === 'acknowledged' && item.status !== 'acknowledged') return false;
      if (search && !item.zoneName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [history, zoneFilter, statusFilter, search]);

  const pendingCount = history.filter((h) => h.status === 'pending').length;

  const handleClearHistory = async () => {
    setShowClearConfirm(false);
    await clearHistory();
  };

  const renderItem = useCallback(
    ({ item }: { item: CallEvent }) => <HistoryItem item={item} />,
    []
  );

  const keyExtractor = useCallback((item: CallEvent) => item.id, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Historique</Text>
          <Text style={styles.subtitle}>{history.length} événements</Text>
        </View>
        {history.length > 0 && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => setShowClearConfirm(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
          </TouchableOpacity>
        )}
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Zone filters */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, zoneFilter === 'ALL' && styles.filterChipActive]}
          onPress={() => setZoneFilter('ALL')}
        >
          <Text style={[styles.filterText, zoneFilter === 'ALL' && styles.filterTextActive]}>
            Toutes
          </Text>
        </TouchableOpacity>
        {ZONE_IDS.map((zoneId) => (
          <TouchableOpacity
            key={zoneId}
            style={[
              styles.filterChip,
              zoneFilter === zoneId && styles.filterChipActive,
              zoneFilter === zoneId && { borderColor: ZONE_CONFIGS[zoneId].color },
            ]}
            onPress={() => setZoneFilter(zoneId)}
          >
            <Text
              style={[
                styles.filterText,
                zoneFilter === zoneId && {
                  color: ZONE_CONFIGS[zoneId].color,
                  fontWeight: '700',
                },
              ]}
            >
              {zoneId}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Status filters */}
      <View style={styles.statusFilterRow}>
        {(['all', 'pending', 'acknowledged'] as FilterStatus[]).map((f) => {
          const label =
            f === 'all' ? 'Tous' : f === 'pending' ? `En attente (${pendingCount})` : 'Acquittés';
          return (
            <TouchableOpacity
              key={f}
              style={[styles.statusChip, statusFilter === f && styles.statusChipActive]}
              onPress={() => setStatusFilter(f)}
            >
              <Text
                style={[
                  styles.statusChipText,
                  statusFilter === f && styles.statusChipTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Aucun événement</Text>
            <Text style={styles.emptySubtitle}>
              {history.length === 0
                ? 'L\'historique des appels apparaîtra ici'
                : 'Aucun résultat pour ces filtres'}
            </Text>
          </View>
        }
      />

      <ConfirmDialog
        visible={showClearConfirm}
        title="Effacer l'historique"
        message="Cette action supprimera définitivement tout l'historique des appels."
        confirmLabel="Effacer"
        destructive
        onConfirm={handleClearHistory}
        onCancel={() => setShowClearConfirm(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  subtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  clearBtn: {
    padding: 10,
    backgroundColor: COLORS.dangerMuted,
    borderRadius: RADIUS.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    height: 44,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: `${COLORS.accent}22`,
    borderColor: COLORS.accent,
  },
  filterText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  filterTextActive: {
    color: COLORS.accent,
  },
  statusFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusChipActive: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.accent,
  },
  statusChipText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  statusChipTextActive: {
    color: COLORS.accent,
  },
  listContent: { paddingBottom: SPACING.xxl },
  emptyContainer: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
  item: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  itemAccent: { width: 4 },
  itemContent: { flex: 1, padding: SPACING.md },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  itemZone: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  itemSource: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  itemMeta: { gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: COLORS.textSecondary },
});
