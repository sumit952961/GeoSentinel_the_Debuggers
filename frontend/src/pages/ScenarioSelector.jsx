/**
 * AIDRS — ScenarioSelector Page
 * Displays verified disaster scenarios with data quality badges and direct operations launch.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, CloudRain, Wind, MapPin, ArrowRight, ShieldCheck, Activity } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { BRANDING } from '../config/branding';
import StatusBadge from '../components/common/StatusBadge';
import { TYPE, RADIUS, SPACE } from '../design-system/tokens';

const getQualityVariant = (badge) => {
  switch (badge) {
    case 'Verified EIDC Data': return 'success';
    case 'Copernicus EMSR357': return 'info';
    case 'ISRO Debris Overlay': return 'warning';
    case 'Demo Baseline': return 'neutral';
    default: return 'info';
  }
};

const getDisasterIcon = (type, color) => {
  switch (type?.toUpperCase()) {
    case 'WILDFIRE': return <Flame size={24} color={color} />;
    case 'FLASH_FLOOD': return <CloudRain size={24} color={color} />;
    case 'CYCLONE': return <Wind size={24} color={color} />;
    default: return <Activity size={24} color={color} />;
  }
};

const getDisasterColor = (type) => {
  switch (type?.toUpperCase()) {
    case 'WILDFIRE': return '#dc2626';
    case 'FLASH_FLOOD': return '#0284c7';
    case 'CYCLONE': return '#7c3aed';
    default: return '#059669';
  }
};

const getDisasterLabel = (type) => {
  switch (type?.toUpperCase()) {
    case 'WILDFIRE': return 'Wildfire';
    case 'FLASH_FLOOD': return 'Flash Flood';
    case 'CYCLONE': return 'Cyclone';
    default: return 'Rapid-Onset Disaster';
  }
};

const ScenarioCard = ({ scenario }) => {
  const { tokens, isDark } = useTheme();
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const iconColor = getDisasterColor(scenario.type);

  return (
    <div
      style={{
        backgroundColor: tokens.surface,
        border: `1px solid ${isHovered ? tokens.accent : tokens.border}`,
        borderRadius: RADIUS.xl,
        padding: '24px',
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        transform: isHovered ? 'translateY(-2px)' : 'none',
        boxShadow: isHovered ? '0 10px 25px -5px rgba(0, 0, 0, 0.2)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => navigate(`/scenario/${scenario.id}/map`)}
    >
      {/* Card Header: Icon + Quality Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '46px',
          height: '46px',
          borderRadius: RADIUS.md,
          backgroundColor: isDark ? `${iconColor}22` : `${iconColor}14`,
        }}>
          {getDisasterIcon(scenario.type, iconColor)}
        </div>
        <StatusBadge
          label={scenario.badge}
          variant={getQualityVariant(scenario.badge)}
          dot={true}
        />
      </div>

      {/* Title & Location */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h3 style={{
          margin: 0,
          fontFamily: TYPE.fontFamily,
          fontSize: '18px',
          fontWeight: 700,
          color: tokens.text,
          letterSpacing: '-0.01em'
        }}>
          {scenario.name}
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: tokens.textSec, fontSize: '13px' }}>
          <MapPin size={13} color={tokens.textMuted} />
          <span>
            {scenario.state ? `${scenario.state}, ` : ''}{scenario.country || 'India'}
          </span>
        </div>
      </div>

      {/* Metadata Pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          fontFamily: TYPE.fontFamily,
          fontSize: '11px',
          fontWeight: 600,
          color: iconColor,
          backgroundColor: isDark ? `${iconColor}18` : `${iconColor}10`,
          border: `1px solid ${iconColor}30`,
          padding: '2px 8px',
          borderRadius: RADIUS.sm
        }}>
          {getDisasterLabel(scenario.type)}
        </span>
        <span style={{ fontSize: '11px', color: tokens.textMuted }}>
          Scenario #{scenario.id}
        </span>
      </div>

      {/* Launch CTA */}
      <button
        style={{
          backgroundColor: tokens.accent,
          color: '#ffffff',
          border: 'none',
          borderRadius: RADIUS.md,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          width: '100%',
          fontFamily: TYPE.fontFamily,
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          marginTop: 'auto',
          transition: 'all 0.15s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/scenario/${scenario.id}/map`);
        }}
      >
        Launch Operations <ArrowRight size={15} />
      </button>
    </div>
  );
};

const ScenarioSelector = () => {
  const { tokens } = useTheme();
  const scenarios = BRANDING.scenarios || [];

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '48px 32px',
      minHeight: 'calc(100vh - 88px)',
      fontFamily: TYPE.fontFamily,
      backgroundColor: tokens.bg,
      color: tokens.text
    }}>
      {/* Page Header */}
      <div style={{ marginBottom: '36px' }}>
        <h1 style={{
          margin: '0 0 8px 0',
          fontFamily: TYPE.fontFamily,
          fontSize: '32px',
          fontWeight: 700,
          color: tokens.text,
          letterSpacing: '-0.02em'
        }}>
          Disaster Scenarios
        </h1>
        <p style={{
          margin: 0,
          fontFamily: TYPE.fontFamily,
          fontSize: '15px',
          color: tokens.textSec,
          maxWidth: '650px',
          lineHeight: 1.5
        }}>
          Select an active disaster scenario to begin damage assessment, triage prioritization, and emergency route planning.
        </p>
      </div>

      {/* 2-Column Responsive Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: '24px'
      }}>
        {scenarios.map((scenario) => (
          <ScenarioCard key={scenario.id} scenario={scenario} />
        ))}
      </div>
    </div>
  );
};

export default ScenarioSelector;
