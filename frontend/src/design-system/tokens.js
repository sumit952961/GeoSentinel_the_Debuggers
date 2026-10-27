/**
 * ============================================================
 * AIDRS Design System — Tokens
 * ============================================================
 * Central source of truth for all visual design decisions.
 * Every color, size, spacing, and shadow in the application
 * should reference these tokens rather than using magic values.
 */

// ─── Semantic Emergency Colors (consistent everywhere) ──────
export const SEVERITY = {
  minimal:   { bg: '#059669', fg: '#ffffff', light: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
  minor:     { bg: '#d97706', fg: '#ffffff', light: '#fffbeb', border: '#fcd34d', text: '#92400e' },
  major:     { bg: '#ea580c', fg: '#ffffff', light: '#fff7ed', border: '#fdba74', text: '#9a3412' },
  destroyed: { bg: '#dc2626', fg: '#ffffff', light: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
  unknown:   { bg: '#6b7280', fg: '#ffffff', light: '#f3f4f6', border: '#d1d5db', text: '#374151' },
};

export const PRIORITY = {
  critical: { bg: '#dc2626', fg: '#ffffff', light: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
  high:     { bg: '#ea580c', fg: '#ffffff', light: '#fff7ed', border: '#fdba74', text: '#9a3412' },
  medium:   { bg: '#d97706', fg: '#ffffff', light: '#fffbeb', border: '#fcd34d', text: '#92400e' },
  low:      { bg: '#059669', fg: '#ffffff', light: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
};

export const ROAD_STATUS = {
  open:    { bg: '#059669', fg: '#ffffff', light: '#ecfdf5' },
  hazard:  { bg: '#d97706', fg: '#ffffff', light: '#fffbeb' },
  blocked: { bg: '#7c3aed', fg: '#ffffff', light: '#f5f3ff' },
};

export const SYSTEM_STATUS = {
  online:   { bg: '#059669', fg: '#ffffff', dot: '#10b981' },
  degraded: { bg: '#d97706', fg: '#ffffff', dot: '#f59e0b' },
  offline:  { bg: '#dc2626', fg: '#ffffff', dot: '#ef4444' },
};

// ─── Damage Colors (map consistent) ────────────────────────
export const DAMAGE_COLORS = {
  'no-damage':    '#059669',
  'minor-damage': '#d97706',
  'major-damage': '#ea580c',
  'destroyed':    '#dc2626',
  'unknown':      '#6b7280',
};

export const DAMAGE_LABELS = {
  'no-damage':    'Minimal',
  'minor-damage': 'Minor',
  'major-damage': 'Major',
  'destroyed':    'Destroyed',
};

export const PRIORITY_COLORS = {
  CRITICAL: '#dc2626',
  HIGH:     '#ea580c',
  MEDIUM:   '#d97706',
  LOW:      '#059669',
};

// ─── Route Colors ──────────────────────────────────────────
export const ROUTE_COLORS = {
  response:   { primary: '#d97706', glow: '#fef3c7', accent: '#f59e0b' },
  evacuation: { primary: '#0369a1', glow: '#e0f2fe', accent: '#38bdf8' },
};

// ─── Operational Colors ────────────────────────────────────
export const OPS = {
  info:    '#0369a1',
  warning: '#d97706',
  danger:  '#dc2626',
  success: '#059669',
};

// ─── Typography ────────────────────────────────────────────
export const TYPE = {
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontMono: "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace",
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  fontWeight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  fontSize: { xs: '11px', sm: '12px', md: '14px', lg: '16px', xl: '20px', '2xl': '24px', '3xl': '32px' },
  scale: {
    displayLg: { size: '48px', weight: 700, lineHeight: 1.1, letterSpacing: '-0.025em' },
    displaySm: { size: '36px', weight: 700, lineHeight: 1.15, letterSpacing: '-0.02em' },
    headingXl: { size: '28px', weight: 600, lineHeight: 1.2, letterSpacing: '-0.015em' },
    headingLg: { size: '22px', weight: 600, lineHeight: 1.25, letterSpacing: '-0.01em' },
    headingMd: { size: '18px', weight: 600, lineHeight: 1.3, letterSpacing: '-0.005em' },
    headingSm: { size: '15px', weight: 600, lineHeight: 1.35, letterSpacing: '0' },
    body:      { size: '14px', weight: 400, lineHeight: 1.5, letterSpacing: '0' },
    bodySm:    { size: '13px', weight: 400, lineHeight: 1.45, letterSpacing: '0' },
    caption:   { size: '12px', weight: 500, lineHeight: 1.4, letterSpacing: '0.01em' },
    overline:  { size: '11px', weight: 600, lineHeight: 1.3, letterSpacing: '0.06em' },
  },
};

// ─── Spacing ───────────────────────────────────────────────
export const SPACE = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  // Named aliases
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
};

// ─── Radius ────────────────────────────────────────────────
export const RADIUS = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  full: '9999px',
};

// ─── Shadows ───────────────────────────────────────────────
export const SHADOW = {
  sm:      '0 1px 2px rgba(0,0,0,0.05)',
  md:      '0 2px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  lg:      '0 4px 8px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
  xl:      '0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)',
  overlay: '0 12px 40px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.1)',
};

// ─── Z-Index ───────────────────────────────────────────────
export const Z = {
  base: 1,
  mapControls: 1000,
  mapOverlay: 1100,
  sidebar: 1200,
  topbar: 1500,
  modal: 2000,
  tooltip: 2500,
  notification: 3000,
};

// ─── Dark Theme Surface Tokens ─────────────────────────────
export const DARK = {
  bg:          '#0c111d',
  bgSubtle:    '#131a2b',
  surface:     '#1a2236',
  surfaceHov:  '#1f2a42',
  elevated:    '#243049',
  border:      '#2a3550',
  borderLight: '#364363',
  text:        '#edf0f7',
  textSec:     '#8b95ad',
  textMuted:   '#5e6a84',
  accent:      '#3b82f6',
  accentHov:   '#2563eb',
  accentSoft:  'rgba(59, 130, 246, 0.12)',
};

// ─── Light Theme Surface Tokens ────────────────────────────
export const LIGHT = {
  bg:          '#f7f8fa',
  bgSubtle:    '#ffffff',
  surface:     '#ffffff',
  surfaceHov:  '#f1f3f7',
  elevated:    '#ffffff',
  border:      '#dfe3eb',
  borderLight: '#e8ecf2',
  text:        '#111827',
  textSec:     '#4b5563',
  textMuted:   '#9ca3af',
  accent:      '#2563eb',
  accentHov:   '#1d4ed8',
  accentSoft:  'rgba(37, 99, 235, 0.08)',
};

// ─── Transition ────────────────────────────────────────────
export const TRANSITION = {
  fast:   '120ms ease',
  normal: '200ms ease',
  slow:   '300ms ease',
};
