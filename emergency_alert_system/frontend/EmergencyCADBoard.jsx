/**
 * ============================================================
 * AIDRS — EmergencyCADBoard (Computer Aided Dispatch & Alert Center)
 * ============================================================
 * Full FEMA/ICS & OASIS CAP 1.2 compliant First Responder Command Deck.
 * - Dynamic CAP 1.2 XML & JSON Broadcast creation
 * - Zone-based automatic evacuation order trigger
 * - Computer Aided Dispatch (CAD) Incident Queue
 * - Real-Time Response Unit Live Telemetry & Allocation
 * - Siren Audio Tone Synthesizer
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, ShieldAlert, Radio, Send, BellRing, CheckCircle, 
  Clock, MapPin, Truck, Flame, Activity, Users, Volume2, VolumeX,
  FileText, ArrowRight, Zap, RefreshCw, AlertOctagon
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACE } from '../design-system/tokens';

export default function EmergencyCADBoard() {
  const { scenarioId: paramScenarioId } = useParams();
  const scenarioId = paramScenarioId ? parseInt(paramScenarioId) : 2;
  const navigate = useNavigate();
  const { tokens, isDark } = useTheme();

  // State
  const [alerts, setAlerts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [units, setUnits] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('cad'); // 'cad' | 'broadcast' | 'cap_xml'
  const [sirenPlaying, setSirenPlaying] = useState(false);
  const [selectedXml, setSelectedXml] = useState('');
  const [selectedAlertTitle, setSelectedAlertTitle] = useState('');

  // New Incident / SOS State
  const [sosTitle, setSosTitle] = useState('');
  const [sosPriority, setSosPriority] = useState('P1_CRITICAL');
  const [sosDisasterType, setSosDisasterType] = useState('FLOOD');
  const [sosVictims, setSosVictims] = useState(2);
  const [sosTrapped, setSosTrapped] = useState(1);
  const [sosAddress, setSosAddress] = useState('Sector Alpha-1, Debris Blockage');
  const [sosHazards, setSosHazards] = useState('SUBMERGED_ROADS, LIVE_WIRES');

  // Load Data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [resAlerts, resIncidents, resUnits, resZones] = await Promise.all([
        fetch(`http://localhost:8081/api/emergency/alerts/scenario/${scenarioId}`),
        fetch(`http://localhost:8081/api/emergency/incidents/scenario/${scenarioId}`),
        fetch(`http://localhost:8081/api/emergency/units`),
        fetch(`http://localhost:8081/api/analysis/scenario/${scenarioId}/operational-zones/geojson`)
      ]);

      if (resAlerts.ok) setAlerts(await resAlerts.json());
      if (resIncidents.ok) setIncidents(await resIncidents.json());
      if (resUnits.ok) setUnits(await resUnits.json());
      if (resZones.ok) {
        const zoneGeoJson = await resZones.json();
        setZones(zoneGeoJson.features || []);
      }
    } catch (err) {
      console.error('Failed to load emergency data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [scenarioId]);

  // Audio Siren Synthesizer using Web Audio API
  const toggleSiren = () => {
    if (sirenPlaying) {
      setSirenPlaying(false);
      window.emergencyAudioCtx && window.emergencyAudioCtx.close();
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      window.emergencyAudioCtx = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.15, ctx.currentTime);

      // Pitch sweep
      const now = ctx.currentTime;
      for (let i = 0; i < 20; i++) {
        osc.frequency.setValueAtTime(500, now + i * 1.0);
        osc.frequency.exponentialRampToValueAtTime(950, now + i * 1.0 + 0.5);
        osc.frequency.exponentialRampToValueAtTime(500, now + i * 1.0 + 1.0);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setSirenPlaying(true);
    } catch (e) {
      console.error('Web Audio siren error:', e);
    }
  };

  // Trigger Automatic CAP Alert from Critical Zone
  const handleAutoBroadcastZone = async (zoneId) => {
    try {
      const res = await fetch(`http://localhost:8081/api/emergency/alerts/generate-from-zone/${zoneId}`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchData();
        setActiveTab('broadcast');
      }
    } catch (err) {
      console.error('Failed to generate CAP alert:', err);
    }
  };

  // View CAP XML
  const handleViewCapXml = async (alertId, headline) => {
    try {
      const res = await fetch(`http://localhost:8081/api/emergency/alerts/${alertId}/cap.xml`);
      if (res.ok) {
        const text = await res.text();
        setSelectedXml(text);
        setSelectedAlertTitle(headline);
        setActiveTab('cap_xml');
      }
    } catch (err) {
      console.error('Failed to fetch CAP XML:', err);
    }
  };

  // Submit Civilian SOS Incident
  const handleSubmitSos = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: sosTitle || 'Civilian Emergency Call',
        disasterType: sosDisasterType,
        priority: sosPriority,
        addressText: sosAddress,
        reportedBy: 'Civilian / Emergency Call 112',
        victimCount: sosVictims,
        trappedCount: sosTrapped,
        hazardsPresent: sosHazards,
        scenarioId: scenarioId,
        longitude: 77.215,
        latitude: 28.614
      };

      const res = await fetch('http://localhost:8081/api/emergency/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSosTitle('');
        fetchData();
      }
    } catch (err) {
      console.error('Failed to post incident:', err);
    }
  };

  // Dispatch Unit to Incident
  const handleDispatch = async (incidentId, unitId) => {
    try {
      const res = await fetch(`http://localhost:8081/api/emergency/incidents/${incidentId}/dispatch/${unitId}`, {
        method: 'POST'
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error('Dispatch error:', err);
    }
  };

  // Update Status
  const handleUpdateStatus = async (incidentId, status) => {
    try {
      const res = await fetch(`http://localhost:8081/api/emergency/incidents/${incidentId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error('Status update error:', err);
    }
  };

  const criticalZones = zones.filter(z => z.properties?.criticality === 'CRITICAL' || z.properties?.criticality === 'HIGH');

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1600, margin: '0 auto' }}>
      
      {/* ─── Top Operational Header ─── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 24px', background: isDark ? 'linear-gradient(135deg, #1e1014 0%, #0d1117 100%)' : '#fff5f5',
        borderRadius: RADIUS.lg, border: '1px solid #ff4d4f44', marginBottom: 24,
        boxShadow: '0 8px 32px rgba(255, 77, 79, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', background: '#ff4d4f',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            animation: 'pulse 2s infinite'
          }}>
            <ShieldAlert size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: isDark ? '#fff' : '#111' }}>
                Tactical Emergency Dispatch & OASIS CAP Broadcast
              </h1>
              <span style={{
                background: '#ff4d4f', color: '#fff', fontSize: 11, fontWeight: 700,
                padding: '2px 8px', borderRadius: RADIUS.full, textTransform: 'uppercase'
              }}>
                FEMA NIMS / ICS Active
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: tokens.textSecondary }}>
              Scenario #{scenarioId} • End-to-End Real-Time First Responder Operations & Public Warning Gateway
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={toggleSiren}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
              borderRadius: RADIUS.md, cursor: 'pointer', border: 'none',
              background: sirenPlaying ? '#ff4d4f' : isDark ? '#261214' : '#fee2e2',
              color: sirenPlaying ? '#fff' : '#ef4444', fontWeight: 600, fontSize: 13,
              transition: 'all 0.2s'
            }}
          >
            {sirenPlaying ? <VolumeX size={18} /> : <Volume2 size={18} />}
            {sirenPlaying ? 'SILENCE SIREN' : 'SOUND DISTRESS SIREN'}
          </button>

          <button
            onClick={fetchData}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px',
              borderRadius: RADIUS.md, cursor: 'pointer',
              background: isDark ? '#1f293d' : '#f1f5f9', color: tokens.text,
              border: `1px solid ${tokens.border}`, fontWeight: 500, fontSize: 13
            }}
          >
            <RefreshCw size={16} /> Refresh
          </button>

          <button
            onClick={() => navigate(`/scenario/${scenarioId}/map`)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
              borderRadius: RADIUS.md, cursor: 'pointer',
              background: tokens.accent, color: '#fff', border: 'none',
              fontWeight: 600, fontSize: 13
            }}
          >
            View Live GIS Map <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* ─── Metric Highlights ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{
          padding: 16, borderRadius: RADIUS.md, background: isDark ? '#161b22' : '#ffffff',
          border: `1px solid ${tokens.border}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: tokens.textSecondary, fontSize: 12 }}>
            <span>ACTIVE CAP ALERTS</span>
            <Radio size={16} color="#ef4444" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8, color: '#ef4444' }}>
            {alerts.length}
          </div>
          <div style={{ fontSize: 12, color: tokens.textSecondary, marginTop: 4 }}>
            Multi-channel broadcast active
          </div>
        </div>

        <div style={{
          padding: 16, borderRadius: RADIUS.md, background: isDark ? '#161b22' : '#ffffff',
          border: `1px solid ${tokens.border}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: tokens.textSecondary, fontSize: 12 }}>
            <span>CAD OPEN INCIDENTS</span>
            <AlertOctagon size={16} color="#f59e0b" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8, color: '#f59e0b' }}>
            {incidents.filter(i => i.status !== 'RESOLVED').length}
          </div>
          <div style={{ fontSize: 12, color: tokens.textSecondary, marginTop: 4 }}>
            {incidents.filter(i => i.priority === 'P1_CRITICAL').length} Critical P1 Priority
          </div>
        </div>

        <div style={{
          padding: 16, borderRadius: RADIUS.md, background: isDark ? '#161b22' : '#ffffff',
          border: `1px solid ${tokens.border}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: tokens.textSecondary, fontSize: 12 }}>
            <span>DEPLOYED UNITS</span>
            <Truck size={16} color="#3b82f6" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8, color: '#3b82f6' }}>
            {units.filter(u => u.status === 'DISPATCHED' || u.status === 'ON_SCENE').length} / {units.length}
          </div>
          <div style={{ fontSize: 12, color: tokens.textSecondary, marginTop: 4 }}>
            First responder fleet deployed
          </div>
        </div>

        <div style={{
          padding: 16, borderRadius: RADIUS.md, background: isDark ? '#161b22' : '#ffffff',
          border: `1px solid ${tokens.border}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: tokens.textSecondary, fontSize: 12 }}>
            <span>CRITICAL SECTORS</span>
            <Flame size={16} color="#ec4899" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8, color: '#ec4899' }}>
            {criticalZones.length}
          </div>
          <div style={{ fontSize: 12, color: tokens.textSecondary, marginTop: 4 }}>
            Sectors requiring mandatory orders
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs ─── */}
      <div style={{ display: 'flex', gap: 12, borderBottom: `1px solid ${tokens.border}`, marginBottom: 24 }}>
        {[
          { id: 'cad', label: 'Computer Aided Dispatch (CAD)', icon: Truck },
          { id: 'broadcast', label: 'CAP 1.2 Public Broadcasts', icon: Radio },
          { id: 'cap_xml', label: 'OASIS XML Specification', icon: FileText }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px',
                background: 'transparent', border: 'none', borderBottom: isActive ? `2px solid ${tokens.accent}` : '2px solid transparent',
                color: isActive ? tokens.accent : tokens.textSecondary, fontWeight: isActive ? 700 : 500,
                fontSize: 14, cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── TAB 1: COMPUTER AIDED DISPATCH (CAD) ─── */}
      {activeTab === 'cad' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: 24 }}>
          
          {/* Left: Incident Queue */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: tokens.text }}>
                Live Incident Queue ({incidents.length})
              </h2>
              <span style={{ fontSize: 12, color: tokens.textSecondary }}>
                Real-time CAD Dispatch Queue
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {incidents.length === 0 ? (
                <div style={{
                  padding: 32, textAlign: 'center', borderRadius: RADIUS.md,
                  background: isDark ? '#161b22' : '#f8fafc', border: `1px dashed ${tokens.border}`
                }}>
                  <CheckCircle size={36} color="#10b981" style={{ margin: '0 auto 12px' }} />
                  <p style={{ margin: 0, fontWeight: 600, color: tokens.text }}>No Open CAD Incidents</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: 13, color: tokens.textSecondary }}>
                    Submit an emergency SOS below or wait for automatic alerts.
                  </p>
                </div>
              ) : (
                incidents.map(inc => {
                  const assignedUnit = units.find(u => u.id === inc.assignedUnitId);
                  const isCritical = inc.priority === 'P1_CRITICAL';

                  return (
                    <div
                      key={inc.id}
                      style={{
                        padding: 18, borderRadius: RADIUS.md,
                        background: isDark ? '#161b22' : '#ffffff',
                        border: `1px solid ${isCritical ? '#ef444455' : tokens.border}`,
                        borderLeft: `4px solid ${isCritical ? '#ef4444' : '#f59e0b'}`,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              padding: '2px 6px', borderRadius: RADIUS.sm, fontSize: 11, fontWeight: 700,
                              background: isCritical ? '#fee2e2' : '#fef3c7',
                              color: isCritical ? '#dc2626' : '#d97706'
                            }}>
                              {inc.priority}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: tokens.textSecondary }}>
                              {inc.code}
                            </span>
                            <span style={{
                              padding: '2px 8px', borderRadius: RADIUS.full, fontSize: 11, fontWeight: 600,
                              background: inc.status === 'RESOLVED' ? '#d1fae5' : inc.status === 'DISPATCHED' ? '#dbeafe' : '#f1f5f9',
                              color: inc.status === 'RESOLVED' ? '#059669' : inc.status === 'DISPATCHED' ? '#2563eb' : '#64748b'
                            }}>
                              {inc.status}
                            </span>
                          </div>
                          <h3 style={{ margin: '8px 0 4px 0', fontSize: 16, fontWeight: 700, color: tokens.text }}>
                            {inc.title}
                          </h3>
                        </div>

                        {/* Status Actions */}
                        <div style={{ display: 'flex', gap: 6 }}>
                          {inc.status !== 'ON_SCENE' && inc.status !== 'RESOLVED' && (
                            <button
                              onClick={() => handleUpdateStatus(inc.id, 'ON_SCENE')}
                              style={{
                                padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: RADIUS.sm,
                                background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer'
                              }}
                            >
                              Mark On-Scene
                            </button>
                          )}
                          {inc.status !== 'RESOLVED' && (
                            <button
                              onClick={() => handleUpdateStatus(inc.id, 'RESOLVED')}
                              style={{
                                padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: RADIUS.sm,
                                background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer'
                              }}
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 16, fontSize: 13, color: tokens.textSecondary, margin: '10px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={14} /> {inc.addressText || 'Coordinates Geocoded'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Users size={14} /> {inc.victimCount || 0} Victims ({inc.trappedCount || 0} Trapped)
                        </div>
                      </div>

                      {inc.hazardsPresent && (
                        <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>
                          ⚠️ Secondary Hazards: <strong>{inc.hazardsPresent}</strong>
                        </div>
                      )}

                      {/* Unit Assignment Bar */}
                      <div style={{
                        marginTop: 12, paddingTop: 12, borderTop: `1px solid ${tokens.border}`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        {assignedUnit ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                            <Truck size={16} color="#3b82f6" />
                            <span>Assigned Unit: <strong style={{ color: tokens.text }}>{assignedUnit.callsign}</strong> ({assignedUnit.unitType})</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                            <span style={{ fontSize: 12, color: tokens.textSecondary }}>Assign Available Unit:</span>
                            <select
                              onChange={(e) => e.target.value && handleDispatch(inc.id, e.target.value)}
                              defaultValue=""
                              style={{
                                padding: '6px 10px', borderRadius: RADIUS.sm, fontSize: 12,
                                background: isDark ? '#1f293d' : '#f8fafc', color: tokens.text,
                                border: `1px solid ${tokens.border}`, cursor: 'pointer'
                              }}
                            >
                              <option value="" disabled>Select Unit...</option>
                              {units.filter(u => u.status === 'AVAILABLE').map(u => (
                                <option key={u.id} value={u.id}>
                                  {u.callsign} — {u.unitType} (Personnel: {u.personnelCount})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Response Units & SOS Intake */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Units Telemetry Deck */}
            <div style={{
              padding: 20, borderRadius: RADIUS.md,
              background: isDark ? '#161b22' : '#ffffff', border: `1px solid ${tokens.border}`
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0', color: tokens.text }}>
                First Responder Units ({units.length})
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {units.map(u => (
                  <div
                    key={u.id}
                    style={{
                      padding: 12, borderRadius: RADIUS.sm,
                      background: isDark ? '#0d1117' : '#f8fafc', border: `1px solid ${tokens.border}`,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Truck size={14} color="#3b82f6" />
                        <span style={{ fontWeight: 700, fontSize: 13, color: tokens.text }}>{u.callsign}</span>
                        <span style={{ fontSize: 11, color: tokens.textSecondary }}>• {u.unitType}</span>
                      </div>
                      <div style={{ fontSize: 11, color: tokens.textSecondary, marginTop: 4 }}>
                        Crew: {u.personnelCount} | Equip: {u.equipmentManifest?.slice(0, 35)}...
                      </div>
                    </div>

                    <span style={{
                      padding: '2px 8px', borderRadius: RADIUS.full, fontSize: 11, fontWeight: 700,
                      background: u.status === 'AVAILABLE' ? '#d1fae5' : '#fee2e2',
                      color: u.status === 'AVAILABLE' ? '#059669' : '#dc2626'
                    }}>
                      {u.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Civilian Emergency SOS Intake */}
            <div style={{
              padding: 20, borderRadius: RADIUS.md,
              background: isDark ? '#161b22' : '#ffffff', border: `1px solid ${tokens.border}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Zap size={18} color="#ef4444" />
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: tokens.text }}>
                  Emergency SOS Call Intake
                </h2>
              </div>

              <form onSubmit={handleSubmitSos} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: tokens.textSecondary }}>INCIDENT TITLE</label>
                  <input
                    type="text"
                    placeholder="e.g. Roof Collapse with Trapped Family"
                    value={sosTitle}
                    onChange={(e) => setSosTitle(e.target.value)}
                    required
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: RADIUS.sm,
                      background: isDark ? '#0d1117' : '#f8fafc', color: tokens.text,
                      border: `1px solid ${tokens.border}`, marginTop: 4, boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: tokens.textSecondary }}>PRIORITY</label>
                    <select
                      value={sosPriority}
                      onChange={(e) => setSosPriority(e.target.value)}
                      style={{
                        width: '100%', padding: '8px 10px', borderRadius: RADIUS.sm,
                        background: isDark ? '#0d1117' : '#f8fafc', color: tokens.text,
                        border: `1px solid ${tokens.border}`, marginTop: 4, boxSizing: 'border-box'
                      }}
                    >
                      <option value="P1_CRITICAL">P1 Critical</option>
                      <option value="P2_HIGH">P2 High</option>
                      <option value="P3_MEDIUM">P3 Medium</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: tokens.textSecondary }}>HAZARD TYPE</label>
                    <select
                      value={sosDisasterType}
                      onChange={(e) => setSosDisasterType(e.target.value)}
                      style={{
                        width: '100%', padding: '8px 10px', borderRadius: RADIUS.sm,
                        background: isDark ? '#0d1117' : '#f8fafc', color: tokens.text,
                        border: `1px solid ${tokens.border}`, marginTop: 4, boxSizing: 'border-box'
                      }}
                    >
                      <option value="FLOOD">Flash Flood</option>
                      <option value="EARTHQUAKE">Earthquake Collapse</option>
                      <option value="FIRE">Structural Fire</option>
                      <option value="HAZMAT">Chemical / Gas</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: tokens.textSecondary }}>VICTIMS</label>
                    <input
                      type="number"
                      value={sosVictims}
                      onChange={(e) => setSosVictims(parseInt(e.target.value))}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: RADIUS.sm,
                        background: isDark ? '#0d1117' : '#f8fafc', color: tokens.text,
                        border: `1px solid ${tokens.border}`, marginTop: 4, boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: tokens.textSecondary }}>TRAPPED</label>
                    <input
                      type="number"
                      value={sosTrapped}
                      onChange={(e) => setSosTrapped(parseInt(e.target.value))}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: RADIUS.sm,
                        background: isDark ? '#0d1117' : '#f8fafc', color: tokens.text,
                        border: `1px solid ${tokens.border}`, marginTop: 4, boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '10px 16px', borderRadius: RADIUS.md, cursor: 'pointer',
                    background: '#ef4444', color: '#fff', border: 'none', fontWeight: 700,
                    fontSize: 13, marginTop: 6
                  }}
                >
                  <Send size={16} /> Disseminate SOS to CAD Queue
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: CAP 1.2 PUBLIC BROADCASTS ─── */}
      {activeTab === 'broadcast' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr', gap: 24 }}>
          
          {/* Quick Evacuation Order Generator from Sector Clusters */}
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px 0', color: tokens.text }}>
              Sector-Triggered Evacuation Orders
            </h2>
            <p style={{ fontSize: 13, color: tokens.textSecondary, marginBottom: 16 }}>
              One-click CAP 1.2 emergency alerts derived directly from computer vision damage clusters.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {zones.map(z => {
                const p = z.properties;
                const isCrit = p.criticality === 'CRITICAL';
                return (
                  <div
                    key={p.id}
                    style={{
                      padding: 16, borderRadius: RADIUS.md,
                      background: isDark ? '#161b22' : '#ffffff',
                      border: `1px solid ${isCrit ? '#ef444466' : tokens.border}`,
                      borderLeft: `4px solid ${isCrit ? '#ef4444' : '#f59e0b'}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            padding: '2px 6px', borderRadius: RADIUS.sm, fontSize: 11, fontWeight: 700,
                            background: isCrit ? '#fee2e2' : '#fef3c7',
                            color: isCrit ? '#dc2626' : '#d97706'
                          }}>
                            {p.criticality}
                          </span>
                          <strong style={{ fontSize: 14, color: tokens.text }}>{p.name} ({p.zoneCode})</strong>
                        </div>
                        <div style={{ fontSize: 12, color: tokens.textSecondary, marginTop: 4 }}>
                          Destroyed: {p.destroyedCount} | Exposed Pop: {p.estimatedPopulation}
                        </div>
                      </div>

                      <button
                        onClick={() => handleAutoBroadcastZone(p.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                          borderRadius: RADIUS.md, cursor: 'pointer',
                          background: isCrit ? '#ef4444' : '#f59e0b', color: '#fff',
                          border: 'none', fontWeight: 600, fontSize: 12
                        }}
                      >
                        <Radio size={14} /> Issue CAP Order
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Broadcasts History */}
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px 0', color: tokens.text }}>
              Active Multi-Hazard Broadcast Log ({alerts.length})
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {alerts.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: tokens.textSecondary }}>
                  No active broadcasts published. Click "Issue CAP Order" to trigger.
                </div>
              ) : (
                alerts.map(a => (
                  <div
                    key={a.id}
                    style={{
                      padding: 18, borderRadius: RADIUS.md,
                      background: isDark ? '#161b22' : '#ffffff',
                      border: '1px solid #ef444444', borderLeft: '4px solid #ef4444'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: RADIUS.full, fontSize: 11, fontWeight: 700,
                            background: '#fee2e2', color: '#dc2626'
                          }}>
                            {a.event}
                          </span>
                          <span style={{ fontSize: 12, color: tokens.textSecondary }}>{a.identifier}</span>
                        </div>
                        <h3 style={{ margin: '8px 0 4px 0', fontSize: 16, fontWeight: 800, color: tokens.text }}>
                          {a.headline}
                        </h3>
                      </div>

                      <button
                        onClick={() => handleViewCapXml(a.id, a.headline)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                          borderRadius: RADIUS.sm, cursor: 'pointer',
                          background: isDark ? '#1f293d' : '#f1f5f9', color: tokens.text,
                          border: `1px solid ${tokens.border}`, fontSize: 12, fontWeight: 600
                        }}
                      >
                        <FileText size={14} /> View OASIS XML
                      </button>
                    </div>

                    <p style={{ margin: '8px 0', fontSize: 13, color: tokens.textSecondary, lineHeight: 1.5 }}>
                      {a.description}
                    </p>

                    <div style={{
                      padding: '10px 14px', borderRadius: RADIUS.sm,
                      background: isDark ? '#261214' : '#fff1f2', border: '1px solid #fecdd3',
                      fontSize: 12, color: '#be123c', fontWeight: 600
                    }}>
                      👉 Civil Instruction: {a.instruction}
                    </div>

                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: tokens.textSecondary, marginTop: 10 }}>
                      <span>Urgency: <strong>{a.urgency}</strong></span>
                      <span>Severity: <strong>{a.severity}</strong></span>
                      <span>Certainty: <strong>{a.certainty}</strong></span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: OASIS CAP 1.2 XML SPECIFICATION ─── */}
      {activeTab === 'cap_xml' && (
        <div style={{
          padding: 24, borderRadius: RADIUS.md,
          background: isDark ? '#0d1117' : '#1e293b', border: `1px solid ${tokens.border}`,
          color: '#e2e8f0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                OASIS Common Alerting Protocol (CAP) v1.2 Payload
              </h2>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0 0' }}>
                Standardized XML schema compatible with cellular cell-broadcasts, NOAA, and WMO EW4All gateways.
              </p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(selectedXml);
                alert('CAP XML copied to clipboard');
              }}
              style={{
                padding: '8px 16px', borderRadius: RADIUS.sm, cursor: 'pointer',
                background: tokens.accent, color: '#fff', border: 'none', fontWeight: 600, fontSize: 12
              }}
            >
              Copy CAP XML
            </button>
          </div>

          <pre style={{
            fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6, overflowX: 'auto',
            padding: 20, background: isDark ? '#000000' : '#0f172a', borderRadius: RADIUS.sm,
            color: '#38bdf8'
          }}>
            {selectedXml || (alerts[0] ? `Click "View OASIS XML" on any alert in the Broadcast tab to inspect live payload.` : 'No alerts generated yet.')}
          </pre>
        </div>
      )}

    </div>
  );
}
