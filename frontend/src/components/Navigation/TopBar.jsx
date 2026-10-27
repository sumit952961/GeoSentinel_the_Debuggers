/**
 * ============================================================
 * AIDRS — TopBar (Redesigned)
 * ============================================================
 * Professional command-center navigation bar.
 * Uses Lucide icons, Inter font, and design tokens.
 */
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BRANDING } from '../../config/branding';
import { useTheme } from '../../context/ThemeContext';
import Logo from '../brand/Logo';
import { TYPE, RADIUS, Z, SPACE } from '../../design-system/tokens';
import {
  Map, LayoutDashboard, FileBarChart, FlaskConical, Cpu,
  Activity, Sun, Moon, RefreshCw, Radio, ChevronRight,
  LocateFixed,
} from 'lucide-react';

const getNavItems = (scenarioId = 2) => [
  { to: `/scenario/${scenarioId}/map`,       label: 'Operations', icon: Map },
  { to: `/scenario/${scenarioId}/dashboard`, label: 'Dashboard',  icon: LayoutDashboard },
  { to: `/scenario/${scenarioId}/emergency`, label: 'Dispatch & CAD', icon: Radio },
  { to: '/scenarios',                        label: 'Scenarios',  icon: LocateFixed },
  { to: `/scenario/${scenarioId}/reports`,   label: 'Reports',    icon: FileBarChart },
  { to: '/research',                         label: 'Research',   icon: FlaskConical },
  { to: '/model-training',                   label: 'Model V4',   icon: Cpu },
  { to: '/system',                           label: 'System',     icon: Activity },
];

const TopBar = () => {
  const location = useLocation();
  const { toggleTheme, isDark, tokens } = useTheme();

  const match = location.pathname.match(/(?:\/scenario\/|\/map\/)(\d+)/);
  const activeScenarioId = match ? parseInt(match[1]) : 2;
  const activeScenario = BRANDING.scenarios.find(s => s.id === activeScenarioId) || BRANDING.scenarios[1];
  const navItems = getNavItems(activeScenarioId);

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 52,
      backgroundColor: isDark ? '#0c111d' : '#ffffff',
      borderBottom: `1px solid ${tokens.border}`,
      display: 'flex', alignItems: 'center',
      padding: `0 ${SPACE[5]}`,
      zIndex: Z.topbar,
      fontFamily: TYPE.fontFamily,
      transition: 'background-color 0.2s ease',
    }}>

      {/* ─── Brand ─── */}
      <NavLink to="/" style={{
        display: 'flex', alignItems: 'center', gap: SPACE[2],
        textDecoration: 'none', marginRight: SPACE[8], flexShrink: 0,
      }}>
        <Logo size={26} color={tokens.accent} />
        <span style={{
          fontSize: '16px', fontWeight: 700, color: tokens.text,
          letterSpacing: '-0.02em',
        }}>
          AIDRS
        </span>
        <span style={{
          fontSize: '11px', fontWeight: 500, color: tokens.textMuted,
          letterSpacing: '0.02em', marginLeft: '-2px',
          display: window.innerWidth < 900 ? 'none' : 'inline',
        }}>
          v2.0
        </span>
      </NavLink>

      {/* ─── Primary Nav ─── */}
      <nav style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        flex: 1, overflow: 'hidden',
      }}>
        {navItems.map(item => (
          <NavItem key={item.to} {...item} tokens={tokens} isDark={isDark} />
        ))}
      </nav>

      {/* ─── Right Side ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[2], flexShrink: 0 }}>
        {/* Active scenario pill */}
        {activeScenario && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: RADIUS.full,
            backgroundColor: tokens.accentSoft,
            border: `1px solid ${isDark ? 'rgba(59,130,246,0.25)' : 'rgba(37,99,235,0.15)'}`,
            fontSize: '12px', fontWeight: 600, color: tokens.accent,
            maxWidth: 240, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          }}>
            <Radio size={12} />
            {activeScenario.name}
          </div>
        )}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: RADIUS.md,
            border: `1px solid ${tokens.border}`,
            backgroundColor: 'transparent', color: tokens.textSec,
            transition: 'all 0.15s ease',
          }}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Refresh */}
        <button
          onClick={() => window.location.reload()}
          aria-label="Refresh data"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: RADIUS.md,
            border: `1px solid ${tokens.border}`,
            backgroundColor: 'transparent', color: tokens.textSec,
            transition: 'all 0.15s ease',
          }}
        >
          <RefreshCw size={14} />
        </button>
      </div>
    </header>
  );
};

/* ─── Individual Nav Item ─── */
function NavItem({ to, label, icon: Icon, tokens, isDark }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '6px 10px', borderRadius: RADIUS.md,
        fontSize: '13px', fontWeight: isActive ? 600 : 500,
        color: isActive ? tokens.accent : tokens.textSec,
        backgroundColor: isActive ? tokens.accentSoft : 'transparent',
        textDecoration: 'none',
        transition: 'all 0.12s ease',
        whiteSpace: 'nowrap',
      })}
    >
      {({ isActive }) => (
        <>
          <Icon size={15} strokeWidth={isActive ? 2.2 : 1.8} />
          {label}
        </>
      )}
    </NavLink>
  );
}

export default TopBar;
