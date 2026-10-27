/**
 * ============================================================
 * AIDRS — Theme Context (Redesigned)
 * ============================================================
 * Provides dark/light theme tokens to the entire application.
 * All surface colors, text colors, and semantic tokens are
 * centralized here and consumed via useTheme().
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { DARK, LIGHT, TYPE, SHADOW, RADIUS, SPACE, TRANSITION } from '../design-system/tokens';

const buildTokens = (mode) => {
  const palette = mode === 'dark' ? DARK : LIGHT;
  return {
    name: mode,
    // Surfaces
    bg:          palette.bg,
    bgSubtle:    palette.bgSubtle,
    surface:     palette.surface,
    surfaceHov:  palette.surfaceHov,
    elevated:    palette.elevated,
    // Borders
    border:      palette.border,
    borderLight: palette.borderLight,
    // Text
    text:        palette.text,
    textSec:     palette.textSec,
    textMuted:   palette.textMuted,
    // Accent
    accent:      palette.accent,
    accentHov:   palette.accentHov,
    accentSoft:  palette.accentSoft,
    // Panel / overlay
    panelBg:     mode === 'dark' ? 'rgba(12, 17, 29, 0.97)' : 'rgba(255, 255, 255, 0.98)',
    mapOverlay:  mode === 'dark' ? 'rgba(26, 34, 54, 0.96)' : 'rgba(255, 255, 255, 0.97)',
    // Table
    tableHeader: mode === 'dark' ? '#131a2b' : '#f1f5f9',
    tableRowAlt: mode === 'dark' ? '#111827' : '#f9fafb',
    tableRowHov: mode === 'dark' ? '#1a2236' : '#f3f4f6',
    // Input
    inputBg:     mode === 'dark' ? '#131a2b' : '#ffffff',
    inputBorder: mode === 'dark' ? '#2a3550' : '#d1d5db',
    // Shadow
    shadow:      mode === 'dark' ? SHADOW.lg.replace(/0\.08/g, '0.2').replace(/0\.04/g, '0.1') : SHADOW.lg,
    // Legacy compat aliases (so existing code doesn't break immediately)
    bgPrimary:   palette.bg,
    bgSecondary: palette.bgSubtle,
    bgTertiary:  palette.surface,
    bgCard:      palette.surface,
    bgCardHover: palette.surfaceHov,
    textPrimary: palette.text,
    textSecondary: palette.textSec,
  };
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('aidrs_theme');
      return saved === 'light' ? 'light' : 'dark';
    } catch { return 'dark'; }
  });

  useEffect(() => {
    try { localStorage.setItem('aidrs_theme', theme); } catch {}
    document.documentElement.setAttribute('data-theme', theme);
    const t = buildTokens(theme);
    if (document.body) {
      document.body.style.backgroundColor = t.bg;
      document.body.style.color = t.text;
    }
  }, [theme]);

  const toggleTheme = () => setTheme(p => p === 'dark' ? 'light' : 'dark');
  const tokens = buildTokens(theme);
  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark, tokens }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: 'dark', setTheme: () => {}, toggleTheme: () => {},
      isDark: true, tokens: buildTokens('dark')
    };
  }
  return context;
};

// Re-export THEME_TOKENS for legacy compat
export const THEME_TOKENS = {
  dark: buildTokens('dark'),
  light: buildTokens('light'),
};

export default ThemeContext;
