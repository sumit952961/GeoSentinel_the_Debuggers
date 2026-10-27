/**
 * AIDRS — Reusable StatusBadge Component
 */
import React from 'react';
import { RADIUS } from '../../design-system/tokens';
import { useTheme } from '../../context/ThemeContext';

const VARIANTS = {
  success:  { dark: { bg: 'rgba(5,150,105,0.15)', color: '#34d399', border: 'rgba(5,150,105,0.3)' }, light: { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' } },
  warning:  { dark: { bg: 'rgba(217,119,6,0.15)', color: '#fbbf24', border: 'rgba(217,119,6,0.3)' }, light: { bg: '#fffbeb', color: '#92400e', border: '#fcd34d' } },
  danger:   { dark: { bg: 'rgba(220,38,38,0.15)', color: '#fca5a5', border: 'rgba(220,38,38,0.3)' }, light: { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' } },
  info:     { dark: { bg: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: 'rgba(59,130,246,0.3)' }, light: { bg: '#eff6ff', color: '#1e40af', border: '#93c5fd' } },
  neutral:  { dark: { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: 'rgba(100,116,139,0.3)' }, light: { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' } },
};

export default function StatusBadge({ label, children, variant = 'neutral', dot = false, style = {} }) {
  const { isDark } = useTheme();
  const v = VARIANTS[variant]?.[isDark ? 'dark' : 'light'] || VARIANTS.neutral[isDark ? 'dark' : 'light'];
  const text = children || label;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      fontSize: '11px', fontWeight: 600, lineHeight: 1,
      padding: '3px 8px', borderRadius: RADIUS.sm,
      backgroundColor: v.bg, color: v.color, border: `1px solid ${v.border}`,
      whiteSpace: 'nowrap', letterSpacing: '0.02em',
      ...style,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: v.color, flexShrink: 0 }} />}
      {text}
    </span>
  );
}
