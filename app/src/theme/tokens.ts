import { Platform } from 'react-native';
import { DiagnosisSource, RepairGuide, Severity, SymptomCategory } from '../types';

// Design tokens for TorqueDoc.
// A midnight garage bay: deep blue-black surfaces, electric cyan structure,
// and a warm diagnostic amber that behaves like a dashboard warning light.
// Gradients are kept in one place so the web and native builds stay in sync.

export const colors = {
  background: '#080D13',
  surface: '#111923',
  surfaceRaised: '#182433',
  surfaceSoft: '#0D141D',
  border: '#25364A',

  textPrimary: '#F4F8FC',
  textSecondary: '#A5B7C9',
  textMuted: '#71869B',

  primary: '#2563EB',
  primaryLight: '#38BDF8',
  cyan: '#22D3EE',

  accent: '#FFB020', // "check engine" amber — the diagnosis signature
  accentDeep: '#E07A00',
  accentSoft: '#3A2A10',
  success: '#34D399',
  danger: '#FB7185',

  severityLow: '#34D399',
  severityMedium: '#FFB020',
  severityHigh: '#FB923C',
  severityUrgent: '#FB7185',
} as const;

export const gradients = {
  app: ['#080D13', '#0B1520', '#0F1117'] as const,
  hero: ['#143050', '#0D1C2C', '#21170B'] as const,
  accent: ['#FFD166', '#FFB020', '#E07A00'] as const,
  primary: ['#2563EB', '#0EA5E9'] as const,
  card: ['#172434', '#111923'] as const,
  icon: ['#263A52', '#162433'] as const,
} as const;

export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  glow: {
    shadowColor: '#FFB020',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
} as const;

export const spacing = (multiplier: number) => multiplier * 4;

export const radii = {
  sm: 8,
  md: 14,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const touchTarget = 46;

// Type scale. System fonts are used so the project runs with zero font-asset
// setup; the tighter display tracking and small uppercase eyebrows do most of
// the visual work.
export const typography = {
  display: { fontSize: 31, fontWeight: '800' as const, letterSpacing: -0.9 },
  heading: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  subheading: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '400' as const },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
  mono: {
    fontSize: 13,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
  },
};

export const severityColor = (severity: Severity) => {
  switch (severity) {
    case 'low':
      return colors.severityLow;
    case 'medium':
      return colors.severityMedium;
    case 'high':
      return colors.severityHigh;
    case 'urgent':
      return colors.severityUrgent;
  }
};

export const severityLabel = (severity: Severity): string => {
  switch (severity) {
    case 'low':
      return 'Low priority';
    case 'medium':
      return 'Worth scheduling soon';
    case 'high':
      return 'Address promptly';
    case 'urgent':
      return 'Safety-relevant — don’t delay';
  }
};

export const difficultyLabel = (difficulty: RepairGuide['difficulty']): string => {
  switch (difficulty) {
    case 'easy':
      return 'Easy';
    case 'moderate':
      return 'Moderate';
    case 'advanced':
      return 'Advanced';
  }
};

export const sourceLabel = (source: DiagnosisSource): string => {
  switch (source) {
    case 'checklist':
      return 'Symptom checklist';
    case 'free_text':
      return 'Described in words';
    case 'media':
      return 'Photo / video';
    case 'audio':
      return 'Recorded sound';
  }
};

export const categoryLabel = (category: SymptomCategory): string => {
  switch (category) {
    case 'engine':
      return 'Engine';
    case 'starting_charging':
      return 'Starting & charging';
    case 'brakes':
      return 'Brakes';
    case 'cooling':
      return 'Cooling';
    case 'exhaust':
      return 'Exhaust';
    case 'drive_chain_clutch':
      return 'Drive chain & clutch';
  }
};
