export const Colors = {
  primary: '#1A73E8',
  primaryDark: '#1557B0',
  primaryLight: '#4A90D9',
  primarySoft: '#E8F0FE',
  secondary: '#5F6368',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  text: '#202124',
  textSecondary: '#5F6368',
  textTertiary: '#9AA0A6',
  textOnPrimary: '#FFFFFF',
  border: '#E8EAED',
  borderLight: '#F1F3F4',
  divider: '#DADCE0',
  success: '#34A853',
  warning: '#FBBC04',
  error: '#EA4335',
  info: '#4285F4',
  crowdLight: '#34A853',
  crowdModerate: '#FBBC04',
  crowdHeavy: '#EA4335',
  mrt3: '#1143A8',  // Deep Blue
  lrt1: '#F5C500',  // Vibrant Yellow
  lrt2: '#9C27B0',  // Luminous Violet
  shadow: 'rgba(0, 0, 0, 0.08)',
  shadowDark: 'rgba(0, 0, 0, 0.15)',
  overlay: 'rgba(0, 0, 0, 0.5)',
  shimmer: '#E8EAED',
  gold: '#F4B400',
  premium: '#1A237E',
  premiumGradientStart: '#1A73E8',
  premiumGradientEnd: '#0D47A1',
  // Phase 2: AI & Community accent colors
  violet: '#8B5CF6',
  violetLight: '#EDE9FE',
  violetDark: '#6D28D9',
  amber: '#F59E0B',
  amberLight: '#FEF3C7',
  amberDark: '#D97706',
  // Glassmorphism
  glass: 'rgba(255, 255, 255, 0.18)',
  glassBorder: 'rgba(255, 255, 255, 0.3)',
  glassDark: 'rgba(0, 0, 0, 0.2)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const FontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 28,
  display: 34,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
};
