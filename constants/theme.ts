// ─── Ultra-Dark Premium Edition · Spatial UI Theme ────────────────────────────
export const Colors = {
  // ── Core Backgrounds (Onyx Palette) ──────────────────────────────────────
  background: '#08090A',          // Onyx base
  surface: '#0D0E10',             // Glass surface
  surfaceElevated: '#111215',     // Elevated glass surface
  surfaceGlass: 'rgba(255,255,255,0.05)',

  // ── Primary Accent (Electric Cyan) ───────────────────────────────────────
  primary: '#40E0FF',             // Electric Cyan
  primaryDark: '#00C8E8',
  primaryLight: '#7AEFFF',
  primarySoft: 'rgba(64,224,255,0.10)',

  secondary: '#64748B',

  // ── Typography ───────────────────────────────────────────────────────────
  text: '#FFFFFF',                // Pure white for primary values
  textSecondary: '#64748B',       // Muted slate
  textTertiary: '#3F4D5C',        // Deep muted
  textOnPrimary: '#08090A',       // Dark text on bright accents

  // ── Borders (Light-Catcher Effect) ───────────────────────────────────────
  border: 'rgba(255,255,255,0.10)',      // 1px light-catcher border
  borderLight: 'rgba(255,255,255,0.06)',
  divider: 'rgba(255,255,255,0.08)',

  // ── Status ────────────────────────────────────────────────────────────────
  success: '#22C55E',
  warning: '#FFB800',
  error: '#FF4444',
  info: '#40E0FF',

  // ── Crowd Levels ──────────────────────────────────────────────────────────
  crowdLight: '#22C55E',
  crowdModerate: '#FFB800',
  crowdHeavy: '#FF4444',

  // ── Rail Line Colors (Neon Enhanced) ─────────────────────────────────────
  mrt3: '#4499FF',      // Neon Blue
  lrt1: '#FFE600',      // Neon Yellow
  lrt2: '#BB44FF',      // Neon Violet

  // ── Shadows & Overlays ───────────────────────────────────────────────────
  shadow: 'rgba(0,0,0,0.5)',
  shadowDark: 'rgba(0,0,0,0.8)',
  overlay: 'rgba(0,0,0,0.75)',
  shimmer: '#1A1C1F',

  // ── Premium & Special ────────────────────────────────────────────────────
  gold: '#FFB800',
  premium: '#40E0FF',
  premiumGradientStart: '#40E0FF',
  premiumGradientEnd: '#7B2FFF',

  // ── AI & Community Accent ────────────────────────────────────────────────
  violet: '#BB44FF',
  violetLight: 'rgba(187,68,255,0.15)',
  violetDark: '#9933DD',
  amber: '#FFB800',
  amberLight: 'rgba(255,184,0,0.12)',
  amberDark: '#CC8800',

  // ── Dark Glassmorphism ───────────────────────────────────────────────────
  glass: 'rgba(255,255,255,0.05)',
  glassBorder: 'rgba(255,255,255,0.10)',
  glassDark: 'rgba(0,0,0,0.6)',

  // ── Ultra-Dark Premium Specials ───────────────────────────────────────────
  neonLime: '#B6FF3B',         // Active line glow / exit markers
  electricCyan: '#40E0FF',     // Fare scan pulse / AI breathing
  onyxBase: '#08090A',         // True onyx
  meshBlue: '#0A1628',         // Deep midnight blue for mesh gradients
  supabaseGreen: '#3ECF8E',    // Verified via Supabase dot

  // ── Neomorphic Inset (Action Buttons) ────────────────────────────────────
  neomorphicBg: '#0A0B0D',
  neomorphicLight: 'rgba(255,255,255,0.04)',
  neomorphicDark: 'rgba(0,0,0,0.8)',
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 32,
    elevation: 16,
  },
  neonLime: {
    shadowColor: '#B6FF3B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  electricCyan: {
    shadowColor: '#40E0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  supabase: {
    shadowColor: '#3ECF8E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
};
