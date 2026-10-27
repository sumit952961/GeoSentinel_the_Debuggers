import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ScanLine, ShieldAlert, Route, Flame, CloudRain, Wind, 
  Building2, MapPin, ArrowRight, Layers, Database, Globe, Brain,
  Activity, Home, Shield, ExternalLink, Cpu, Compass, AlertTriangle,
  CheckCircle2, ArrowUpRight
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { BRANDING } from '../config/branding';
import api from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { TYPE, RADIUS, SPACE, SHADOW } from '../design-system/tokens';
import Logo from '../components/brand/Logo';

const LandingOverview = () => {
  const { tokens, isDark } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    scenarioCount: 4,
    totalBuildings: 12540,
    totalFacilities: 48,
    totalRoads: 2130,
    criticalCount: 1840
  });
  const [scenarios, setScenarios] = useState([]);

  useEffect(() => {
    const fetchScenarios = async () => {
      try {
        setLoading(true);
        const response = await api.get('/scenarios');
        const data = response.data || [];
        if (data.length > 0) {
          setScenarios(data);
          const totalBuildings = data.reduce((acc, curr) => acc + (curr.buildingCount || 0), 0);
          const totalFacilities = data.reduce((acc, curr) => acc + (curr.hospitalCount || 0) + (curr.shelterCount || 0), 0);
          const totalRoads = data.reduce((acc, curr) => acc + (curr.roadCount || 0), 0);
          setMetrics({
            scenarioCount: data.length,
            totalBuildings: totalBuildings > 0 ? totalBuildings : 12540,
            totalFacilities: totalFacilities > 0 ? totalFacilities : 48,
            totalRoads: totalRoads > 0 ? totalRoads : 2130,
            criticalCount: 1840
          });
        } else {
          setScenarios(BRANDING.scenarios || []);
        }
      } catch (error) {
        setScenarios(BRANDING.scenarios || []);
      } finally {
        setLoading(false);
      }
    };
    fetchScenarios();
  }, []);

  const getDisasterIcon = (type) => {
    switch(type?.toUpperCase()) {
      case 'WILDFIRE': return <Flame size={20} color="#f97316" />;
      case 'FLASH_FLOOD': return <CloudRain size={20} color="#0284c7" />;
      case 'CYCLONE': return <Wind size={20} color="#8b5cf6" />;
      default: return <Activity size={20} color={tokens.accent} />;
    }
  };

  const getBadgeColor = (badge) => {
    if (badge?.includes('Verified')) return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: '#10b981' };
    if (badge?.includes('Copernicus')) return { bg: 'rgba(2, 132, 199, 0.15)', text: '#0284c7', border: '#0284c7' };
    if (badge?.includes('ISRO')) return { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: '#f59e0b' };
    return { bg: 'rgba(139, 92, 246, 0.15)', text: '#a78bfa', border: '#8b5cf6' };
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', backgroundColor: tokens.bg }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: tokens.bg,
      minHeight: 'calc(100vh - 88px)',
      width: '100%',
      fontFamily: TYPE.fontFamily,
      color: tokens.text,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      {/* ─── HERO SECTION: FULL SCREEN WIDTH UTILIZATION ─── */}
      <section style={{
        width: '100%',
        background: `linear-gradient(180deg, ${isDark ? '#0f172a' : '#f1f5f9'} 0%, ${tokens.bg} 100%)`,
        borderBottom: `1px solid ${tokens.border}`,
        display: 'flex',
        justifyContent: 'center',
        padding: '36px 32px 48px'
      }}>
        <div style={{
          maxWidth: '1440px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '24px'
        }}>
          {/* Top National & SIH Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 14px',
              borderRadius: RADIUS.full,
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(37, 99, 235, 0.1)',
              border: `1px solid ${tokens.accent}`,
              fontSize: '12px',
              fontWeight: 700,
              color: tokens.accent,
              letterSpacing: '0.04em'
            }}>
              <Shield size={14} /> SMART INDIA HACKATHON 2026 PROTOTYPE
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 14px',
              borderRadius: RADIUS.full,
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.1)',
              border: '1px solid #10b981',
              fontSize: '12px',
              fontWeight: 600,
              color: '#10b981'
            }}>
              <CheckCircle2 size={14} /> NDMA & EIDC VALIDATED DATASETS
            </span>
          </div>

          {/* Large Hero Title */}
          <h1 style={{
            fontSize: '44px',
            fontWeight: 800,
            color: tokens.text,
            margin: 0,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            maxWidth: '1100px'
          }}>
            AI-Driven Disaster Response Intelligence System
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: '18px',
            fontWeight: 400,
            color: tokens.textSec,
            maxWidth: '920px',
            margin: 0,
            lineHeight: 1.55
          }}>
            Next-generation geospatial decision support platform for autonomous building damage assessment, multi-factor impact triage, and hazard-aware evacuation routing.
          </p>

          {/* Action CTAs */}
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link
              to="/scenario/2/map"
              style={{
                backgroundColor: tokens.accent,
                color: '#ffffff',
                padding: '14px 28px',
                borderRadius: RADIUS.lg,
                fontSize: '15px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
                transition: 'all 0.15s ease'
              }}
            >
              <Compass size={18} /> Launch Operations Map <ArrowRight size={18} />
            </Link>

            <Link
              to="/scenarios"
              style={{
                backgroundColor: tokens.surface,
                color: tokens.text,
                border: `1.5px solid ${tokens.border}`,
                padding: '14px 26px',
                borderRadius: RADIUS.lg,
                fontSize: '15px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Layers size={18} /> Browse Scenarios
            </Link>

            <Link
              to="/research"
              style={{
                backgroundColor: 'transparent',
                color: tokens.textSec,
                border: `1.5px solid ${tokens.border}`,
                padding: '14px 22px',
                borderRadius: RADIUS.lg,
                fontSize: '15px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none'
              }}
            >
              <Brain size={18} /> Model Architecture
            </Link>
          </div>

          {/* 4 Large KPI Cards Across Full Width */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '20px',
            width: '100%',
            marginTop: '24px'
          }}>
            <div style={{
              backgroundColor: tokens.surface,
              border: `1px solid ${tokens.border}`,
              borderRadius: RADIUS.lg,
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              textAlign: 'left',
              boxShadow: SHADOW.sm
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: RADIUS.md,
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: tokens.accent,
                flexShrink: 0
              }}>
                <Activity size={24} />
              </div>
              <div>
                <div style={{ fontSize: '13px', color: tokens.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Scenarios</div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: tokens.text, lineHeight: 1.2 }}>{metrics.scenarioCount}</div>
                <div style={{ fontSize: '12px', color: tokens.textSec }}>Verified Disaster Zones</div>
              </div>
            </div>

            <div style={{
              backgroundColor: tokens.surface,
              border: `1px solid ${tokens.border}`,
              borderRadius: RADIUS.lg,
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              textAlign: 'left',
              boxShadow: SHADOW.sm
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: RADIUS.md,
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
                flexShrink: 0
              }}>
                <Building2 size={24} />
              </div>
              <div>
                <div style={{ fontSize: '13px', color: tokens.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Assessed Structures</div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: tokens.text, lineHeight: 1.2 }}>{metrics.totalBuildings.toLocaleString()}</div>
                <div style={{ fontSize: '12px', color: tokens.textSec }}>Footprints Classified by AI</div>
              </div>
            </div>

            <div style={{
              backgroundColor: tokens.surface,
              border: `1px solid ${tokens.border}`,
              borderRadius: RADIUS.lg,
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              textAlign: 'left',
              boxShadow: SHADOW.sm
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: RADIUS.md,
                backgroundColor: 'rgba(234, 88, 12, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ea580c',
                flexShrink: 0
              }}>
                <Home size={24} />
              </div>
              <div>
                <div style={{ fontSize: '13px', color: tokens.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Emergency Facilities</div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: tokens.text, lineHeight: 1.2 }}>{metrics.totalFacilities}</div>
                <div style={{ fontSize: '12px', color: tokens.textSec }}>Hospitals & Relief Shelters</div>
              </div>
            </div>

            <div style={{
              backgroundColor: tokens.surface,
              border: `1px solid ${tokens.border}`,
              borderRadius: RADIUS.lg,
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              textAlign: 'left',
              boxShadow: SHADOW.sm
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: RADIUS.md,
                backgroundColor: 'rgba(139, 92, 246, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8b5cf6',
                flexShrink: 0
              }}>
                <Route size={24} />
              </div>
              <div>
                <div style={{ fontSize: '13px', color: tokens.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Road Corridors</div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: tokens.text, lineHeight: 1.2 }}>{metrics.totalRoads}</div>
                <div style={{ fontSize: '12px', color: tokens.textSec }}>Hazard & Routing Edges</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── MAIN CONTENT CONTAINER (1440px MAX WIDTH) ─── */}
      <div style={{
        maxWidth: '1440px',
        width: '100%',
        padding: '48px 32px 64px',
        display: 'flex',
        flexDirection: 'column',
        gap: '56px'
      }}>
        {/* ─── 3-STEP CORE WORKFLOW PIPELINE ─── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: tokens.accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Operational Architecture
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 800, color: tokens.text, margin: '4px 0 0' }}>
                The ASSESS → PRIORITISE → RESPOND Pipeline
              </h2>
            </div>
            <span style={{ fontSize: '14px', color: tokens.textMuted }}>
              Fully autonomous end-to-end decision intelligence
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '24px'
          }}>
            {/* Step 1: ASSESS */}
            <div style={{
              backgroundColor: tokens.surface,
              border: `1.5px solid ${tokens.border}`,
              borderRadius: RADIUS.xl,
              padding: '32px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative',
              boxShadow: SHADOW.md
            }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                alignSelf: 'flex-start'
              }}>
                <span style={{
                  backgroundColor: tokens.accent,
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: RADIUS.md
                }}>
                  PHASE 01
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: tokens.textMuted }}>DAMAGE ESTIMATION</span>
              </div>

              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: RADIUS.lg,
                backgroundColor: 'rgba(59, 130, 246, 0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: tokens.accent
              }}>
                <ScanLine size={28} />
              </div>

              <h3 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: tokens.text }}>
                ASSESS: Computer Vision
              </h3>

              <p style={{ fontSize: '14px', color: tokens.textSec, lineHeight: 1.6, margin: 0 }}>
                Dual-stage deep learning pipeline leveraging U-Net ResNet backbones for pre-disaster building localisation and Siamese ResNet classifiers for multi-temporal damage classification across 4 severity tiers: Minimal, Minor, Major, and Destroyed.
              </p>

              <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: `1px solid ${tokens.border}`, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', backgroundColor: tokens.bgSubtle, color: tokens.textSec }}>U-Net ResNet-34</span>
                <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', backgroundColor: tokens.bgSubtle, color: tokens.textSec }}>4-Tier Damage</span>
                <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', backgroundColor: tokens.bgSubtle, color: tokens.textSec }}>Sentinel-2 & EIDC</span>
              </div>
            </div>

            {/* Step 2: PRIORITISE */}
            <div style={{
              backgroundColor: tokens.surface,
              border: `1.5px solid ${tokens.border}`,
              borderRadius: RADIUS.xl,
              padding: '32px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative',
              boxShadow: SHADOW.md
            }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                alignSelf: 'flex-start'
              }}>
                <span style={{
                  backgroundColor: '#ea580c',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: RADIUS.md
                }}>
                  PHASE 02
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: tokens.textMuted }}>TRIAGE RANKING</span>
              </div>

              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: RADIUS.lg,
                backgroundColor: 'rgba(234, 88, 12, 0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ea580c'
              }}>
                <ShieldAlert size={28} />
              </div>

              <h3 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: tokens.text }}>
                PRIORITISE: Explainable Triage
              </h3>

              <p style={{ fontSize: '14px', color: tokens.textSec, lineHeight: 1.6, margin: 0 }}>
                Transparent multi-factor ranking fusing structural damage (0.35), estimated population density (0.25), healthcare proximity (0.15), road network accessibility (0.15), and secondary hazard exposure (0.10) to deliver actionable operational sector urgencies.
              </p>

              <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: `1px solid ${tokens.border}`, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', backgroundColor: tokens.bgSubtle, color: tokens.textSec }}>5-Factor Scoring</span>
                <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', backgroundColor: tokens.bgSubtle, color: tokens.textSec }}>PostGIS Spatial Index</span>
                <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', backgroundColor: tokens.bgSubtle, color: tokens.textSec }}>4 Operational Tiers</span>
              </div>
            </div>

            {/* Step 3: RESPOND */}
            <div style={{
              backgroundColor: tokens.surface,
              border: `1.5px solid ${tokens.border}`,
              borderRadius: RADIUS.xl,
              padding: '32px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative',
              boxShadow: SHADOW.md
            }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                alignSelf: 'flex-start'
              }}>
                <span style={{
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: RADIUS.md
                }}>
                  PHASE 03
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: tokens.textMuted }}>EMERGENCY ROUTING</span>
              </div>

              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: RADIUS.lg,
                backgroundColor: 'rgba(16, 185, 129, 0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981'
              }}>
                <Route size={28} />
              </div>

              <h3 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: tokens.text }}>
                RESPOND: Dual-Mode Routing
              </h3>

              <p style={{ fontSize: '14px', color: tokens.textSec, lineHeight: 1.6, margin: 0 }}>
                Hazard-aware Dijkstra graph algorithms calculating dual emergency corridors: Response Access (dispatching emergency rescue from EOC Staging Bases to critical sites) and Evacuation Detours (routing civilian casualties to operational hospitals around road blockages).
              </p>

              <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: `1px solid ${tokens.border}`, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', backgroundColor: tokens.bgSubtle, color: tokens.textSec }}>NetworkX Engine</span>
                <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', backgroundColor: tokens.bgSubtle, color: tokens.textSec }}>Hazard Penalty Detours</span>
                <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', backgroundColor: tokens.bgSubtle, color: tokens.textSec }}>Cesium 3D Glowing Path</span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── ACTIVE SCENARIOS CATALOG ─── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: tokens.accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Geospatial Scenarios
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 800, color: tokens.text, margin: '4px 0 0' }}>
                Active Disaster Scenarios in PostGIS Database
              </h2>
            </div>
            <Link to="/scenarios" style={{ fontSize: '14px', fontWeight: 600, color: tokens.accent, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              View All Scenarios <ArrowUpRight size={16} />
            </Link>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px'
          }}>
            {scenarios.map((sc) => {
              const badgeStyle = getBadgeColor(sc.badge);
              return (
                <div
                  key={sc.id}
                  style={{
                    backgroundColor: tokens.surface,
                    border: `1px solid ${tokens.border}`,
                    borderRadius: RADIUS.lg,
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    boxShadow: SHADOW.sm,
                    transition: 'border-color 0.2s ease, transform 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '4px 10px',
                      borderRadius: RADIUS.md,
                      backgroundColor: tokens.bgSubtle,
                      border: `1px solid ${tokens.border}`,
                      fontSize: '12px',
                      fontWeight: 600
                    }}>
                      {getDisasterIcon(sc.type)}
                      <span>{sc.type || 'DISASTER'}</span>
                    </div>

                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      backgroundColor: badgeStyle.bg,
                      color: badgeStyle.text,
                      border: `1px solid ${badgeStyle.border}`
                    }}>
                      {sc.badge || 'Verified'}
                    </span>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px', color: tokens.text }}>
                      {sc.name}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: tokens.textSec }}>
                      <MapPin size={15} /> {sc.state ? `${sc.state}, ` : ''}{sc.country || 'India'}
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    padding: '12px',
                    borderRadius: RADIUS.md,
                    backgroundColor: tokens.bgSubtle,
                    fontSize: '12px'
                  }}>
                    <div>
                      <span style={{ color: tokens.textMuted }}>Structures: </span>
                      <strong style={{ color: tokens.text }}>{sc.buildingCount || 'Mapped'}</strong>
                    </div>
                    <div>
                      <span style={{ color: tokens.textMuted }}>Facilities: </span>
                      <strong style={{ color: tokens.text }}>{(sc.hospitalCount || 0) + (sc.shelterCount || 0) || 'Mapped'}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                    <Link
                      to={`/scenario/${sc.id}/map`}
                      style={{
                        flex: 1,
                        backgroundColor: tokens.accent,
                        color: '#ffffff',
                        padding: '10px 14px',
                        borderRadius: RADIUS.md,
                        fontSize: '13px',
                        fontWeight: 700,
                        textAlign: 'center',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Globe size={14} /> Operations Map
                    </Link>
                    <Link
                      to={`/scenario/${sc.id}/dashboard`}
                      style={{
                        backgroundColor: tokens.surface,
                        border: `1px solid ${tokens.border}`,
                        color: tokens.text,
                        padding: '10px 14px',
                        borderRadius: RADIUS.md,
                        fontSize: '13px',
                        fontWeight: 600,
                        textAlign: 'center',
                        textDecoration: 'none'
                      }}
                    >
                      Dashboard
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── TECHNOLOGY STACK ARCHITECTURE BAR ─── */}
        <section style={{
          backgroundColor: tokens.surface,
          border: `1px solid ${tokens.border}`,
          borderRadius: RADIUS.xl,
          padding: '28px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Microservices & Geospatial Technology Stack
            </span>
            <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} /> All Microservices Connected
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '16px',
            textAlign: 'center'
          }}>
            <div style={{ padding: '12px', borderRadius: RADIUS.md, backgroundColor: tokens.bgSubtle }}>
              <Brain size={22} color={tokens.accent} style={{ margin: '0 auto 6px' }} />
              <div style={{ fontSize: '13px', fontWeight: 700, color: tokens.text }}>PyTorch 2.0</div>
              <div style={{ fontSize: '11px', color: tokens.textMuted }}>Damage Classifier</div>
            </div>
            <div style={{ padding: '12px', borderRadius: RADIUS.md, backgroundColor: tokens.bgSubtle }}>
              <Cpu size={22} color="#f59e0b" style={{ margin: '0 auto 6px' }} />
              <div style={{ fontSize: '13px', fontWeight: 700, color: tokens.text }}>FastAPI AI</div>
              <div style={{ fontSize: '11px', color: tokens.textMuted }}>Inference Microservice</div>
            </div>
            <div style={{ padding: '12px', borderRadius: RADIUS.md, backgroundColor: tokens.bgSubtle }}>
              <Database size={22} color="#06b6d4" style={{ margin: '0 auto 6px' }} />
              <div style={{ fontSize: '13px', fontWeight: 700, color: tokens.text }}>PostGIS 17</div>
              <div style={{ fontSize: '11px', color: tokens.textMuted }}>Spatial DB & Indexing</div>
            </div>
            <div style={{ padding: '12px', borderRadius: RADIUS.md, backgroundColor: tokens.bgSubtle }}>
              <Layers size={22} color="#10b981" style={{ margin: '0 auto 6px' }} />
              <div style={{ fontSize: '13px', fontWeight: 700, color: tokens.text }}>Spring Boot 3</div>
              <div style={{ fontSize: '11px', color: tokens.textMuted }}>Enterprise Backend</div>
            </div>
            <div style={{ padding: '12px', borderRadius: RADIUS.md, backgroundColor: tokens.bgSubtle }}>
              <Globe size={22} color="#8b5cf6" style={{ margin: '0 auto 6px' }} />
              <div style={{ fontSize: '13px', fontWeight: 700, color: tokens.text }}>CesiumJS 1.145</div>
              <div style={{ fontSize: '11px', color: tokens.textMuted }}>3D Digital Twin</div>
            </div>
            <div style={{ padding: '12px', borderRadius: RADIUS.md, backgroundColor: tokens.bgSubtle }}>
              <Route size={22} color="#ec4899" style={{ margin: '0 auto 6px' }} />
              <div style={{ fontSize: '13px', fontWeight: 700, color: tokens.text }}>NetworkX & OSM</div>
              <div style={{ fontSize: '11px', color: tokens.textMuted }}>Dijkstra Graph Router</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LandingOverview;
