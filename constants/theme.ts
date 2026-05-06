export const COLORS = {
  // Core backgrounds
  bg: '#0A0E1A',
  surface: '#111827',
  card: '#1C2333',
  cardHover: '#232D42',
  border: '#2D3748',
  borderSubtle: '#1F2937',

  // Status colors
  danger: '#EF4444',
  dangerMuted: '#7F1D1D',
  dangerGlow: 'rgba(239, 68, 68, 0.25)',
  success: '#10B981',
  successMuted: '#064E3B',
  successGlow: 'rgba(16, 185, 129, 0.2)',
  warning: '#F59E0B',
  warningMuted: '#78350F',
  info: '#3B82F6',
  infoMuted: '#1E3A5F',

  // Text
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  textDisabled: '#374151',

  // Accent
  accent: '#3B82F6',
  accentDark: '#1D4ED8',

  // Zone accent colors
  zoneZ1: '#3B82F6',
  zoneZ2: '#8B5CF6',
  zoneZ3: '#F59E0B',
  zoneZ4: '#06B6D4',

  // Status indicators
  online: '#10B981',
  offline: '#EF4444',
  local: '#F59E0B',
  connecting: '#6B7280',
} as const;

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  mono: 'monospace',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const RADIUS = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  danger: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
} as const;
