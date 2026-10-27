import React from 'react';
import {
  Map as MapIcon,
  Globe,
  AlertTriangle,
  Mountain,
  Sun,
  Moon,
  Clock,
  Compass,
  Maximize2,
  RotateCw,
  Target,
  Home,
  Tv,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { TYPE } from '../../design-system/tokens';

/**
 * AIDRS — Cesium 3D HUD & Map Controls
 * Industry-grade controls: 2D/3D switcher, Base Map, 3D Terrain, Day/Night Lighting, Camera Tools & Presentation Mode.
 */
export default function CesiumControls({
  mapViewMode = '3D',
  setMapViewMode,
  baseMap = 'SATELLITE',
  setBaseMap,
  enableTerrain = true,
  setEnableTerrain,
  lightingMode = 'DAY',
  setLightingMode,
  activeRoute = null,
  onResetNorth,
  onToggleTilt,
  onToggleOrbit,
  isOrbiting = false,
  onFocusRoute,
  onResetHome,
  onZoomIn,
  onZoomOut,
  presentationMode = false,
  setPresentationMode,
  selectedScenarioId = 1,
  mapMode = 'DAMAGE',
  setMapMode,
  isDark = true
}) {
  const fontFam = TYPE?.fontFamily || "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  return (
    <>
      {/* 1. TOP-CENTER NAVIGATION BAR: 2D / 3D SWITCHER & HISTORICAL DEMO BADGE */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontFamily: fontFam
      }}>
        {/* 2D / 3D Toggle */}
        <div style={{
          display: 'flex',
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
          border: `1.5px solid ${isDark ? '#334155' : '#cbd5e1'}`,
          borderRadius: '24px',
          padding: '3px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(8px)'
        }}>
          <button
            onClick={() => setMapViewMode('2D')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: mapViewMode === '2D' ? '#0284c7' : 'transparent',
              color: mapViewMode === '2D' ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              fontFamily: fontFam
            }}
          >
            <MapIcon size={13} /> 2D MAP
          </button>
          <button
            onClick={() => setMapViewMode('3D')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: mapViewMode === '3D' ? '#0284c7' : 'transparent',
              color: mapViewMode === '3D' ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              fontFamily: fontFam
            }}
          >
            <Globe size={13} /> 3D EARTH
          </button>
        </div>

        {/* Historical Demonstration Warning Badge for Woolsey */}
        {selectedScenarioId === 1 && (
          <div style={{
            backgroundColor: isDark ? 'rgba(180, 83, 9, 0.25)' : 'rgba(254, 243, 199, 0.9)',
            border: `1px solid ${isDark ? '#d97706' : '#f59e0b'}`,
            color: isDark ? '#fbbf24' : '#b45309',
            padding: '5px 12px',
            borderRadius: '20px',
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '0.04em',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: fontFam
          }}>
            <AlertTriangle size={12} color={isDark ? '#fbbf24' : '#b45309'} /> HISTORICAL DEMONSTRATION SCENARIO
          </div>
        )}
      </div>

      {/* 2. TOP-RIGHT ENVIRONMENT & CAMERA TOOLBAR HUD */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '8px',
        fontFamily: fontFam
      }}>
        {/* Environment Control Pill (BaseMap, Terrain, Lighting) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.96)',
          border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
          borderRadius: '8px',
          padding: '4px 10px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          backdropFilter: 'blur(6px)',
          fontSize: '11px',
          fontFamily: fontFam
        }}>
          {/* Base Map Selector */}
          <select
            value={baseMap}
            onChange={(e) => setBaseMap(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: isDark ? '#f8fafc' : '#0f172a',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              outline: 'none',
              fontFamily: fontFam
            }}
          >
            <option value="SATELLITE" style={{ color: '#000' }}>Satellite</option>
            <option value="STANDARD" style={{ color: '#000' }}>Standard</option>
            <option value="DARK" style={{ color: '#000' }}>Dark Matter</option>
          </select>

          <span style={{ color: isDark ? '#475569' : '#cbd5e1' }}>|</span>

          {/* Terrain Toggle */}
          <button
            onClick={() => setEnableTerrain(!enableTerrain)}
            style={{
              border: 'none',
              background: enableTerrain ? (isDark ? 'rgba(2, 132, 199, 0.25)' : 'rgba(2, 132, 199, 0.12)') : 'transparent',
              color: enableTerrain ? '#0284c7' : (isDark ? '#94a3b8' : '#64748b'),
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontFamily: fontFam
            }}
            title="Toggle 3D Elevation Terrain"
          >
            <Mountain size={12} /> Terrain: {enableTerrain ? 'ON' : 'OFF'}
          </button>

          <span style={{ color: isDark ? '#475569' : '#cbd5e1' }}>|</span>

          {/* Earth Lighting Mode */}
          <button
            onClick={() => {
              const next = lightingMode === 'DAY' ? 'NIGHT' : (lightingMode === 'NIGHT' ? 'AUTO' : 'DAY');
              setLightingMode(next);
            }}
            style={{
              border: 'none',
              background: 'transparent',
              color: isDark ? '#f8fafc' : '#0f172a',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontFamily: fontFam
            }}
            title="Cycle Earth Lighting (Day / Night / Auto)"
          >
            {lightingMode === 'DAY' && <><Sun size={12} color="#f59e0b" /> Day</>}
            {lightingMode === 'NIGHT' && <><Moon size={12} color="#38bdf8" /> Night</>}
            {lightingMode === 'AUTO' && <><Clock size={12} color="#94a3b8" /> Auto</>}
          </button>
        </div>

        {/* Camera Quick-Tool Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '4px',
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.96)',
          border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
          borderRadius: '8px',
          padding: '4px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          backdropFilter: 'blur(6px)',
          fontFamily: fontFam
        }}>
          {/* Compass / Reset North */}
          <button
            onClick={onResetNorth}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '5px 8px',
              borderRadius: '4px',
              color: isDark ? '#f8fafc' : '#0f172a',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: fontFam
            }}
            title="Reset Compass to North"
          >
            <Compass size={12} /> North
          </button>

          {/* Tilt Perspective */}
          <button
            onClick={onToggleTilt}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '5px 8px',
              borderRadius: '4px',
              color: isDark ? '#f8fafc' : '#0f172a',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: fontFam
            }}
            title="Toggle 2.5D / 3D Tilt Angle"
          >
            <Maximize2 size={12} /> Tilt
          </button>

          {/* Continuous Orbit */}
          <button
            onClick={onToggleOrbit}
            style={{
              background: isOrbiting ? '#f59e0b' : 'transparent',
              color: isOrbiting ? '#000000' : (isDark ? '#f8fafc' : '#0f172a'),
              border: 'none',
              padding: '5px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: fontFam
            }}
            title="Start/Stop Continuous Orbit"
          >
            <RotateCw size={12} /> Orbit
          </button>

          {/* Focus Route (active only when route exists) */}
          {activeRoute && (
            <button
              onClick={onFocusRoute}
              style={{
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '5px 9px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 700,
                boxShadow: '0 0 8px rgba(2, 132, 199, 0.5)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontFamily: fontFam
              }}
              title="Fit Entire 3D Route Corridor into View"
            >
              <Target size={12} /> Focus Route
            </button>
          )}

          {/* Zoom In */}
          <button
            onClick={onZoomIn}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '5px 8px',
              borderRadius: '4px',
              color: isDark ? '#f8fafc' : '#0f172a',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: fontFam
            }}
            title="Zoom In towards target (+)"
          >
            <ZoomIn size={13} /> Zoom +
          </button>

          {/* Zoom Out */}
          <button
            onClick={onZoomOut}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '5px 8px',
              borderRadius: '4px',
              color: isDark ? '#f8fafc' : '#0f172a',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: fontFam
            }}
            title="Zoom Out away from target (-)"
          >
            <ZoomOut size={13} /> Zoom -
          </button>

          {/* Home / Scenario Reset */}
          <button
            onClick={onResetHome}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '5px 8px',
              borderRadius: '4px',
              color: isDark ? '#f8fafc' : '#0f172a',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: fontFam
            }}
            title="Reset to Incident Epicenter"
          >
            <Home size={12} /> Home
          </button>

          {/* Presentation Mode Toggle */}
          <button
            onClick={() => setPresentationMode(!presentationMode)}
            style={{
              background: presentationMode ? '#10b981' : 'transparent',
              color: presentationMode ? '#ffffff' : (isDark ? '#f8fafc' : '#0f172a'),
              border: 'none',
              padding: '5px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: fontFam
            }}
            title="Toggle Clean Faculty Presentation Mode"
          >
            <Tv size={12} /> Demo
          </button>
        </div>

        {/* 3. DEMO WALKTHROUGH CONTROLS (WHEN PRESENTATION MODE IS ACTIVE) */}
        {presentationMode && (
          <div style={{
            display: 'flex',
            gap: '4px',
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
            border: `1.5px solid ${isDark ? '#10b981' : '#059669'}`,
            borderRadius: '8px',
            padding: '4px 6px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(8px)',
            fontFamily: fontFam
          }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#10b981', alignSelf: 'center', padding: '0 4px' }}>
              WALKTHROUGH:
            </span>
            <button
              onClick={() => setMapMode('DAMAGE')}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: mapMode === 'DAMAGE' ? '#0f172a' : 'transparent',
                color: mapMode === 'DAMAGE' ? '#38bdf8' : (isDark ? '#94a3b8' : '#64748b'),
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: fontFam
              }}
            >
              01 ASSESS
            </button>
            <button
              onClick={() => setMapMode('PRIORITY')}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: mapMode === 'PRIORITY' ? '#0f172a' : 'transparent',
                color: mapMode === 'PRIORITY' ? '#f59e0b' : (isDark ? '#94a3b8' : '#64748b'),
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: fontFam
              }}
            >
              02 PRIORITISE
            </button>
            <button
              onClick={() => setMapMode('ROUTING')}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: mapMode === 'ROUTING' ? '#0f172a' : 'transparent',
                color: mapMode === 'ROUTING' ? '#10b981' : (isDark ? '#94a3b8' : '#64748b'),
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: fontFam
              }}
            >
              03 RESPOND
            </button>
          </div>
        )}
      </div>
    </>
  );
}
