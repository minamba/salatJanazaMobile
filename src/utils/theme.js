export const colors = {
  background: '#F4F8F4',
  backgroundSecondary: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceElevated: '#EDF2EE',
  border: '#C8D8CA',
  borderLight: '#DAE8DC',
  primary: '#5C8062',
  primaryLight: '#7A9E7E',
  primaryDim: 'rgba(92, 128, 98, 0.09)',
  accent: '#0284C7',
  text: '#111B13',
  textSecondary: '#4B6351',
  textMuted: '#8FAF95',
  success: '#4A7A4E',
  warning: '#B45309',
  error: '#DC2626',
  white: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.28)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 9999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700', color: colors.text },
  h3: { fontSize: 18, fontWeight: '600', color: colors.text },
  body: { fontSize: 15, fontWeight: '400', color: colors.text, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400', color: colors.textSecondary, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400', color: colors.textMuted },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.3 },
  button: { fontSize: 15, fontWeight: '600', color: colors.white },
};

export const shadow = {
  sm: {
    shadowColor: '#1A3320',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#1A3320',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.11,
    shadowRadius: 16,
    elevation: 5,
  },
};
