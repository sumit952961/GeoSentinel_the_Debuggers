/**
 * ============================================================
 * Scenario & GIS Data Verification Page
 * ============================================================
 *
 * Purpose:
 *   Visualizes and verifies the ingested disaster scenario and
 *   all loaded PostGIS layers (buildings, roads, hospitals, shelters)
 *   from the Spring Boot REST API.
 */

import { useState, useEffect } from 'react';
import api from '../services/api';

function ScenarioView() {
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [activeLayer, setActiveLayer] = useState('summary');
  const [layerData, setLayerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadScenarios();
  }, []);

  async function loadScenarios() {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get('/scenarios');
      setScenarios(resp.data);
      if (resp.data.length > 0) {
        setSelectedScenario(resp.data[0]);
      }
    } catch (err) {
      setError('Failed to load scenarios from Spring Boot backend. Make sure the database and backend are running.');
    } finally {
      setLoading(false);
    }
  }

  async function loadLayer(layerType) {
    if (!selectedScenario) return;
    setActiveLayer(layerType);
    if (layerType === 'summary') {
      setLayerData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get(`/map/${layerType}?scenarioId=${selectedScenario.id}`);
      setLayerData(resp.data);
    } catch (err) {
      setError(`Failed to fetch /api/map/${layerType}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      maxWidth: '900px',
      margin: '40px auto',
      padding: '0 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#212529', marginBottom: '4px' }}>
        Disaster Scenario & GIS Data Verification
      </h1>
      <p style={{ color: '#6c757d', marginBottom: '24px', fontSize: '14px' }}>
        Milestone 2 Ingestion Verification — Inspecting PostGIS Spatial Data Layers
      </p>

      {error && (
        <div style={{ padding: '12px 16px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {loading && <p style={{ color: '#6c757d', fontSize: '14px' }}>Loading data...</p>}

      {selectedScenario && (
        <div style={{ backgroundColor: '#fff', border: '1px solid #dee2e6', borderRadius: '8px', padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '18px', margin: '0 0 6px 0', color: '#1d3557' }}>{selectedScenario.name}</h2>
              <span style={{ fontSize: '12px', fontWeight: 600, padding: '3px 8px', borderRadius: '4px', backgroundColor: '#e63946', color: '#fff' }}>
                {selectedScenario.disasterType}
              </span>
              <span style={{ fontSize: '12px', marginLeft: '8px', color: '#6c757d' }}>
                Event Date: {selectedScenario.eventDate} | Location: {selectedScenario.locationName}
              </span>
            </div>
            <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#2a9d8f', color: '#fff' }}>
              Scenario ID: #{selectedScenario.id}
            </span>
          </div>

          <p style={{ fontSize: '14px', color: '#495057', marginBottom: '20px' }}>
            {selectedScenario.description}
          </p>

          {/* Quick Statistics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
            <div style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '6px', textAlign: 'center', border: '1px solid #e9ecef' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#1d3557' }}>{selectedScenario.buildingCount}</div>
              <div style={{ fontSize: '12px', color: '#6c757d' }}>Building Polygons</div>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '6px', textAlign: 'center', border: '1px solid #e9ecef' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#2a9d8f' }}>{selectedScenario.hospitalCount}</div>
              <div style={{ fontSize: '12px', color: '#6c757d' }}>Hospitals / Clinics</div>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '6px', textAlign: 'center', border: '1px solid #e9ecef' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#e76f51' }}>{selectedScenario.shelterCount}</div>
              <div style={{ fontSize: '12px', color: '#6c757d' }}>Relief Shelters</div>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '6px', textAlign: 'center', border: '1px solid #e9ecef' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#457b9d' }}>{selectedScenario.roadCount}</div>
              <div style={{ fontSize: '12px', color: '#6c757d' }}>Road Segments</div>
            </div>
          </div>

          {/* Layer Inspector Buttons */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #dee2e6', paddingBottom: '12px', marginBottom: '16px' }}>
            {[
              { key: 'summary', label: 'Overview' },
              { key: 'buildings', label: 'Buildings GeoJSON' },
              { key: 'roads', label: 'Roads GeoJSON' },
              { key: 'hospitals', label: 'Hospitals GeoJSON' },
              { key: 'shelters', label: 'Shelters GeoJSON' },
              { key: 'damages', label: 'Damages GeoJSON' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => loadLayer(tab.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: activeLayer === tab.key ? '#1d3557' : '#ced4da',
                  backgroundColor: activeLayer === tab.key ? '#1d3557' : '#fff',
                  color: activeLayer === tab.key ? '#fff' : '#495057',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* GeoJSON Feature Inspector */}
          {layerData && (
            <div>
              <div style={{ fontSize: '13px', color: '#6c757d', marginBottom: '8px' }}>
                Features returned: <strong>{layerData.features?.length || 0}</strong> (Type: <code>{layerData.type}</code>)
              </div>
              <pre style={{
                backgroundColor: '#212529',
                color: '#f8f9fa',
                padding: '16px',
                borderRadius: '6px',
                fontSize: '12px',
                maxHeight: '320px',
                overflow: 'auto'
              }}>
                {JSON.stringify(layerData.features?.slice(0, 3), null, 2)}
                {layerData.features?.length > 3 ? '\n\n... [and ' + (layerData.features.length - 3) + ' more features]' : ''}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ScenarioView;
