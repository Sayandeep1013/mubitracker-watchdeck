import { Easing } from 'react-native-reanimated';

/** Single source of truth for color (spec 31 §1) — no screen file should
 * contain a hex literal after this lands. Values match the web accent
 * (#ef4444) instead of the mobile-only #dc2626 that had drifted from it. */
export const color = {
  bg: '#09090b',
  surface: '#18181b',
  surfaceHigh: '#27272a',
  border: '#27272a',
  primary: '#ef4444',
  onPrimary: '#ffffff',
  text: '#fafafa',
  textMuted: '#71717a',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
  review: '#a855f7',
  friends: '#38bdf8',
  info: '#818cf8',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const type = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const },
  headline: { fontSize: 24, lineHeight: 32, fontWeight: '700' as const },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
} as const;

/** spec 31 §4 — swipe deck motion constants.
 *
 * SWIPE_THRESHOLD_X/Y lowered from 120/100 — confirmed too far live
 * ("wants more... needs me to swipe too much for a confirmation"): a
 * deliberate drag had to cover nearly a third of the screen width before
 * it committed. VELOCITY_THRESHOLD is new — a fast flick now commits
 * even short of the distance threshold (matches how Tinder itself
 * behaves: a quick flick and a slow deliberate drag both feel
 * "intentional", but a flick shouldn't need to travel as far as a slow
 * drag to prove intent). Distance-only commit is still there for a slow
 * drag that's short on speed but long on distance. */
export const motion = {
  SWIPE_THRESHOLD_X: 85,
  SWIPE_THRESHOLD_Y: 70,
  VELOCITY_THRESHOLD: 700,
  CUE_THRESHOLD_X: 40,
  CUE_THRESHOLD_Y: 55,
  ROTATION_FACTOR: 0.05,
  EXIT_DURATION: 220,
  ENTER_DURATION: 200,
  EXIT_EASING: Easing.bezier(0.05, 0.7, 0.1, 1),
  SPRING: { damping: 18, stiffness: 220, mass: 0.6 },
} as const;

export const elevation = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
} as const;

export const theme = { color, space, radius, type, motion, elevation } as const;
export type Theme = typeof theme;

/** Minimum interactive size (spec 31 §2). Use as `hitSlop` on any control
 * whose visual box is smaller than 48dp, e.g. `hitSlop={hitSlopFor(24)}`. */
export function hitSlopFor(visualSize: number): number {
  return Math.max(0, Math.ceil((48 - visualSize) / 2));
}
