/**
 * AIDRS — KPI Metric Card
 */
import React from 'react';
import { RADIUS, SPACE } from '../../design-system/tokens';
import { useTheme } from '../../context/ThemeContext';

export default function MetricCard({ label, title, value, sub, icon: Icon, accentColor, style = {} }) {
  const { tokens, isDark } = useTheme();
  const accent = accentColor || tokens.accent;
  const displayLabel = label || title;

  return (
    <div style={{
      backgroundColor: tokens.surface,
      border: `1px solid ${tokens.border}`,
      borderRadius: RADIUS.lg,
      padding: SPACE[4],
      display: 'flex', alignItems: 'flex-start', gap: SPACE[3],
      transition: 'border-color 0.15s ease',
      ...style,
    }}>
      {Icon && (
        <div style={{
          width: 36, height: 36, borderRadius: RADIUS.md,
          backgroundColor: isDark ? `${accent}18` : `${accent}12`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {React.isValidElement(Icon) ? Icon : <Icon size={18} color={accent} strokeWidth={2} />}
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: '11px', fontWeight: 600, color: tokens.textMuted,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          marginBottom: '2px', lineHeight: 1.2,
        }}>
          {displayLabel}
        </div>
        <div style={{
          fontSize: '24px', fontWeight: 700, color: tokens.text,
          lineHeight: 1.15, letterSpacing: '-0.02em',
        }}>
          {value}
        </div>
        {sub && (
          <div style={{
            fontSize: '12px', color: tokens.textMuted,
            marginTop: '2px', lineHeight: 1.3,
          }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}
