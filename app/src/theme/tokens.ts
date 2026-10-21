import { Platform } from 'react-native';
import { DiagnosisSource, RepairGuide, Severity, SymptomCategory } from '../types';

// Design tokens for TorqueDoc.
// Palette is a "diagnostic workshop" direction: graphite surfaces (a garage bay
// at night), steel blue for structure/trust, and a diagnostic amber for
// anything that needs attention — echoing a dashboard warning light rather
// than a generic app accent color.

export const colors = {
  background: '#15181C',
  surface: '#1F2328',
  surfaceRaised: '#282D33',
  border: '#363C43',

  textPrimary: '#EDEFF1',
  textSecondary: '#9AA4AC',
  textMuted: '#6B7480',

  primary: '#2E5C99',
  primaryLight: '#4778BE',

  accent: '#F2A93B', // "check engine" amber — used for the diagnosis / prescription signature
  success: '#4E9B6E',
  danger: '#D6534A',

  severityLow: '#4E9B6E',
  severityMedium: '#F2A93B',
  severityHigh: '#E07B39',
  severityUrgent: '#D6534A',
} as const;

export const spacing = (multiplier: number) => multiplier * 4;

export const radii = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const touchTarget = 44;

// Type scale. System fonts are used so the project runs with zero font-asset
// setup; swap in Space Grotesk / Inter via expo-font if you want the full
// workshop-brand treatment.
export const typography = {
  display: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 20, fontWeight: '600' as const },
  subheading: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
  caption: { fontSize: 12, fontWeight: '400' as const },
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
