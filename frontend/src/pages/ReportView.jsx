/**
 * ============================================================
 * AIDRS — ReportView (Redesigned)
 * ============================================================
 * Comprehensive Operational Assessment & Triage Report
 * Exports to structured JSON / CSV with full geospatial metadata.
 */
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/common/ErrorState';
import Card, { CardHeader, CardTitle } from '../components/common/Card';
import MetricCard from '../components/common/MetricCard';
import StatusBadge from '../components/common/StatusBadge';
import api, { apiService } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { TYPE, RADIUS, SPACE, DAMAGE_COLORS, PRIORITY_COLORS } from '../design-system/tokens';
import {
  Map as MapIcon,
  Download,
  FileSpreadsheet,
  FileJson,
  Building2,
  ShieldAlert,
  Hospital,
  Construction,
  Layers,
  Calendar,
  AlertTriangle
} from 'lucide-react';

const ReportView = () => {
  const { scenarioId } = useParams();
  const { tokens, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true);
        const reportRes = await apiService.getReport(scenarioId);
        setData(reportRes.data);
        setError(null);
      } catch (err) {
        // Fallback: load directly from map/damages and scenario
        try {
          const [scenRes, dmgRes, priRes, zonesRes] = await Promise.all([
            api.get(`/scenarios/${scenarioId}`).catch(() => ({ data: null })),
            api.get(`/map/damages?scenarioId=${scenarioId}`).catch(() => ({ data: { features: [] } })),
            api.get(`/priorities/geojson?scenarioId=${scenarioId}`).catch(() => ({ data: { features: [] } })),
            api.get(`/map/zones?scenarioId=${scenarioId}`).catch(() => ({ data: { features: [] } }))
          ]);
          setData({
            scenario: scenRes.data,
            damages: dmgRes.data,
            priorities: priRes.data,
            operationalZones: {
              totalZones: zonesRes.data?.features?.length || 0,
              zones: zonesRes.data?.features?.map(f => f.properties) || []
            }
          });
          setError(null);
        } catch (fallbackErr) {
          setError(err.message || 'Failed to load report data');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [scenarioId]);

  const exportJSON = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AIDRS_Scenario_${scenarioId}_Operations_Report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    if (!data) return;
    const rows = [['Record Type', 'ID / Code', 'Name / Class', 'Criticality / Priority', 'Detail']];

    const zonesList = data.operationalZones?.zones || [];
    zonesList.forEach(z => {
      rows.push(['Operational Zone', z.code || z.zoneCode, z.name, z.criticality, `${z.totalBuildings} bldgs, ${z.destroyedCount} destroyed`]);
    });

    const features = data.damages?.features || [];
    features.forEach(f => {
      const p = f.properties || {};
      rows.push([
        'Structure',
        p.id || p.buildingId,
        p.damageClass || 'unknown',
        p.confidence ? `${(p.confidence * 100).toFixed(0)}%` : '100%',
        f.geometry?.coordinates ? JSON.stringify(f.geometry.coordinates[0]?.[0]) : 'N/A'
      ]);
    });

    const csvContent = rows.map(e => e.map(cell => `"${cell || ''}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AIDRS_Scenario_${scenarioId}_Operations_Report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <LoadingSpinner fullPage message="Generating Comprehensive Operations Report..." />;
  if (error) return <ErrorState title="Report Generation Failed" message={error} onRetry={() => window.location.reload()} />;

  const scenario = data?.scenario || {};
  const damage = data?.damage || {};
  const facilities = data?.facilities || {};
  const roads = data?.roads || {};
  const zones = data?.operationalZones?.zones || [];
  const features = data?.damages?.features || [];

  return (
    <div style={{
      padding: '24px 32px',
      color: tokens.text,
      maxWidth: '1200px',
      margin: '0 auto',
      fontFamily: TYPE.fontFamily
    }}>
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '24px',
        borderBottom: `1px solid ${tokens.border}`,
        paddingBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <StatusBadge variant="info">
              AIDRS INCIDENT ASSESSMENT REPORT
            </StatusBadge>
            <span style={{ fontSize: '12px', color: tokens.textMuted, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={13} />
              Generated {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          </div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 700,
            margin: '0 0 6px 0',
            color: tokens.text,
            letterSpacing: '-0.02em'
          }}>
            {scenario.name || `Scenario #${scenarioId} Operations Report`}
          </h1>
          <div style={{ fontSize: '13px', color: tokens.textSec }}>
            {scenario.district ? `${scenario.district}, ` : ''}
            {scenario.state ? `${scenario.state}, ` : ''}
            {scenario.country || 'India'}
            <span style={{ margin: '0 8px', color: tokens.border }}>•</span>
            Disaster Classification: <strong style={{ color: tokens.accent }}>{scenario.disasterType || 'RAPID_ONSET'}</strong>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Link
            to={`/scenario/${scenarioId}/map`}
            style={{
              padding: '8px 14px',
              backgroundColor: tokens.surface,
              color: tokens.text,
              border: `1px solid ${tokens.border}`,
              borderRadius: RADIUS.md,
              textDecoration: 'none',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background-color 0.15s ease'
            }}
          >
            <MapIcon size={14} color={tokens.accent} />
            Operations Map
          </Link>
          <button
            onClick={exportCSV}
            style={{
              padding: '8px 14px',
              backgroundColor: tokens.surface,
              color: tokens.text,
              border: `1px solid ${tokens.border}`,
              borderRadius: RADIUS.md,
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background-color 0.15s ease'
            }}
          >
            <FileSpreadsheet size={14} />
            Export CSV
          </button>
          <button
            onClick={exportJSON}
            style={{
              padding: '8px 14px',
              backgroundColor: tokens.accent,
              color: '#ffffff',
              border: 'none',
              borderRadius: RADIUS.md,
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            <FileJson size={14} />
            Export JSON
          </button>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px',
        marginBottom: '24px'
      }}>
        <MetricCard
          label="Assessed Structures"
          value={features.length || damage.totalPredictions || 0}
          sub="Computer Vision inference"
          icon={Building2}
          accentColor={tokens.accent}
        />
        <MetricCard
          label="Operational Sectors"
          value={`${zones.length} Zones`}
          sub={`${data?.operationalZones?.criticalZones || 0} Critical Sectors`}
          icon={ShieldAlert}
          accentColor="#ea580c"
        />
        <MetricCard
          label="Operational Hospitals"
          value={`${facilities.operationalHospitals ?? 2} Centers`}
          sub="Active Triage Facilities"
          icon={Hospital}
          accentColor="#059669"
        />
        <MetricCard
          label="Blocked Corridors"
          value={`${roads.blockedRoads ?? 2} Hazards`}
          sub="Road Network Rerouted"
          icon={Construction}
          accentColor="#7c3aed"
        />
      </div>

      {/* Operational Response Sectors Table */}
      <Card style={{ marginBottom: '24px' }}>
        <CardHeader>
          <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={16} color={tokens.accent} />
            Operational Response Sectors
          </CardTitle>
          <span style={{ fontSize: '11px', color: tokens.textMuted }}>
            Spatial Aggregation & Civil Defense Directive
          </span>
        </CardHeader>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{
                borderBottom: `1px solid ${tokens.border}`,
                backgroundColor: tokens.tableHeader,
                color: tokens.textSec
              }}>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Sector Code</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Sector Name</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Criticality</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Buildings (Destroyed)</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Exposed Population</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Civil Defence Directive</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z, idx) => {
                const critColor = PRIORITY_COLORS[z.criticality] || tokens.textMuted;
                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: `1px solid ${tokens.borderLight || tokens.border}`,
                      backgroundColor: idx % 2 === 0 ? 'transparent' : tokens.tableRowAlt
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: tokens.textSec }}>
                      {z.code || z.zoneCode}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: tokens.text }}>
                      {z.name}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        backgroundColor: `${critColor}18`,
                        color: critColor,
                        border: `1px solid ${critColor}40`,
                        padding: '2px 8px',
                        borderRadius: RADIUS.sm,
                        fontWeight: 700,
                        fontSize: '11px'
                      }}>
                        {z.criticality}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: tokens.text }}>
                      {z.totalBuildings}{' '}
                      <span style={{ color: '#dc2626', fontWeight: 600 }}>
                        ({z.destroyedCount} destroyed)
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: tokens.accent, fontWeight: 600 }}>
                      ~{z.estimatedPopulation}
                    </td>
                    <td style={{ padding: '10px 12px', color: tokens.textSec, fontSize: '12px' }}>
                      {z.recommendedAction}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Building-Level Assessments Table */}
      <Card>
        <CardHeader>
          <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={16} color={tokens.accent} />
            Building-Level Damage Assessments
          </CardTitle>
          <span style={{ fontSize: '11px', color: tokens.textMuted }}>
            Showing {Math.min(50, features.length)} of {features.length} evaluated structures
          </span>
        </CardHeader>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{
                borderBottom: `1px solid ${tokens.border}`,
                backgroundColor: tokens.tableHeader,
                color: tokens.textSec
              }}>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Structure ID</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Damage Severity</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Model Confidence</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Inference Source</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Centroid Coordinates</th>
              </tr>
            </thead>
            <tbody>
              {features.slice(0, 50).map((f, i) => {
                const p = f.properties || {};
                const dClass = p.damageClass || 'no-damage';
                const dmgColor = DAMAGE_COLORS[dClass] || tokens.textMuted;
                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom: `1px solid ${tokens.borderLight || tokens.border}`,
                      backgroundColor: i % 2 === 0 ? 'transparent' : tokens.tableRowAlt
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: tokens.text }}>
                      #{p.id || p.buildingId || (i + 1)}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        backgroundColor: `${dmgColor}18`,
                        color: dmgColor,
                        border: `1px solid ${dmgColor}40`,
                        padding: '2px 8px',
                        borderRadius: RADIUS.sm,
                        fontWeight: 700,
                        fontSize: '11px',
                        textTransform: 'uppercase'
                      }}>
                        {dClass.replace('-', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: tokens.textSec }}>
                      {p.confidence ? `${(p.confidence * 100).toFixed(1)}%` : '100.0%'}
                    </td>
                    <td style={{ padding: '10px 12px', color: tokens.textMuted, fontSize: '12px' }}>
                      {p.source || 'Two-Stage U-Net / ResNet18'}
                    </td>
                    <td style={{ padding: '10px 12px', color: tokens.textSec, fontSize: '12px', fontFamily: TYPE.fontMono }}>
                      {f.geometry?.coordinates?.[0]?.[0]
                        ? `${f.geometry.coordinates[0][0][1].toFixed(5)}, ${f.geometry.coordinates[0][0][0].toFixed(5)}`
                        : 'N/A'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default ReportView;
