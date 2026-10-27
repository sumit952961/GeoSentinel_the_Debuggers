/**
 * AIDRS — Breadcrumb (Redesigned)
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BRANDING } from '../../config/branding';
import { useTheme } from '../../context/ThemeContext';
import { TYPE, Z, SPACE, RADIUS } from '../../design-system/tokens';
import { ChevronRight, Home } from 'lucide-react';

const ROUTE_LABELS = {
  scenarios: 'Scenarios',
  map: 'Operations Map',
  dashboard: 'Dashboard',
  reports: 'Reports',
  research: 'Research',
  system: 'System Status',
  'model-training': 'Model V4',
  'scenario-data': 'Scenario Data',
};

export default function Breadcrumb() {
  const location = useLocation();
  const { tokens, isDark } = useTheme();
  const parts = location.pathname.split('/').filter(Boolean);

  // Don't show breadcrumb on landing
  if (parts.length === 0) return null;

  const crumbs = [{ label: 'Home', path: '/' }];

  let pathAccum = '';
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    pathAccum += '/' + seg;

    if (seg === 'scenario') {
      // next segment is the scenario ID
      const sid = parts[i + 1];
      if (sid) {
        const sc = BRANDING.scenarios.find(s => s.id === parseInt(sid));
        crumbs.push({ label: sc ? sc.name : `Scenario ${sid}`, path: `/scenario/${sid}/map` });
        i++; // skip the ID segment
      }
      continue;
    }

    const label = ROUTE_LABELS[seg] || seg;
    crumbs.push({ label, path: pathAccum });
  }

  return (
    <nav aria-label="Breadcrumb" style={{
      position: 'fixed', top: 52, left: 0, right: 0, height: 36,
      backgroundColor: isDark ? '#0e1422' : '#f9fafb',
      borderBottom: `1px solid ${tokens.border}`,
      display: 'flex', alignItems: 'center',
      padding: `0 ${SPACE[5]}`,
      zIndex: Z.topbar - 1,
      fontFamily: TYPE.fontFamily,
      transition: 'background-color 0.2s ease',
    }}>
      {crumbs.map((crumb, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight size={12} color={tokens.textMuted} style={{ margin: '0 4px', flexShrink: 0 }} />}
          {i === crumbs.length - 1 ? (
            <span style={{
              fontSize: '12px', fontWeight: 600, color: tokens.text,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {i === 0 ? <Home size={13} style={{ verticalAlign: '-2px' }} /> : crumb.label}
            </span>
          ) : (
            <Link to={crumb.path} style={{
              fontSize: '12px', fontWeight: 500, color: tokens.textMuted,
              textDecoration: 'none', whiteSpace: 'nowrap',
              transition: 'color 0.12s',
            }}>
              {i === 0 ? <Home size={13} style={{ verticalAlign: '-2px' }} /> : crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
