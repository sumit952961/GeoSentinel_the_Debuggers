import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  AlertTriangle, 
  AlertCircle, 
  Hospital, 
  Home, 
  Construction,
  MapPin,
  Calendar,
  Shield
} from 'lucide-react';

import { useTheme } from '../context/ThemeContext';
import MetricCard from '../components/common/MetricCard';
import Card, { CardHeader, CardTitle } from '../components/common/Card';
import StatusBadge from '../components/common/StatusBadge';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { DAMAGE_COLORS, PRIORITY_COLORS, TYPE, RADIUS, SPACE } from '../design-system/tokens';
import api from '../services/api';
import { BRANDING } from '../config/branding';

function ExecutiveDashboard() {
  const { scenarioId: urlScenarioId } = useParams();
  const navigate = useNavigate();
  const { tokens, isDark } = useTheme();
  
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState(urlScenarioId ? parseInt(urlScenarioId) : 1);
  const [scenarioData, setScenarioData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [roads, setRoads] = useState([]);
  const [priorities, setPriorities] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadScenarios();
  }, []);

  async function loadScenarios() {
    try {
      const resp = await api.get('/scenarios');
      setScenarios(resp.data);
      if (resp.data.length > 0) {
        setSelectedScenarioId(urlScenarioId ? parseInt(urlScenarioId) : resp.data[0].id);
      }
    } catch (err) {
      setError('Could not connect to backend.');
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedScenarioId) {
      loadScenarioDetails(selectedScenarioId);
    }
  }, [selectedScenarioId]);

  async function loadScenarioDetails(scenarioId) {
    setLoading(true);
    setError(null);
    try {
      const [scenResp, sumResp, hospResp, sheltResp, roadResp, priResp] = await Promise.all([
        api.get(`/scenarios/${scenarioId}`).catch(() => ({ data: null })),
        api.get(`/analysis/${scenarioId}/summary`).catch(() => ({ data: null })),
        api.get(`/map/hospitals?scenarioId=${scenarioId}`).catch(() => ({ data: { features: [] } })),
        api.get(`/map/shelters?scenarioId=${scenarioId}`).catch(() => ({ data: { features: [] } })),
        api.get(`/map/roads?scenarioId=${scenarioId}`).catch(() => ({ data: { features: [] } })),
        api.get(`/priorities?scenarioId=${scenarioId}`).catch(() => ({ data: [] }))
      ]);

      setScenarioData(scenResp.data);
      setSummary(sumResp.data);
      setHospitals(hospResp.data?.features || []);
      setShelters(sheltResp.data?.features || []);
      setRoads(roadResp.data?.features || []);
      setPriorities(priResp.data || []);
    } catch (err) {
      setError(`Failed to load scenario summary: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Derived metrics
  const criticalCount = priorities.filter(p => (p.priorityLevel || p.priority_level) === 'CRITICAL').length;
  const highCount = priorities.filter(p => (p.priorityLevel || p.priority_level) === 'HIGH').length;
  const mediumCount = priorities.filter(p => (p.priorityLevel || p.priority_level) === 'MEDIUM').length;
  const lowCount = priorities.filter(p => (p.priorityLevel || p.priority_level) === 'LOW').length;
  
  const totalBeds = hospitals.reduce((acc, h) => acc + (parseInt(h.properties?.capacity) || 0), 0);
  const totalShelterCapacity = shelters.reduce((acc, s) => acc + (parseInt(s.properties?.capacity) || 0), 0);
  const blockedRoadCount = roads.filter(r => r.properties?.isBlocked).length;
  const totalRoads = roads.length;

  const scenarioBadge = BRANDING.scenarios?.find(s => s.id === selectedScenarioId)?.badge || 'Operational Event';

  const getStatusColor = (status) => {
    if (!status) return tokens.success;
    const s = status.toLowerCase();
    if (s === 'operational') return tokens.success;
    if (s === 'at capacity') return tokens.warning;
    if (s === 'closed' || s === 'damaged') return tokens.error;
    return tokens.textSecondary;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}>
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: `${SPACE.xl} ${SPACE.xl}`, maxWidth: '1200px', margin: '0 auto', fontFamily: TYPE.fontFamily, color: tokens.textPrimary }}>
      
      {/* Header & Scenario Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACE.xl, borderBottom: `1px solid ${tokens.border}`, paddingBottom: SPACE.lg }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.xs }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: tokens.textPrimary, margin: 0 }}>
              {scenarioData?.name || 'Executive Situation Summary'}
            </h1>
            <StatusBadge status="info" label={scenarioBadge} />
          </div>
          <span style={{ fontSize: '14px', color: tokens.textSecondary, display: 'block', maxWidth: '800px' }}>
            {scenarioData?.description || 'Aggregate Damage Distribution, Priority Triage Analysis, and Infrastructure Inventory'}
          </span>
          {scenarioData && (
            <div style={{ display: 'flex', gap: SPACE.lg, marginTop: SPACE.md, fontSize: '12px', color: tokens.textSecondary }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}><Shield size={14} /> {scenarioData.disasterType}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}><Calendar size={14} /> {scenarioData.eventDate}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}><MapPin size={14} /> {scenarioData.locationName}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: tokens.textSecondary }}>Scenario:</label>
          <select
            value={selectedScenarioId}
            onChange={(e) => setSelectedScenarioId(Number(e.target.value))}
            style={{
              padding: `${SPACE.xs} ${SPACE.sm}`,
              borderRadius: RADIUS.md,
              border: `1px solid ${tokens.inputBorder}`,
              fontSize: '12px',
              fontWeight: 500,
              color: tokens.textPrimary,
              backgroundColor: tokens.inputBg,
              cursor: 'pointer'
            }}
          >
            {scenarios.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: SPACE.md, borderRadius: RADIUS.md, marginBottom: SPACE.lg, fontSize: '14px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          {error}
        </div>
      )}

      {/* Key Metric KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: SPACE.md, marginBottom: SPACE.xl }}>
        <MetricCard
          title="Assessed Structures"
          value={summary?.totalBuildings || 0}
          subtitle="Vector polygonized"
          icon={Building2}
          iconColor={tokens.textSecondary}
        />
        <MetricCard
          title="Critical Priority"
          value={criticalCount}
          subtitle="Score &ge; 70%"
          icon={AlertTriangle}
          iconColor={PRIORITY_COLORS?.CRITICAL || '#dc2626'}
        />
        <MetricCard
          title="High Priority"
          value={highCount}
          subtitle="Score 50-70%"
          icon={AlertCircle}
          iconColor={PRIORITY_COLORS?.HIGH || '#ea580c'}
        />
        <MetricCard
          title="Operational Hospitals"
          value={hospitals.length}
          subtitle={`${totalBeds} total beds`}
          icon={Hospital}
          iconColor={tokens.success || '#059669'}
        />
        <MetricCard
          title="Relief Shelters"
          value={shelters.length}
          subtitle={`${totalShelterCapacity} evacuee capacity`}
          icon={Home}
          iconColor={tokens.info || '#0369a1'}
        />
        <MetricCard
          title="Blocked Corridors"
          value={blockedRoadCount}
          subtitle={`${blockedRoadCount} of ${totalRoads} corridors obstructed`}
          icon={Construction}
          iconColor={'#7c3aed'}
        />
      </div>

      {/* Two-Column Analytics Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE.lg, marginBottom: SPACE.xl }}>
        
        {/* Left Card: Damage Breakdown */}
        <Card style={{ backgroundColor: tokens.surface, borderRadius: RADIUS.lg }}>
          <CardHeader>
            <CardTitle style={{ fontSize: '16px', fontWeight: 600 }}>Damage Severity Breakdown</CardTitle>
          </CardHeader>
          <div style={{ padding: SPACE.lg, display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
            {[
              { label: 'No Damage', key: 'noDamageCount', color: DAMAGE_COLORS?.['no-damage'] || '#10b981' },
              { label: 'Minor Damage', key: 'minorDamageCount', color: DAMAGE_COLORS?.['minor-damage'] || '#f59e0b' },
              { label: 'Major Damage', key: 'majorDamageCount', color: DAMAGE_COLORS?.['major-damage'] || '#f97316' },
              { label: 'Destroyed', key: 'destroyedCount', color: DAMAGE_COLORS?.['destroyed'] || '#ef4444' }
            ].map((item, idx) => {
              const val = summary?.[item.key] || 0;
              const total = summary?.totalBuildings || 1;
              const pct = ((val / total) * 100).toFixed(1);
              return (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: SPACE.xs, fontSize: '12px' }}>
                    <span style={{ fontWeight: 600, color: item.color }}>{item.label}</span>
                    <strong style={{ color: tokens.textPrimary }}>{val} ({pct}%)</strong>
                  </div>
                  <div style={{ height: '6px', backgroundColor: tokens.bgTertiary || 'rgba(0,0,0,0.05)', borderRadius: RADIUS.sm, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: item.color, borderRadius: RADIUS.sm }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right Card: Priority Breakdown */}
        <Card style={{ backgroundColor: tokens.surface, borderRadius: RADIUS.lg }}>
          <CardHeader>
            <CardTitle style={{ fontSize: '16px', fontWeight: 600 }}>Priority Urgency Breakdown</CardTitle>
          </CardHeader>
          <div style={{ padding: SPACE.lg, display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
            {[
              { label: 'Critical Priority', val: criticalCount, color: PRIORITY_COLORS?.CRITICAL || '#dc2626' },
              { label: 'High Priority', val: highCount, color: PRIORITY_COLORS?.HIGH || '#ea580c' },
              { label: 'Medium Priority', val: mediumCount, color: PRIORITY_COLORS?.MEDIUM || '#d97706' },
              { label: 'Low Priority', val: lowCount, color: PRIORITY_COLORS?.LOW || '#059669' }
            ].map((item, idx) => {
              const total = summary?.totalBuildings || 1;
              const pct = ((item.val / total) * 100).toFixed(1);
              return (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: SPACE.xs, fontSize: '12px' }}>
                    <span style={{ fontWeight: 600, color: item.color }}>{item.label}</span>
                    <strong style={{ color: tokens.textPrimary }}>{item.val} locations</strong>
                  </div>
                  <div style={{ height: '6px', backgroundColor: tokens.bgTertiary || 'rgba(0,0,0,0.05)', borderRadius: RADIUS.sm, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: item.color, borderRadius: RADIUS.sm }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

      </div>

      {/* Facilities Inventory */}
      <Card style={{ backgroundColor: tokens.surface, borderRadius: RADIUS.lg }}>
        <CardHeader>
          <CardTitle style={{ fontSize: '16px', fontWeight: 600 }}>Emergency Response & Evacuation Facilities</CardTitle>
        </CardHeader>
        <div style={{ padding: SPACE.lg, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE.xl }}>
          
          {/* Hospitals Table */}
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: PRIORITY_COLORS?.CRITICAL || '#dc2626', marginBottom: SPACE.sm }}>Emergency Medical Centers</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: tokens.tableHeader, borderBottom: `1px solid ${tokens.border}`, textAlign: 'left', color: tokens.textSecondary }}>
                    <th style={{ padding: `${SPACE.sm} ${SPACE.md}`, fontWeight: 500 }}>Facility</th>
                    <th style={{ padding: `${SPACE.sm} ${SPACE.md}`, fontWeight: 500 }}>Capacity</th>
                    <th style={{ padding: `${SPACE.sm} ${SPACE.md}`, fontWeight: 500 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {hospitals.map((h, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${tokens.border}`, backgroundColor: i % 2 === 0 ? 'transparent' : tokens.bgTertiary }}>
                      <td style={{ padding: `${SPACE.sm} ${SPACE.md}`, fontWeight: 500, color: tokens.textPrimary }}>{h.properties?.name || 'Unknown Hospital'}</td>
                      <td style={{ padding: `${SPACE.sm} ${SPACE.md}`, color: tokens.textSecondary }}>{h.properties?.capacity || 0} beds</td>
                      <td style={{ padding: `${SPACE.sm} ${SPACE.md}`, color: getStatusColor(h.properties?.status), fontWeight: 600 }}>
                        {h.properties?.status || 'Operational'}
                      </td>
                    </tr>
                  ))}
                  {hospitals.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ padding: SPACE.md, textAlign: 'center', color: tokens.textSecondary }}>No hospital data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Shelters Table */}
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: tokens.info || '#0284c7', marginBottom: SPACE.sm }}>Relief Shelters</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: tokens.tableHeader, borderBottom: `1px solid ${tokens.border}`, textAlign: 'left', color: tokens.textSecondary }}>
                    <th style={{ padding: `${SPACE.sm} ${SPACE.md}`, fontWeight: 500 }}>Shelter Name</th>
                    <th style={{ padding: `${SPACE.sm} ${SPACE.md}`, fontWeight: 500 }}>Capacity</th>
                    <th style={{ padding: `${SPACE.sm} ${SPACE.md}`, fontWeight: 500 }}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {shelters.map((s, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${tokens.border}`, backgroundColor: i % 2 === 0 ? 'transparent' : tokens.bgTertiary }}>
                      <td style={{ padding: `${SPACE.sm} ${SPACE.md}`, fontWeight: 500, color: tokens.textPrimary }}>{s.properties?.name || 'Unknown Shelter'}</td>
                      <td style={{ padding: `${SPACE.sm} ${SPACE.md}`, color: tokens.textSecondary }}>{s.properties?.capacity || 0} people</td>
                      <td style={{ padding: `${SPACE.sm} ${SPACE.md}`, color: tokens.textSecondary }}>{s.properties?.shelterType || 'Standard'}</td>
                    </tr>
                  ))}
                  {shelters.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ padding: SPACE.md, textAlign: 'center', color: tokens.textSecondary }}>No shelter data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </Card>

    </div>
  );
}

export default ExecutiveDashboard;
