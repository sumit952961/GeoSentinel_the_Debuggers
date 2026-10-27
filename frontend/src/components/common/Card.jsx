/**
 * AIDRS — Reusable Card Component
 */
import React from 'react';
import { RADIUS, SHADOW, SPACE } from '../../design-system/tokens';
import { useTheme } from '../../context/ThemeContext';

export default function Card({ children, padding = SPACE[4], radius = RADIUS.lg, shadow = true, border = true, style = {}, onClick, className = '' }) {
  const { tokens } = useTheme();
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        backgroundColor: tokens.surface,
        border: border ? `1px solid ${tokens.border}` : 'none',
        borderRadius: radius,
        padding,
        boxShadow: shadow ? tokens.shadow : 'none',
        transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, style = {} }) {
  const { tokens } = useTheme();
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      paddingBottom: SPACE[3], marginBottom: SPACE[3],
      borderBottom: `1px solid ${tokens.border}`,
      ...style,
    }}>
      {children}
    </div>
  );
}

export function CardTitle({ children, style = {} }) {
  const { tokens } = useTheme();
  return (
    <h3 style={{
      fontSize: '15px', fontWeight: 600, color: tokens.text, margin: 0,
      letterSpacing: '-0.01em', lineHeight: 1.3,
      ...style,
    }}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, style = {} }) {
  const { tokens } = useTheme();
  return (
    <p style={{
      fontSize: '13px', color: tokens.textSec, margin: 0, lineHeight: 1.5,
      ...style,
    }}>
      {children}
    </p>
  );
}
