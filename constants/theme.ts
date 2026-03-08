// ─── Standard Light Mode Theme · High-Contrast Accessibility ────────────────
export const Colors = {
  // ── Core Backgrounds (Light Palette) ─────────────────────────────────────
  background: '#FFFFFF',          // Pure white base
  surface: '#F8F9FA',             // Off-white surface
  surfaceElevated: '#F1F3F5',     // Slightly elevated surface
  surfaceGlass: 'rgba(0,0,0,0.03)',

  // ── Primary Accent (Accessible Blue) ─────────────────────────────────────
  primary: '#0070CC',             // Standard accessible blue
  primaryDark: '#005BA3',
  primaryLight: '#3B9FE6',
  primarySoft: 'rgba(0,112,204,0.10)',

  secondary: '#64748B',

  // ── Typography ───────────────────────────────────────────────────────────
  text: '#0A0A0A',                // Near-black for primary text
  textSecondary: '#4B5563',       // Medium gray
  textTertiary: '#9CA3AF',        // Muted gray
  textOnPrimary: '#FFFFFF',       // White text on primary

  // ── Borders ───────────────────────────────────────────────────────────────
  border: 'rgba(0,0,0,0.12)',     // Standard border
  borderLight: 'rgba(0,0,0,0.06)',
  divider: 'rgba(0,0,0,0.08)',

  // ── Status ────────────────────────────────────────────────────────────────
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  info: '#0284C7',

  // ── Crowd Levels ──────────────────────────────────────────────────────────
  crowdLight: '#16A34A',
  crowdModerate: '#D97706',
  crowdHeavy: '#DC2626',

  // ── Rail Line Colors ──────────────────────────────────────────────────────
  mrt3: '#1D6FE8',      // MRT-3 Blue
  lrt1: '#D4A017',      // LRT-1 Amber
  lrt2: '#7C3AED',      // LRT-2 Violet

  // ── Shadows & Overlays ───────────────────────────────────────────────────
  shadow: 'rgba(0,0,0,0.10)',
  shadowDark: 'rgba(0,0,0,0.20)',
  overlay: 'rgba(0,0,0,0.50)',
  shimmer: '#E5E7EB',

  // ── Premium & Special ────────────────────────────────────────────────────
  gold: '#D97706',
  premium: '#0070CC',
  premiumGradientStart: '#0070CC',
  premiumGradientEnd: '#7C3AED',

  // ── AI & Community Accent ────────────────────────────────────────────────
  violet: '#7C3AED',
  violetLight: 'rgba(124,58,237,0.10)',
  violetDark: '#5B21B6',
  amber: '#D97706',
  amberLight: 'rgba(217,119,6,0.10)',
  amberDark: '#B45309',

  // ── Light Mode Glass ─────────────────────────────────────────────────────
  glass: 'rgba(255,255,255,0.80)',
  glassBorder: 'rgba(0,0,0,0.10)',
  glassDark: 'rgba(0,0,0,0.06)',

  // ── Legacy compatibility (mapped to light equivalents) ────────────────────
  neonLime: '#65A30D',         // Muted lime
  electricCyan: '#0284C7',     // Mapped to accessible blue
  onyxBase: '#FFFFFF',         // Now white
  meshBlue: '#EFF6FF',         // Light blue tint
  supabaseGreen: '#16A34A',    // Supabase verified green

  // ── Neomorphic (Light) ────────────────────────────────────────────────────
  neomorphicBg: '#F8F9FA',
  neomorphicLight: 'rgba(255,255,255,0.90)',
  neomorphicDark: 'rgba(0,0,0,0.10)',
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
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
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
  neonLime: {
    shadowColor: '#65A30D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  electricCyan: {
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  supabase: {
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
};
