/**
 * DisasterMapAlertComponent.jsx
 * Standalone Emergency Alert Subsystem for Map Interfaces
 * Features:
 *  - Top Live Alert Bar with collision-free flex styling
 *  - Master Turn Off Alerts from Map / Turn On Alerts on Map
 *  - Collapsible Pill Badge
 *  - Dual-Tone Acoustic Siren Control
 *  - OASIS CAP 1.2 Briefing Drawer & XML Inspector
 *  - One-Click Zone Evacuation Broadcast Trigger
 */

import React, { useState } from 'react';
import { 
  BellRing, BellOff, Volume2, VolumeX, ShieldAlert, X, 
  ExternalLink, CheckCircle2, Zap 
} from 'lucide-react';
import sirenSynthesizer from './sirenAudioSynthesizer';

export default function DisasterMapAlertComponent({
  alerts = [],
  isAlertSystemMuted = false,
  isAlertBannerDismissed = false,
  isAlertsLayerActive = true,
  onTurnOffAlerts,
  onTurnOnAlerts,
  onDismissBanner,
  onShowBanner,
  onLocateAlert,
  onBroadcastZone,
  selectedScenarioId = 2,
  isDark = true,
  tokens = {
    bgPrimary: '#0f172a',
    bgSecondary: '#1e293b',
    bgTertiary: '#334155',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    border: '#334155',
    shadow: '0 4px 12px rgba(0,0,0,0.3)'
  }
}) {
  const [isAlertDrawerOpen, setIsAlertDrawerOpen] = useState(false);
  const [selectedCapAlert, setSelectedCapAlert] = useState(null);
  const [selectedCapXml, setSelectedCapXml] = useState('');
  const [capXmlLoading, setCapXmlLoading] = useState(false);
  const [sirenPlaying, setSirenPlaying] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [newAlertZoneId, setNewAlertZoneId] = useState('');

  // Handle Siren Toggle
  const handleToggleSiren = () => {
    const isNowPlaying = sirenSynthesizer.toggle();
    setSirenPlaying(isNowPlaying);
  };

  // Fetch CAP XML from backend
  const handleFetchCapXml = async (alertId) => {
    setCapXmlLoading(true);
    try {
      const res = await fetch(`http://localhost:8081/api/emergency/alerts/${alertId}/cap.xml`);
      if (res.ok) {
        const xml = await res.text();
        setSelectedCapXml(xml);
      }
    } catch (e) {
      console.error('Error fetching CAP XML:', e);
    } finally {
      setCapXmlLoading(false);
    }
  };

  return (
    <>
      {/* 1. Collapsed Pill Badge */}
      {isAlertBannerDismissed && (
        <button
          onClick={() => {
            if (!isAlertsLayerActive && onTurnOnAlerts) {
              onTurnOnAlerts();
            } else if (onShowBanner) {
              onShowBanner();
            }
          }}
          style={{
            position: 'absolute',
            top: '12px',
            left: '14px',
            zIndex: 999,
            backgroundColor: isAlertsLayerActive && alerts.length > 0 ? '#dc2626' : (isDark ? '#1e293b' : '#ffffff'),
            color: isAlertsLayerActive && alerts.length > 0 ? '#ffffff' : tokens.textPrimary,
            border: `1.5px solid ${isAlertsLayerActive && alerts.length > 0 ? '#ef4444' : tokens.border}`,
            borderRadius: '20px',
            padding: '5px 12px',
            fontSize: '11px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            backdropFilter: 'blur(6px)'
          }}
          title={isAlertsLayerActive ? 'Reopen Emergency Alert Banner' : 'Turn On Emergency Alerts on Map'}
        >
          {isAlertsLayerActive && alerts.length > 0 ? (
            <>
              <BellRing size={13} />
              <span>ALERTS ({alerts.length})</span>
              <span style={{ fontSize: '9px', opacity: 0.85, fontWeight: 600 }}>[SHOW]</span>
            </>
          ) : (
            <>
              <BellOff size={13} color="#94a3b8" />
              <span style={{ color: '#94a3b8' }}>ALERTS OFF ({alerts.length})</span>
              <span style={{ fontSize: '9px', color: '#10b981', fontWeight: 800 }}>[TURN ON]</span>
            </>
          )}
        </button>
      )}

      {/* 2. Top Active Alert Bar */}
      {!isAlertBannerDismissed && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '14px',
          maxWidth: 'calc(100% - 250px)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: isAlertsLayerActive && alerts.length > 0
            ? (isDark ? 'rgba(28, 10, 10, 0.95)' : 'rgba(254, 242, 242, 0.97)')
            : (isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.92)'),
          border: isAlertsLayerActive && alerts.length > 0 ? '1.5px solid #ef4444' : `1px solid ${tokens.border}`,
          boxShadow: isAlertsLayerActive && alerts.length > 0 ? '0 4px 20px rgba(239, 68, 68, 0.35)' : tokens.shadow,
          borderRadius: '8px',
          padding: '5px 12px',
          backdropFilter: 'blur(8px)',
          boxSizing: 'border-box'
        }}>
          {/* Beacon Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {isAlertsLayerActive && alerts.length > 0 ? (
              <>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#ef4444',
                  letterSpacing: '0.02em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <BellRing size={12} />
                  ALERT ACTIVE ({alerts.length})
                </span>
              </>
            ) : (
              <>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#64748b' }}></span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#94a3b8',
                  letterSpacing: '0.02em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <BellOff size={12} />
                  ALERTS OFF
                </span>
              </>
            )}
          </div>

          {/* Headline Snippet */}
          <div style={{
            flex: 1,
            fontSize: '11px',
            color: tokens.textPrimary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontWeight: 600,
            minWidth: 0
          }}>
            {isAlertsLayerActive && alerts.length > 0
              ? alerts[0].headline || 'Immediate evacuation order in effect for active critical hazard sectors'
              : `Alert layers cleared from map • ${alerts.length} CAP warnings standby in EOC`}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
            {alerts.length > 0 && (
              <>
                <button
                  onClick={() => {
                    setSelectedCapAlert(alerts[0]);
                    setIsAlertDrawerOpen(true);
                  }}
                  style={{
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>BRIEFING</span>
                  <span style={{ backgroundColor: '#b91c1c', padding: '1px 5px', borderRadius: '8px', fontSize: '9px' }}>{alerts.length}</span>
                </button>

                {isAlertsLayerActive && (
                  <button
                    onClick={handleToggleSiren}
                    style={{
                      backgroundColor: sirenPlaying ? '#b91c1c' : (isDark ? '#334155' : '#e2e8f0'),
                      color: sirenPlaying ? '#ffffff' : tokens.textPrimary,
                      border: 'none',
                      padding: '4px 7px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                    title={sirenPlaying ? 'Silence Siren' : 'Test Acoustic Siren'}
                  >
                    {sirenPlaying ? <VolumeX size={12} /> : <Volume2 size={12} />}
                    <span>{sirenPlaying ? 'SILENCE' : 'SIREN'}</span>
                  </button>
                )}
              </>
            )}

            {/* Turn Off / Turn On Button */}
            {isAlertsLayerActive ? (
              <button
                onClick={() => {
                  if (sirenPlaying) handleToggleSiren();
                  if (onTurnOffAlerts) onTurnOffAlerts();
                }}
                style={{
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.22)' : '#fee2e2',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
                title="Turn off emergency alerts and remove from the map"
              >
                <BellOff size={11} />
                <span>Turn Off</span>
              </button>
            ) : (
              <button
                onClick={onTurnOnAlerts}
                style={{
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
                title="Turn on emergency alerts and render on the map"
              >
                <BellRing size={11} />
                <span>Turn On</span>
              </button>
            )}

            {/* Dismiss Banner Button */}
            <button
              onClick={onDismissBanner}
              style={{
                backgroundColor: 'transparent',
                color: tokens.textSecondary,
                border: 'none',
                padding: '2px 4px',
                borderRadius: '3px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                lineHeight: 1
              }}
              title="Dismiss banner"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 3. Briefing Drawer Modal */}
      {isAlertDrawerOpen && (
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '14px',
          width: '420px',
          maxHeight: 'calc(100% - 24px)',
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)',
          border: `1.5px solid ${isDark ? '#ef4444' : '#f87171'}`,
          borderRadius: '10px',
          boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
          zIndex: 1100,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backdropFilter: 'blur(10px)'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: `1px solid ${tokens.border}`,
            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fee2e2'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} color="#ef4444" />
              <div>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#ef4444' }}>
                  OASIS CAP 1.2 Alert Center
                </h3>
                <span style={{ fontSize: '10px', color: tokens.textSecondary }}>
                  Common Alerting Protocol Broadcast Subsystem
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setIsAlertDrawerOpen(false);
                setSelectedCapXml('');
              }}
              style={{ background: 'transparent', border: 'none', color: tokens.textSecondary, cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Drawer Body */}
          <div style={{ padding: '14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Siren Control */}
            <div style={{
              backgroundColor: tokens.bgTertiary,
              padding: '10px',
              borderRadius: '6px',
              border: `1px solid ${tokens.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: tokens.textPrimary }}>
                  Acoustic Siren Array: {sirenPlaying ? '🔊 TRANSMITTING' : 'IDLE'}
                </div>
                <div style={{ fontSize: '9px', color: tokens.textSecondary }}>
                  Coverage: 115 dB Omni-Directional Alert Horns
                </div>
              </div>
              <button
                onClick={handleToggleSiren}
                style={{
                  backgroundColor: sirenPlaying ? '#b91c1c' : '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '5px 10px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {sirenPlaying ? 'STOP SIREN' : 'TEST SIREN'}
              </button>
            </div>

            {/* Master Map Alert Overlay Switch */}
            <div style={{
              backgroundColor: tokens.bgTertiary,
              padding: '10px',
              borderRadius: '6px',
              border: `1px solid ${tokens.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: tokens.textPrimary, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>Map Alert Overlays:</span>
                  <span style={{ color: isAlertsLayerActive ? '#ef4444' : '#94a3b8', fontWeight: 800 }}>
                    {isAlertsLayerActive ? '🔴 ACTIVE ON MAP' : '⚪ TURNED OFF (MUTED)'}
                  </span>
                </div>
                <div style={{ fontSize: '9px', color: tokens.textSecondary }}>
                  {isAlertsLayerActive ? 'Red hazard perimeters and siren badges rendered' : 'Alert polygons and badges removed from map view'}
                </div>
              </div>
              <button
                onClick={isAlertsLayerActive ? onTurnOffAlerts : onTurnOnAlerts}
                style={{
                  backgroundColor: isAlertsLayerActive ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2') : '#10b981',
                  color: isAlertsLayerActive ? '#ef4444' : '#ffffff',
                  border: isAlertsLayerActive ? '1px solid rgba(239, 68, 68, 0.4)' : 'none',
                  padding: '5px 10px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {isAlertsLayerActive ? <BellOff size={12} /> : <BellRing size={12} />}
                <span>{isAlertsLayerActive ? 'Turn Off from Map' : 'Turn On on Map'}</span>
              </button>
            </div>

            {/* Active Alerts List */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.textPrimary, textTransform: 'uppercase', marginBottom: '8px' }}>
                Active Broadcast Alerts ({alerts.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {alerts.map(a => (
                  <div
                    key={a.id}
                    style={{
                      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#f8fafc',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderLeft: '4px solid #ef4444',
                      borderRadius: '6px',
                      padding: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '8px', fontWeight: 800, backgroundColor: '#ef4444', color: '#fff', padding: '2px 5px', borderRadius: '3px' }}>
                        {a.severity} • {a.urgency}
                      </span>
                      <span style={{ fontSize: '9px', color: tokens.textSecondary, fontFamily: 'monospace' }}>
                        {a.identifier}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.textPrimary, margin: '4px 0 2px 0' }}>
                      {a.headline}
                    </div>
                    <div style={{ fontSize: '10px', color: tokens.textSecondary, marginBottom: '6px' }}>
                      {a.instruction || a.description}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {onLocateAlert && (
                        <button
                          onClick={() => onLocateAlert(a)}
                          style={{ flex: 1, backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '5px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          🎯 Locate on Map
                        </button>
                      )}
                      <button
                        onClick={() => handleFetchCapXml(a.id)}
                        disabled={capXmlLoading}
                        style={{ backgroundColor: isDark ? '#334155' : '#e2e8f0', color: tokens.textPrimary, border: 'none', padding: '5px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        📜 View CAP XML
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* XML Inspector */}
            {selectedCapXml && (
              <div style={{
                backgroundColor: isDark ? '#020617' : '#f1f5f9',
                border: `1px solid ${tokens.border}`,
                borderRadius: '6px',
                padding: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#38bdf8' }}>
                    OASIS Common Alerting Protocol (CAP) v1.2 XML
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedCapXml);
                    }}
                    style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Copy XML
                  </button>
                </div>
                <pre style={{
                  fontSize: '9px',
                  fontFamily: 'monospace',
                  color: isDark ? '#a5f3fc' : '#0369a1',
                  maxHeight: '140px',
                  overflowY: 'auto',
                  margin: 0
                }}>
                  {selectedCapXml}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
