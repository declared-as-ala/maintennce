import { ZoneId, Zone, ButtonId } from '../types/maintenance';

export const ZONE_CONFIGS: Record<ZoneId, { name: string; label: string; color: string }> = {
  Z1: { name: 'Machine 1', label: 'Machine 1 — Ligne A', color: '#3B82F6' },
  Z2: { name: 'Machine 2', label: 'Machine 2 — Ligne B', color: '#8B5CF6' },
};

export const ZONE_IDS: ZoneId[] = ['Z1', 'Z2'];

export const BUTTON_IDS: ButtonId[] = ['B1', 'B2', 'B3', 'B4'];

export const PANNE_TYPES: Record<ButtonId, { label: string }> = {
  B1: { label: 'Panne mecanique' },
  B2: { label: 'Panne electrique' },
  B3: { label: 'Panne capteur' },
  B4: { label: 'Arret urgence' },
};

export const INITIAL_ZONES: Zone[] = ZONE_IDS.map((id) => ({
  id,
  name: ZONE_CONFIGS[id].name,
  label: ZONE_CONFIGS[id].label,
  status: 'OK',
  lastCallAt: null,
  acknowledgedAt: null,
  activeButton: null,
  activePanneLabel: null,
}));
