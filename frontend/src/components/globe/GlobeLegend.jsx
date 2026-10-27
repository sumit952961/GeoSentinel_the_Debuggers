import React, { useState } from 'react';
import {
  Map as MapIcon,
  ChevronDown,
  ChevronUp,
  Hospital,
  Home,
  ShieldAlert,
  AlertTriangle,
  Info
} from 'lucide-react';
import { DAMAGE_COLORS, PRIORITY_COLORS } from '../../services/map/cesiumAdapter';
import { TYPE } from '../../design-system/tokens';

/**
 * AIDRS — Collapsible 3D Operations Legend HUD
 * Clean enterprise legend with zero emojis and Inter typography.
 */
export default function GlobeLegend({ mapMode = 'DAMAGE', selectedScenarioId = 1, isDark = true, tokens = {} }) {
  const [collapsed, setCollapsed] = useState(false);
  const fontFam = TYPE?.fontFamily || "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '20px',
      zIndex: 1000,
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)',
      border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
      borderRadius: '8px',
      padding: collapsed ? '8px 12px' : '12px 16px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      backdropFilter: 'blur(8px)',
      color: isDark ? '#f8fafc' : '#0f172a',
      fontSize: '12px',
      fontFamily: fontFam,
      minWidth: collapsed ? 'auto' : '250px',
      transition: 'all 0.2s ease'
    }}>
      {/* Legend Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          borderBottom: collapsed ? 'none' : `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          paddingBottom: collapsed ? '0' : '6px',
          marginBottom: collapsed ? '0' : '8px',
          fontSize: '13px'
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MapIcon size={14} color="#0284c7" /> 3D Operations Legend
        </span>
        <span style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', display: 'flex', alignItems: 'center' }}>
          {collapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </div>

      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Active Phase Banner */}
          <div style={{
            fontSize: '11px',
            fontWeight: 800,
            color: '#0284c7',
            backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : 'rgba(2, 132, 199, 0.1)',
            padding: '4px 8px',
            borderRadius: '4px'
          }}>
            PHASE: {mapMode === 'DAMAGE' ? '01 ASSESS (DAMAGE TIERS)' : (mapMode === 'PRIORITY' ? '02 PRIORITISE (TRIAGE URGENCY)' : '03 RESPOND (DUAL ROUTING)')}
          </div>

          {/* Damage Tiers */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>
              3D Extruded Buildings
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: DAMAGE_COLORS['no-damage'], borderRadius: '2px' }} />
                <span>No Damage</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: DAMAGE_COLORS['minor-damage'], borderRadius: '2px' }} />
                <span>Minor</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: DAMAGE_COLORS['major-damage'], borderRadius: '2px' }} />
                <span>Major</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: DAMAGE_COLORS['destroyed'], borderRadius: '2px' }} />
                <span>Destroyed</span>
              </div>
            </div>
          </div>

          {/* Priority Levels */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>
              Triage Urgency Tiers
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: PRIORITY_COLORS['CRITICAL'], borderRadius: '2px' }} />
                <span style={{ fontWeight: 700, color: '#ef4444' }}>Critical (≥70%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: PRIORITY_COLORS['HIGH'], borderRadius: '2px' }} />
                <span>High (50-69%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: PRIORITY_COLORS['MEDIUM'], borderRadius: '2px' }} />
                <span>Medium</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: PRIORITY_COLORS['LOW'], borderRadius: '2px' }} />
                <span>Low</span>
              </div>
            </div>
          </div>

          {/* Infrastructure & Routing */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }}>
              Infrastructure & Corridors
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Hospital size={12} color="#10b981" />
                <span>Emergency Hospital</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Home size={12} color="#0284c7" />
                <span>Relief Shelter</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '14px', height: '3px', backgroundColor: '#a855f7', border: '1px dashed #7e22ce' }} />
                <span style={{ color: '#a855f7', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldAlert size={12} /> Blocked Road
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '14px', height: '4px', backgroundColor: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }} />
                <span>Response Route (Staging → Site)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '14px', height: '4px', backgroundColor: '#0284c7', boxShadow: '0 0 6px #0284c7' }} />
                <span>Evacuation Route (Site → Hospital)</span>
              </div>
            </div>
          </div>

          {/* Scenario Specific Protocol Note */}
          <div style={{
            fontSize: '9px',
            color: isDark ? '#94a3b8' : '#64748b',
            borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            paddingTop: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <Info size={11} color="#0284c7" style={{ flexShrink: 0 }} />
            <span>
              {selectedScenarioId === 1 && 'WOOLSEY FIRE: Historical Demonstration Scenario (California, USA)'}
              {selectedScenarioId === 2 && 'CHAMOLI 2021: NERC EIDC Native Binary Footprints'}
              {selectedScenarioId === 3 && 'CYCLONE FANI: Copernicus EMSR357 Point Damage Survey'}
              {selectedScenarioId === 4 && 'DHARALI 2025: Qualitative Zero-Shot 20.4 ha Debris Fan'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
