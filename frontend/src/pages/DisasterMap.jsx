/**
 * ============================================================
 * DisasterMap.jsx — DRAS Operations Map (3-Column Layout)
 * ============================================================
 *
 * Implements:
 *   - 01 ASSESS | 02 PRIORITISE | 03 RESPOND (Response Access vs Evacuation)
 *   - Heavy visual emphasis for Authoritative Response Routes on map
 *   - High-contrast glowing route lines, distinct Staging/Origin/Target markers
 *   - Real road segment sequence step list
 *   - Auto-fit zoom to route bounds
 *   - Centralized Priority-to-Response workflow
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { 
  Layers, ChevronRight, X, Satellite, BellRing, BellOff, AlertTriangle, 
  ShieldAlert, Radio, Volume2, VolumeX, ExternalLink, Zap, 
  CheckCircle2, AlertOctagon, Flame 
} from 'lucide-react';
import CesiumGlobe from '../components/globe/CesiumGlobe';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';

const DAMAGE_COLORS = {
  'no-damage': '#10b981',
  'minor-damage': '#f59e0b',
  'major-damage': '#f97316',
  'destroyed': '#ef4444',
  'unknown': '#94a3b8'
};

const DAMAGE_LABELS = {
  'no-damage': 'No Damage',
  'minor-damage': 'Minor Damage',
  'major-damage': 'Major Damage',
  'destroyed': 'Destroyed'
};

const PRIORITY_COLORS = {
  'CRITICAL': '#dc2626',
  'HIGH': '#ea580c',
  'MEDIUM': '#d97706',
  'LOW': '#059669'
};

function DisasterMap() {
  const { scenarioId: urlScenarioId } = useParams();
  const navigate = useNavigate();
  const { theme, isDark, tokens } = useTheme();

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupsRef = useRef({
    boundary: L.layerGroup(),
    zones: L.layerGroup(),
    hazardZones: L.layerGroup(),
    damages: L.layerGroup(),
    priorities: L.layerGroup(),
    buildings: L.layerGroup(),
    roads: L.layerGroup(),
    hospitals: L.layerGroup(),
    shelters: L.layerGroup(),
    routeGlow: L.layerGroup(),
    route: L.layerGroup(),
    routeMarkers: L.layerGroup(),
    selectionHighlight: L.layerGroup(),
    alerts: L.layerGroup()
  });

  // State
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState(urlScenarioId ? parseInt(urlScenarioId) : 1);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [error, setError] = useState(null);

  // Alert System States
  const [alerts, setAlerts] = useState([]);
  const [isAlertDrawerOpen, setIsAlertDrawerOpen] = useState(false);
  const [selectedCapAlert, setSelectedCapAlert] = useState(null);
  const [selectedCapXml, setSelectedCapXml] = useState('');
  const [capXmlLoading, setCapXmlLoading] = useState(false);
  const [sirenPlaying, setSirenPlaying] = useState(false);
  const [broadcastToast, setBroadcastToast] = useState(null);
  const [newAlertZoneId, setNewAlertZoneId] = useState('');
  const [isAlertBannerDismissed, setIsAlertBannerDismissed] = useState(false);
  const [isAlertSystemMuted, setIsAlertSystemMuted] = useState(false);

  // View Level: 'BUILDINGS' | 'ZONES' | 'BOTH'
  const [viewLevel, setViewLevel] = useState('BOTH');

  // Map Projection: '2D' (Leaflet) | '3D' (Cesium 3D Earth)
  const [mapViewMode, setMapViewMode] = useState('2D');
  const [gisDataVersion, setGisDataVersion] = useState(0);

  // Workflow Phase: 'DAMAGE' (01 ASSESS) | 'PRIORITY' (02 PRIORITISE) | 'ROUTING' (03 RESPOND)
  const [mapMode, setMapMode] = useState('DAMAGE');

  // Response Sub-Mode: 'RESPONSE' (Response Access) | 'EVACUATION' (Evacuation Route)
  const [responseRouteType, setResponseRouteType] = useState('RESPONSE');
  const [evacDestType, setEvacDestType] = useState('hospital'); // 'hospital' or 'shelter'

  // Layer Toggles
  const [layers, setLayers] = useState({
    alerts: true,
    zones: true,
    hazards: true,
    damages: true,
    priorities: true,
    buildings: false,
    roads: true,
    hospitals: true,
    shelters: true,
    boundary: true
  });

  // Filters
  const [damageFilter, setDamageFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.0);
  const [avoidBlockedRoads, setAvoidBlockedRoads] = useState(true);

  // Selected Building, Zone & Active Route
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);
  const [isLegendCollapsed, setIsLegendCollapsed] = useState(true);

  // Raw GeoJSON Data Cache
  const rawDataRef = useRef({
    damages: null,
    priorities: null,
    buildings: null,
    roads: null,
    hospitals: null,
    shelters: null,
    zones: null,
    hazards: null,
    alerts: [],
    scenario: null
  });

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapInstanceRef.current && mapContainerRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [34.0522, -118.6850],
        zoom: 12,
        zoomControl: false
      });

      L.control.zoom({ position: 'topright' }).addTo(map);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | DRAS Platform',
        maxZoom: 19
      }).addTo(map);

      Object.values(layerGroupsRef.current).forEach(lg => lg.addTo(map));
      mapInstanceRef.current = map;
    }

    loadScenarios();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Invalidate Leaflet map size when switching back from 3D to 2D
  useEffect(() => {
    if (mapViewMode === '2D' && mapInstanceRef.current) {
      setTimeout(() => {
        try {
          mapInstanceRef.current?.invalidateSize();
        } catch (e) {}
      }, 100);
    }
  }, [mapViewMode]);

  // 2. Load Scenarios
  async function loadScenarios() {
    try {
      const resp = await api.get('/scenarios');
      setScenarios(resp.data);
      if (resp.data.length > 0) {
        if (!urlScenarioId) {
          setSelectedScenarioId(resp.data[0].id);
        }
      }
    } catch (err) {
      setError('Could not connect to backend server (port 8081).');
    }
  }

  // Sync with URL param if it changes
  useEffect(() => {
    if (urlScenarioId) {
      setSelectedScenarioId(parseInt(urlScenarioId));
    }
  }, [urlScenarioId]);

  // 3. Load Scenario GIS Data
  useEffect(() => {
    if (selectedScenarioId) {
      loadScenarioData(selectedScenarioId);
    }
  }, [selectedScenarioId]);

  async function loadScenarioData(scenarioId) {
    setLoading(true);
    setError(null);
    setSelectedBuilding(null);
    setSelectedZone(null);
    clearRoute();
    layerGroupsRef.current.selectionHighlight.clearLayers();

    try {
      const [scenResp, damagesResp, priResp, bldgsResp, roadsResp, hospResp, sheltResp, sumResp, zonesResp, hazardsResp, alertsResp] = await Promise.all([
        api.get(`/scenarios/${scenarioId}`).catch(() => ({ data: null })),
        api.get(`/map/damages?scenarioId=${scenarioId}`).catch(() => ({ data: { features: [] } })),
        api.get(`/priorities/geojson?scenarioId=${scenarioId}`).catch(() => ({ data: { features: [] } })),
        api.get(`/map/buildings?scenarioId=${scenarioId}`).catch(() => ({ data: { features: [] } })),
        api.get(`/map/roads?scenarioId=${scenarioId}`).catch(() => ({ data: { features: [] } })),
        api.get(`/map/hospitals?scenarioId=${scenarioId}`).catch(() => ({ data: { features: [] } })),
        api.get(`/map/shelters?scenarioId=${scenarioId}`).catch(() => ({ data: { features: [] } })),
        api.get(`/analysis/${scenarioId}/summary`).catch(() => ({ data: null })),
        api.get(`/map/zones?scenarioId=${scenarioId}`).catch(() => ({ data: { features: [] } })),
        api.get(`/map/hazards?scenarioId=${scenarioId}`).catch(() => ({ data: { features: [] } })),
        api.get(`/emergency/alerts/scenario/${scenarioId}`).catch(() => ({ data: [] }))
      ]);

      const loadedAlerts = alertsResp.data || [];
      rawDataRef.current = {
        scenario: scenResp.data,
        damages: damagesResp.data,
        priorities: priResp.data,
        buildings: bldgsResp.data,
        roads: roadsResp.data,
        hospitals: hospResp.data,
        shelters: sheltResp.data,
        zones: zonesResp.data,
        hazards: hazardsResp.data,
        alerts: loadedAlerts
      };

      setAlerts(loadedAlerts);
      setSummary(sumResp.data);
      setGisDataVersion(v => v + 1);
      renderLayers();
    } catch (err) {
      setError(`Failed to load GIS layers: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // 4. Render Layers
  useEffect(() => {
    if (mapInstanceRef.current && rawDataRef.current.damages) {
      renderLayers();
    }
  }, [layers, mapMode, viewLevel, selectedZone, damageFilter, priorityFilter, confidenceThreshold]);

  // Update selection highlight ring when selected building changes
  useEffect(() => {
    const highlightGroup = layerGroupsRef.current.selectionHighlight;
    highlightGroup.clearLayers();

    if (selectedBuilding && selectedBuilding.geometry) {
      const isCritical = (selectedBuilding.priorityInfo?.priority_level || selectedBuilding.priorityInfo?.priorityLevel) === 'CRITICAL';
      const ringColor = isCritical ? '#dc2626' : '#ea580c';

      const hlLayer = L.geoJSON(selectedBuilding.geometry, {
        style: {
          color: ringColor,
          weight: 4,
          fillColor: '#ffffff',
          fillOpacity: 0.35,
          dashArray: '3, 3'
        }
      });
      highlightGroup.addLayer(hlLayer);
    }
  }, [selectedBuilding]);

  function renderLayers() {
    const map = mapInstanceRef.current;
    if (!map) return;

    const { boundary, zones, hazardZones, damages, priorities, buildings, roads, hospitals, shelters } = layerGroupsRef.current;

    boundary.clearLayers();
    zones.clearLayers();
    hazardZones.clearLayers();
    damages.clearLayers();
    priorities.clearLayers();
    buildings.clearLayers();
    roads.clearLayers();
    hospitals.clearLayers();
    shelters.clearLayers();

    const bounds = L.latLngBounds();

    const safeExtendBounds = (layer) => {
      try {
        if (layer && typeof layer.getBounds === 'function') {
          const b = layer.getBounds();
          if (b && b.isValid()) bounds.extend(b);
        }
      } catch (e) {}
    };

    // A. Scenario Boundary Layer
    if (layers.boundary && rawDataRef.current.scenario?.boundary) {
      try {
        const boundLayer = L.geoJSON(rawDataRef.current.scenario.boundary, {
          style: {
            color: '#dc2626',
            weight: 2,
            dashArray: '6, 6',
            fillColor: '#ef4444',
            fillOpacity: 0.03
          }
        });
        boundary.addLayer(boundLayer);
        safeExtendBounds(boundLayer);
      } catch (e) {}
    }

    // A1. Hazard Zones & Impact Extents (Dharali Debris Fan, Chamoli Glacial Surge, Fani Wind Swath)
    if (layers.hazards && rawDataRef.current.hazards?.features) {
      const isDharali = selectedScenarioId === 4;
      const hzLayer = L.geoJSON(rawDataRef.current.hazards, {
        style: (feat) => {
          const p = feat.properties || {};
          const hType = p.hazard_type || p.hazardType || '';
          if (isDharali || hType === 'DEBRIS_FAN_EXTENT') {
            return {
              color: '#b91c1c',
              weight: 3.5,
              dashArray: '8, 4',
              fillColor: '#ef4444',
              fillOpacity: 0.28
            };
          }
          if (hType === 'GLACIAL_SURGE_CORRIDOR') {
            return {
              color: '#d97706',
              weight: 3,
              dashArray: '6, 4',
              fillColor: '#f59e0b',
              fillOpacity: 0.22
            };
          }
          if (hType === 'STORM_SURGE_SWATH') {
            return {
              color: '#0891b2',
              weight: 3,
              dashArray: '6, 4',
              fillColor: '#06b6d4',
              fillOpacity: 0.20
            };
          }
          return {
            color: '#c2410c',
            weight: 2.5,
            dashArray: '5, 5',
            fillColor: '#ea580c',
            fillOpacity: 0.20
          };
        },
        onEachFeature: (feat, layer) => {
          const p = feat.properties || {};
          const title = isDharali 
            ? 'Dharali 2025 Debris / Impact Extent (20.4 ha)' 
            : (p.description || p.hazard_type || 'Disaster Hazard Corridor');

          layer.bindTooltip(`
            <div style="font-family: Inter, sans-serif; font-size: 11px; padding: 2px;">
              <strong style="color: #b91c1c; font-weight: 800;">[HAZARD] ${title}</strong><br/>
              <span style="font-size: 10px; color: #475569;">${p.source || 'Satellite Sensor Analysis'}</span>
            </div>
          `, { sticky: false, direction: 'center', opacity: 0.9 });

          layer.bindPopup(`
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; min-width: 230px;">
              <div style="font-weight: 800; color: #b91c1c; margin-bottom: 4px; font-size: 13px;">
                ⚠️ ${title}
              </div>
              <div style="font-size: 11px; color: #334155; margin-bottom: 6px; line-height: 1.35;">
                ${p.description || 'Primary delineated impact / hazard corridor'}
              </div>
              <div style="background: #fef2f2; border: 1px solid #fee2e2; border-radius: 4px; padding: 4px 6px; font-size: 10px; color: #991b1b;">
                <strong>Severity:</strong> ${p.severity || 'CRITICAL'} &bull; <strong>Source:</strong> ${p.source || 'Geospatial Analysis'}
              </div>
            </div>
          `);
        }
      });
      hazardZones.addLayer(hzLayer);
      safeExtendBounds(hzLayer);
    }

    // A2. Operational Zones Layer (Macro / Sector Overview)
    if ((viewLevel === 'ZONES' || viewLevel === 'BOTH') && layers.zones && rawDataRef.current.zones?.features) {
      const zoneLayer = L.geoJSON(rawDataRef.current.zones, {
        style: (feat) => {
          const crit = (feat.properties?.criticality || 'LOW').toUpperCase();
          const isSelected = selectedZone?.id === feat.properties?.id;
          const isAnySelected = selectedZone !== null;
          const col = PRIORITY_COLORS[crit] || '#059669';

          let fillOpacity = 0.22;
          let strokeOpacity = 0.90;
          if (isAnySelected) {
            fillOpacity = isSelected ? 0.38 : 0.06;
            strokeOpacity = isSelected ? 1.0 : 0.35;
          }

          return {
            color: isSelected ? '#ffffff' : col,
            weight: isSelected ? 4.5 : (crit === 'CRITICAL' ? 3.5 : 2.5),
            opacity: strokeOpacity,
            dashArray: crit === 'CRITICAL' ? '6, 4' : null,
            fillColor: col,
            fillOpacity: fillOpacity
          };
        },
        onEachFeature: (feat, layer) => {
          const p = feat.properties || {};
          const crit = p.criticality || 'LOW';
          const col = PRIORITY_COLORS[crit] || '#059669';

          layer.on({
            mouseover: (e) => e.target.setStyle({ weight: 4, fillOpacity: 0.28, opacity: 1.0 }),
            mouseout: (e) => {
              if (selectedZone?.id !== p.id) {
                zoneLayer.resetStyle(e.target);
              }
            },
            click: () => {
              setSelectedZone(p);
              setSelectedBuilding(null);
              if (layer.getBounds && layer.getBounds().isValid()) {
                map.fitBounds(layer.getBounds(), { padding: [40, 40] });
              }
            }
          });

          layer.bindTooltip(`
            <div style="font-family: Inter, sans-serif; font-size: 11px;">
              <strong style="color: ${col}; font-weight: 800;">[${crit}] ${p.zoneCode || ''}</strong><br/>
              <strong>${p.name}</strong><br/>
              Evaluated: <strong>${p.totalBuildings}</strong> | Destroyed: <strong>${p.destroyedCount}</strong><br/>
              Criticality Index: <strong>${((p.criticalityScore || 0) * 100).toFixed(0)}%</strong>
            </div>
          `, { sticky: false, direction: 'center' });

          // Visible centroid badge marker on map (staggered to guarantee zero collision)
          if (layer.getBounds && layer.getBounds().isValid()) {
            const b = layer.getBounds();
            const south = b.getSouth();
            const north = b.getNorth();
            const span = north - south;
            const factor = crit === 'CRITICAL' ? 0.82 : (crit === 'HIGH' ? 0.62 : (crit === 'MEDIUM' ? 0.38 : 0.18));
            const badgeLat = span > 0.005 ? (south + span * factor) : b.getCenter().lat;
            const center = L.latLng(badgeLat, b.getCenter().lng);

            const displayName = p.name ? p.name.split('—')[0].split('-')[0].trim() : '';
            const badgeHtml = `
              <div style="
                background: ${isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)'};
                border: 2px solid ${col};
                color: ${isDark ? '#f8fafc' : '#0f172a'};
                padding: 3px 8px;
                border-radius: 6px;
                font-family: Inter, sans-serif;
                font-size: 11px;
                font-weight: 700;
                white-space: nowrap;
                box-shadow: 0 4px 14px rgba(0,0,0,0.45);
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 6px;
                pointer-events: auto;
              ">
                <span style="background: ${col}; color: #ffffff; padding: 2px 5px; border-radius: 3px; font-weight: 800; font-size: 10px;">${crit}</span>
                <span style="font-weight: 700; color: ${isDark ? '#f1f5f9' : '#1e293b'};">${displayName}</span>
                <span style="font-size: 10px; color: ${col}; font-weight: 800;">(${p.totalBuildings || 0})</span>
              </div>
            `;
            const icon = L.divIcon({
              html: badgeHtml,
              className: 'zone-centroid-badge',
              iconSize: [160, 30],
              iconAnchor: [80, 15]
            });
            const marker = L.marker(center, { icon, interactive: true });
            marker.on('click', () => {
              setSelectedZone(p);
              setSelectedBuilding(null);
              if (layer.getBounds && layer.getBounds().isValid()) {
                map.fitBounds(layer.getBounds(), { padding: [40, 40] });
              }
            });
            zones.addLayer(marker);
          }
        }
      });
      zones.addLayer(zoneLayer);
      safeExtendBounds(zoneLayer);
    }

    // Helper: Determine building visibility based on viewLevel
    const isBuildingVisible = (bldgId) => {
      if (viewLevel === 'BUILDINGS' || viewLevel === 'BOTH') return true;
      if (viewLevel === 'ZONES') {
        if (!selectedZone) return true;
        const cIds = Array.isArray(selectedZone.constituentBuildingIds)
          ? selectedZone.constituentBuildingIds
          : (Array.isArray(selectedZone.constituent_building_ids)
            ? selectedZone.constituent_building_ids
            : []);
        return cIds.length === 0 || cIds.includes(bldgId);
      }
      return true;
    };

    // Helper: compute centroid point for polygon
    const getPolygonCentroid = (geometry) => {
      if (!geometry) return [0, 0];
      if (geometry.type === 'Point') return geometry.coordinates;
      if (geometry.coordinates && geometry.coordinates[0]) {
        const ring = geometry.coordinates[0];
        let sLon = 0, sLat = 0;
        ring.forEach(c => { sLon += c[0]; sLat += c[1]; });
        return [sLon / ring.length, sLat / ring.length];
      }
      return [0, 0];
    };

    const isFani = selectedScenarioId === 3;
    const isChamoli = selectedScenarioId === 2;
    const isDharali = selectedScenarioId === 4;

    // B. Damage Assessment Layer (01 ASSESS)
    if (mapMode === 'DAMAGE' && layers.damages && rawDataRef.current.damages?.features) {
      const filtered = rawDataRef.current.damages.features.filter(feat => {
        const p = feat.properties || {};
        const bId = p.buildingId || p.id;
        if (!isBuildingVisible(bId)) return false;
        const dClass = p.damageClass || 'no-damage';
        const conf = p.confidence ?? 1.0;
        if (damageFilter !== 'ALL' && dClass !== damageFilter) return false;
        if (conf < confidenceThreshold) return false;
        return true;
      });

      // For Fani, convert polygon geometries to point centroids so they are strictly rendered as point observations
      const processedFeatures = filtered.map(feat => {
        if (isFani && feat.geometry && feat.geometry.type !== 'Point') {
          const pt = getPolygonCentroid(feat.geometry);
          return {
            ...feat,
            geometry: { type: 'Point', coordinates: pt },
            properties: { ...feat.properties, originalGeometry: feat.geometry, isPointObservation: true }
          };
        }
        return feat;
      });

      const dmgLayer = L.geoJSON({ type: 'FeatureCollection', features: processedFeatures }, {
        pointToLayer: (feat, latlng) => {
          const dClass = feat.properties?.damageClass || 'no-damage';
          const col = DAMAGE_COLORS[dClass] || '#94a3b8';
          const bId = feat.properties?.buildingId || feat.properties?.id;
          const cIds = selectedZone ? (selectedZone.constituentBuildingIds || selectedZone.constituent_building_ids || []) : [];
          const isConstituent = selectedZone && cIds.includes(bId);
          return L.circleMarker(latlng, {
            radius: isConstituent ? 9 : 7,
            color: isConstituent ? '#ffffff' : '#0f172a',
            weight: isConstituent ? 3 : 2,
            fillColor: col,
            fillOpacity: selectedZone ? (isConstituent ? 0.95 : 0.30) : 0.88
          });
        },
        style: (feat) => {
          const dClass = feat.properties?.damageClass || 'no-damage';
          const col = DAMAGE_COLORS[dClass] || '#94a3b8';
          const bId = feat.properties?.buildingId || feat.properties?.id;
          const cIds = selectedZone ? (selectedZone.constituentBuildingIds || selectedZone.constituent_building_ids || []) : [];
          const isConstituent = selectedZone && cIds.includes(bId);
          return {
            color: isConstituent ? '#ffffff' : '#1e293b',
            weight: isConstituent ? 3 : 1.6,
            fillColor: col,
            fillOpacity: selectedZone ? (isConstituent ? 0.90 : 0.25) : 0.65 // translucent so satellite imagery is never occluded
          };
        },
        onEachFeature: (feat, layer) => {
          const p = feat.properties || {};
          const dClass = p.damageClass || 'no-damage';
          const conf = p.confidence ? (p.confidence * 100).toFixed(1) : '100.0';
          const geomToSave = p.originalGeometry || feat.geometry;

          layer.on({
            mouseover: (e) => {
              if (layer.setStyle) layer.setStyle({ weight: 3.5, fillOpacity: 0.90 });
            },
            mouseout: (e) => {
              if (dmgLayer.resetStyle) dmgLayer.resetStyle(e.target);
            },
            click: () => {
              const priMatch = rawDataRef.current.priorities?.features?.find(f => f.properties?.building_id === p.buildingId || f.properties?.id === p.id);
              setSelectedBuilding({
                ...p,
                geometry: geomToSave,
                priorityInfo: priMatch?.properties
              });
            }
          });

          const evidenceLabel = isChamoli 
            ? 'Verified Reference Footprint (EIDC)'
            : isFani 
              ? 'Point-Based Damage Grading (EMSR357 / OSDMA)'
              : isDharali 
                ? 'Qualitative Zero-Shot Footprint (Open Buildings)'
                : 'xBD Supervised Benchmark';

          layer.bindPopup(`
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; min-width: 190px;">
              <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                Structure #${p.id || p.buildingId}
              </div>
              <div style="font-size: 10px; color: #64748b; margin-bottom: 4px;">
                ${evidenceLabel}
              </div>
              <div>Severity: <strong style="color: ${DAMAGE_COLORS[dClass]}; text-transform: uppercase;">${DAMAGE_LABELS[dClass] || dClass}</strong></div>
              <div>Confidence: <strong>${conf}%</strong></div>
            </div>
          `);
        }
      });
      damages.addLayer(dmgLayer);
      safeExtendBounds(dmgLayer);
    }

    // C. Priority Analysis Layer (02 PRIORITISE & 03 RESPOND)
    if ((mapMode === 'PRIORITY' || mapMode === 'ROUTING') && layers.priorities && rawDataRef.current.priorities?.features) {
      const filtered = rawDataRef.current.priorities.features.filter(feat => {
        const p = feat.properties || {};
        const bId = p.building_id || p.id;
        if (!isBuildingVisible(bId)) return false;
        const lvl = p.priority_level || 'LOW';
        if (priorityFilter !== 'ALL' && lvl !== priorityFilter) return false;
        return true;
      });

      const processedPriFeatures = filtered.map(feat => {
        if (isFani && feat.geometry && feat.geometry.type !== 'Point') {
          const pt = getPolygonCentroid(feat.geometry);
          return {
            ...feat,
            geometry: { type: 'Point', coordinates: pt },
            properties: { ...feat.properties, originalGeometry: feat.geometry, isPointObservation: true }
          };
        }
        return feat;
      });

      const priLayer = L.geoJSON({ type: 'FeatureCollection', features: processedPriFeatures }, {
        pointToLayer: (feat, latlng) => {
          const lvl = feat.properties?.priority_level || 'LOW';
          const col = PRIORITY_COLORS[lvl] || '#059669';
          const bId = feat.properties?.building_id || feat.properties?.id;
          const cIds = selectedZone ? (selectedZone.constituentBuildingIds || selectedZone.constituent_building_ids || []) : [];
          const isConstituent = selectedZone && cIds.includes(bId);
          return L.circleMarker(latlng, {
            radius: isConstituent ? 10 : 8,
            color: isConstituent ? '#ffffff' : '#0f172a',
            weight: isConstituent ? 3 : 2,
            fillColor: col,
            fillOpacity: selectedZone ? (isConstituent ? 0.98 : 0.30) : 0.90
          });
        },
        style: (feat) => {
          const lvl = feat.properties?.priority_level || 'LOW';
          const col = PRIORITY_COLORS[lvl] || '#059669';
          const bId = feat.properties?.building_id || feat.properties?.id;
          const cIds = selectedZone ? (selectedZone.constituentBuildingIds || selectedZone.constituent_building_ids || []) : [];
          const isConstituent = selectedZone && cIds.includes(bId);
          return {
            color: isConstituent ? '#ffffff' : '#0f172a',
            weight: isConstituent ? 3 : 2,
            fillColor: col,
            fillOpacity: selectedZone ? (isConstituent ? 0.92 : 0.25) : 0.70
          };
        },
        onEachFeature: (feat, layer) => {
          const p = feat.properties || {};
          const lvl = p.priority_level || 'LOW';
          const score = (p.priority_score * 100).toFixed(0);
          const geomToSave = p.originalGeometry || feat.geometry;

          layer.on({
            mouseover: (e) => {
              if (layer.setStyle) layer.setStyle({ weight: 4, fillOpacity: 0.95 });
            },
            mouseout: (e) => {
              if (priLayer.resetStyle) priLayer.resetStyle(e.target);
            },
            click: () => {
              const dmgMatch = rawDataRef.current.damages?.features?.find(f => f.properties?.buildingId === p.building_id || f.properties?.id === p.id);
              setSelectedBuilding({
                ...p,
                ...(dmgMatch?.properties || {}),
                geometry: geomToSave,
                priorityInfo: p
              });
            }
          });

          layer.bindPopup(`
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px; min-width: 190px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <strong style="color: ${PRIORITY_COLORS[lvl]}; font-size: 12px;">${lvl} PRIORITY</strong>
                <span style="background: #0f172a; color: #fff; padding: 1px 5px; border-radius: 3px; font-size: 10px; font-weight: 700;">${score}%</span>
              </div>
              <div style="font-size: 11px; margin-bottom: 4px;">Structure ID: <strong>#${p.building_id || p.id}</strong></div>
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px 6px; font-size: 10px;">
                ${p.explanation || 'Multi-factor triage score.'}
              </div>
            </div>
          `);
        }
      });
      priorities.addLayer(priLayer);
      safeExtendBounds(priLayer);
    }

    // D. Ground Truth Footprints Layer
    if (layers.buildings && rawDataRef.current.buildings?.features) {
      const bldgLayer = L.geoJSON(rawDataRef.current.buildings, {
        style: () => ({
          color: '#0284c7',
          weight: 1.5,
          dashArray: '4, 4',
          fillColor: '#0284c7',
          fillOpacity: 0.12
        })
      });
      buildings.addLayer(bldgLayer);
      safeExtendBounds(bldgLayer);
    }

    // E. Road Network Layer
    if (layers.roads && rawDataRef.current.roads?.features) {
      const roadLayer = L.geoJSON(rawDataRef.current.roads, {
        style: (feat) => {
          const isBlocked = feat.properties?.isBlocked;
          return {
            color: isBlocked ? '#7c3aed' : '#334155',
            weight: isBlocked ? 4.5 : 2.5,
            dashArray: isBlocked ? '6, 6' : null,
            opacity: 0.88
          };
        },
        onEachFeature: (feat, layer) => {
          const p = feat.properties || {};
          const status = p.isBlocked ? '⛔ BLOCKED (Hazard Corridor)' : '🟢 Passable Route';
          layer.bindPopup(`
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px;">
              <strong>${p.name || 'Highway Corridor'}</strong><br/>
              Status: <span style="font-weight: 700; color: ${p.isBlocked ? '#7c3aed' : '#10b981'};">${status}</span><br/>
              ${p.isBlocked ? `Hazard: <em>${p.blockReason || 'Roadway obstruction'}</em><br/>` : ''}
              Type: ${p.highwayType || 'primary'}
            </div>
          `);
        }
      });
      roads.addLayer(roadLayer);
      safeExtendBounds(roadLayer);
    }

    // F. Hospitals Layer
    if (layers.hospitals && rawDataRef.current.hospitals?.features) {
      const hospLayer = L.geoJSON(rawDataRef.current.hospitals, {
        pointToLayer: (feat, latlng) => {
          const icon = L.divIcon({
            html: `<div style="background-color: #dc2626; color: white; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.3);">+</div>`,
            className: 'hospital-marker',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          });
          return L.marker(latlng, { icon });
        },
        onEachFeature: (feat, layer) => {
          const p = feat.properties || {};
          layer.bindPopup(`
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px;">
              <strong style="color: #dc2626; font-size: 13px;">${p.name || 'Hospital'}</strong><br/>
              Status: 🟢 Operational<br/>
              Capacity: <strong>${p.capacity || '40'} beds</strong><br/>
              Phone: ${p.phone || '911'}
            </div>
          `);
        }
      });
      hospitals.addLayer(hospLayer);
      safeExtendBounds(hospLayer);
    }

    // G. Relief Shelters Layer
    if (layers.shelters && rawDataRef.current.shelters?.features) {
      const sheltLayer = L.geoJSON(rawDataRef.current.shelters, {
        pointToLayer: (feat, latlng) => {
          const icon = L.divIcon({
            html: `<div style="background-color: #0284c7; color: white; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.3);">⛺</div>`,
            className: 'shelter-marker',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          });
          return L.marker(latlng, { icon });
        },
        onEachFeature: (feat, layer) => {
          const p = feat.properties || {};
          layer.bindPopup(`
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 12px;">
              <strong style="color: #0284c7; font-size: 13px;">${p.name || 'Shelter'}</strong><br/>
              Status: 🟢 Open Relief Shelter<br/>
              Capacity: <strong>${p.capacity || '500'} evacuees</strong><br/>
              Type: ${p.shelterType || 'Designated Refuge Area'}
            </div>
          `);
        }
      });
      shelters.addLayer(sheltLayer);
      safeExtendBounds(sheltLayer);
    }

    // H. Emergency Alerts (OASIS CAP 1.2) Layer
    const alertsGroup = layerGroupsRef.current.alerts;
    alertsGroup.clearLayers();

    if (layers.alerts && rawDataRef.current.alerts && rawDataRef.current.alerts.length > 0) {
      rawDataRef.current.alerts.forEach(alert => {
        if (!alert.geometry) return;

        const isExtreme = alert.severity === 'Extreme';
        const alertCol = isExtreme ? '#ef4444' : '#f59e0b';

        // 1. Red/Amber alert polygon with glowing dashed border
        const aLayer = L.geoJSON(alert.geometry, {
          style: {
            color: alertCol,
            weight: 3.5,
            dashArray: '6, 6',
            fillColor: alertCol,
            fillOpacity: 0.20
          }
        });

        // 2. Centroid siren marker badge
        const pt = getPolygonCentroid(alert.geometry);
        if (pt && pt[0] && pt[1]) {
          const alertIcon = L.divIcon({
            html: `
              <div class="alert-beacon-strobe" style="
                display: flex;
                align-items: center;
                gap: 5px;
                background-color: #0f172a;
                color: #ffffff;
                padding: 4px 8px;
                border-radius: 6px;
                font-size: 10px;
                font-weight: 800;
                border: 2px solid ${alertCol};
                box-shadow: 0 0 16px ${alertCol};
                white-space: nowrap;
                cursor: pointer;
              ">
                <span class="alert-beacon-dot" style="background-color: ${alertCol};"></span>
                <span>🚨 ${alert.event || 'CAP 1.2 ALERT'}</span>
              </div>
            `,
            className: 'cap-alert-marker',
            iconSize: [160, 26],
            iconAnchor: [80, 13]
          });

          const m = L.marker([pt[1], pt[0]], { icon: alertIcon });
          m.on('click', () => {
            setSelectedCapAlert(alert);
            setIsAlertDrawerOpen(true);
          });
          alertsGroup.addLayer(m);
        }

        aLayer.on('click', () => {
          setSelectedCapAlert(alert);
          setIsAlertDrawerOpen(true);
        });

        alertsGroup.addLayer(aLayer);
        safeExtendBounds(aLayer);
      });
    }

    // If no route is active, fit cleanly to operational sectors / incident area
    if (!activeRoute) {
      const activeBounds = L.latLngBounds();
      if (layerGroupsRef.current.zones.getLayers().length > 0) {
        layerGroupsRef.current.zones.eachLayer(l => {
          if (typeof l.getBounds === 'function' && l.getBounds().isValid()) {
            activeBounds.extend(l.getBounds());
          }
        });
      } else if (layerGroupsRef.current.damages.getLayers().length > 0) {
        layerGroupsRef.current.damages.eachLayer(l => {
          if (typeof l.getBounds === 'function' && l.getBounds().isValid()) {
            activeBounds.extend(l.getBounds());
          }
        });
      }

      if (activeBounds.isValid()) {
        map.fitBounds(activeBounds, { padding: [35, 35] });
      } else if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    }
  }

  // 5. Calculate and Prominently Draw Route on Map
  async function calculateRoute(mode = 'RESPONSE', customDest = null, overrideBuilding = null) {
    const targetBldg = overrideBuilding || selectedBuilding;
    if (!targetBldg || !targetBldg.geometry) {
      // If a zone is selected, attempt to use its highest priority building
      if (selectedZone && selectedZone.highestPriorityBuildingId) {
        const bMatch = rawDataRef.current.damages?.features?.find(f => (f.properties?.buildingId || f.properties?.id) === selectedZone.highestPriorityBuildingId);
        const priMatch = rawDataRef.current.priorities?.features?.find(f => (f.properties?.building_id || f.properties?.id) === selectedZone.highestPriorityBuildingId);
        if (bMatch) {
          const autoBldg = {
            ...bMatch.properties,
            id: selectedZone.highestPriorityBuildingId,
            geometry: bMatch.geometry,
            priorityInfo: priMatch?.properties
          };
          setSelectedBuilding(autoBldg);
          return calculateRoute(mode, customDest, autoBldg);
        }
      }
      setError('Please select a priority building footprint on the map first.');
      return;
    }

    setRoutingLoading(true);
    setError(null);

    const actualMode = mode || responseRouteType;
    const destCategory = customDest || evacDestType;

    try {
      let bldgLon = 0, bldgLat = 0;
      if (targetBldg.geometry.type === 'Point') {
        bldgLon = targetBldg.geometry.coordinates[0];
        bldgLat = targetBldg.geometry.coordinates[1];
      } else if (targetBldg.geometry.coordinates && targetBldg.geometry.coordinates[0]) {
        const coords = targetBldg.geometry.coordinates[0];
        let sumLon = 0, sumLat = 0;
        coords.forEach(c => { sumLon += c[0]; sumLat += c[1]; });
        bldgLon = sumLon / coords.length;
        bldgLat = sumLat / coords.length;
      }

      const bldgId = targetBldg.id || targetBldg.buildingId || targetBldg.building_id;
      const resp = await api.post('/routes', {
        scenarioId: selectedScenarioId,
        priorityId: bldgId,
        originLon: bldgLon,
        originLat: bldgLat,
        destinationType: destCategory,
        avoidBlocked: avoidBlockedRoads,
        routePurpose: actualMode
      });

      const routeData = resp.data;
      setActiveRoute(routeData);

      const map = mapInstanceRef.current;
      const routeGlow = layerGroupsRef.current.routeGlow;
      const routeGroup = layerGroupsRef.current.route;
      const markersGroup = layerGroupsRef.current.routeMarkers;

      routeGlow.clearLayers();
      routeGroup.clearLayers();
      markersGroup.clearLayers();

      if (routeData.routeGeoJson && map) {
        const isResponseAccess = actualMode.toUpperCase() === 'RESPONSE';
        const primaryColor = isResponseAccess ? '#d97706' : '#0284c7';
        const glowColor = isResponseAccess ? '#fef3c7' : '#e0f2fe';

        // 1. Heavy Glow Underlay Line
        const glowLayer = L.geoJSON(routeData.routeGeoJson, {
          style: {
            color: glowColor,
            weight: 10,
            opacity: 0.8
          }
        });
        routeGlow.addLayer(glowLayer);

        // 2. High-Contrast Main Route Line
        const rLayer = L.geoJSON(routeData.routeGeoJson, {
          style: {
            color: primaryColor,
            weight: 6,
            opacity: 0.98
          }
        });
        routeGroup.addLayer(rLayer);

        // 3. Clear Origin & Destination Markers with Labels
        const coordsList = routeData.routeGeoJson.geometry.coordinates;
        if (coordsList.length >= 2) {
          const startPt = coordsList[0];
          const endPt = coordsList[coordsList.length - 1];

          if (isResponseAccess) {
            // Origin = Staging Base
            const stagingIcon = L.divIcon({
              html: `<div style="background-color: #0f172a; color: white; padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; border: 2px solid #f59e0b; box-shadow: 0 2px 6px rgba(0,0,0,0.5); white-space: nowrap;">🏢 STAGING POINT</div>`,
              className: 'route-staging-marker',
              iconSize: [100, 24],
              iconAnchor: [50, 12]
            });
            markersGroup.addLayer(L.marker([startPt[1], startPt[0]], { icon: stagingIcon }));

            // Destination = Priority Structure Target
            const targetIcon = L.divIcon({
              html: `<div style="background-color: #0f172a; color: white; padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; border: 2px solid #ef4444; box-shadow: 0 2px 6px rgba(0,0,0,0.5); white-space: nowrap;">🎯 PRIORITY TARGET #${bldgId}</div>`,
              className: 'route-target-marker',
              iconSize: [120, 24],
              iconAnchor: [60, 12]
            });
            markersGroup.addLayer(L.marker([endPt[1], endPt[0]], { icon: targetIcon }));
          } else {
            // Origin = Structure
            const originIcon = L.divIcon({
              html: `<div style="background-color: #0f172a; color: white; padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; border: 2px solid #38bdf8; box-shadow: 0 2px 6px rgba(0,0,0,0.5); white-space: nowrap;">📍 ORIGIN #${bldgId}</div>`,
              className: 'route-origin-marker',
              iconSize: [100, 24],
              iconAnchor: [50, 12]
            });
            markersGroup.addLayer(L.marker([startPt[1], startPt[0]], { icon: originIcon }));

            // Destination = Hospital / Shelter
            const destIcon = L.divIcon({
              html: `<div style="background-color: #0284c7; color: white; padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.5); white-space: nowrap;">🏥 ${routeData.destinationName}</div>`,
              className: 'route-dest-marker',
              iconSize: [120, 24],
              iconAnchor: [60, 12]
            });
            markersGroup.addLayer(L.marker([endPt[1], endPt[0]], { icon: destIcon }));
          }
        }

        // 4. Automatically zoom / fit bounds to the full route
        map.fitBounds(rLayer.getBounds(), { padding: [60, 60] });
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'NO ACCESSIBLE ROUTE FOUND — All corridors are obstructed.');
    } finally {
      setRoutingLoading(false);
    }
  }

  function clearRoute() {
    layerGroupsRef.current.routeGlow.clearLayers();
    layerGroupsRef.current.route.clearLayers();
    layerGroupsRef.current.routeMarkers.clearLayers();
    setActiveRoute(null);
  }

  // 6. Emergency Alert System Action Handlers
  const playEmergencySiren = () => {
    if (sirenPlaying) {
      if (window._drasSirenOsc) {
        try { window._drasSirenOsc.stop(); } catch(e){}
      }
      setSirenPlaying(false);
      return;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      const now = ctx.currentTime;
      for (let i = 0; i < 6; i++) {
        osc.frequency.setValueAtTime(550, now + i * 0.8);
        osc.frequency.exponentialRampToValueAtTime(1000, now + i * 0.8 + 0.4);
        osc.frequency.exponentialRampToValueAtTime(550, now + i * 0.8 + 0.8);
      }
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      window._drasSirenOsc = osc;
      setSirenPlaying(true);
      setTimeout(() => {
        try { osc.stop(); } catch(e){}
        setSirenPlaying(false);
      }, 4800);
    } catch(e) {
      console.warn('Audio siren unavailable:', e);
    }
  };

  const handleBroadcastZoneCap = async (zoneId) => {
    try {
      const resp = await api.post(`/emergency/alerts/generate-from-zone/${zoneId}`);
      if (resp.data) {
        // Refresh alerts
        const updated = await api.get(`/emergency/alerts/scenario/${selectedScenarioId}`);
        const freshAlerts = updated.data || [];
        rawDataRef.current.alerts = freshAlerts;
        setAlerts(freshAlerts);
        renderLayers();

        // Highlight created alert
        const created = freshAlerts.find(a => a.targetZoneId === parseInt(zoneId)) || resp.data;
        setSelectedCapAlert(created);
        setIsAlertDrawerOpen(true);

        setBroadcastToast(`🚨 OASIS CAP 1.2 BROADCAST TRANSMITTED: ${resp.data.headline || 'Evacuation Order Issued'}`);
        setTimeout(() => setBroadcastToast(null), 6000);
      }
    } catch (err) {
      setError(`Failed to broadcast CAP alert: ${err.message}`);
    }
  };

  const handleFetchCapXml = async (alertId) => {
    setCapXmlLoading(true);
    try {
      const res = await fetch(`http://localhost:8081/api/emergency/alerts/${alertId}/cap.xml`);
      if (res.ok) {
        const text = await res.text();
        setSelectedCapXml(text);
      }
    } catch (err) {
      console.error('Failed to load CAP XML:', err);
    } finally {
      setCapXmlLoading(false);
    }
  };

  const handleLocateAlert = (alert) => {
    if (!alert || !alert.geometry) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    try {
      const aLyr = L.geoJSON(alert.geometry);
      if (aLyr.getBounds().isValid()) {
        map.fitBounds(aLyr.getBounds(), { padding: [50, 50], maxZoom: 16 });
      }
      setSelectedCapAlert(alert);
    } catch (e) {
      console.error('Error locating alert:', e);
    }
  };

  const handleTurnOffAlerts = () => {
    if (sirenPlaying) {
      if (window._drasSirenOsc) {
        try { window._drasSirenOsc.stop(); } catch(e){}
      }
      setSirenPlaying(false);
    }
    if (layerGroupsRef.current?.alerts) {
      layerGroupsRef.current.alerts.clearLayers();
    }
    setIsAlertSystemMuted(true);
    setLayers(prev => ({ ...prev, alerts: false }));
    setBroadcastToast('🔕 Emergency alerts turned OFF from map & siren silenced');
    setTimeout(() => setBroadcastToast(null), 3500);
  };

  const handleTurnOnAlerts = () => {
    setIsAlertSystemMuted(false);
    setLayers(prev => ({ ...prev, alerts: true }));
    setIsAlertBannerDismissed(false);
    setBroadcastToast('🔔 Emergency alerts turned ON on map');
    setTimeout(() => setBroadcastToast(null), 3500);
  };

  const toggleAlertSystemMaster = () => {
    if (layers.alerts) {
      handleTurnOffAlerts();
    } else {
      handleTurnOnAlerts();
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 52px)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', backgroundColor: tokens.bgPrimary, color: tokens.textPrimary, overflow: 'hidden' }}>
      
      {/* ============================================================ */}
      {/* LEFT COLUMN: Controls, Phases & Layer Toggles (270px)        */}
      {/* ============================================================ */}
      <div style={{
        width: '270px',
        backgroundColor: tokens.bgSecondary,
        borderRight: `1px solid ${tokens.border}`,
        padding: '14px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        zIndex: 10,
        color: tokens.textPrimary
      }}>
        
        {/* Scenario Selector */}
        {/* Scenario Selector */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0284c7' }}></span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#0284c7', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Evaluation Scenario
            </span>
          </div>
          <select
            value={selectedScenarioId}
            onChange={(e) => {
              const newId = Number(e.target.value);
              setSelectedScenarioId(newId);
              navigate(`/scenario/${newId}/map`);
            }}
            style={{
              width: '100%',
              padding: '6px 8px',
              borderRadius: '6px',
              border: `1px solid ${tokens.inputBorder || tokens.border}`,
              fontSize: '11px',
              fontWeight: 600,
              color: tokens.textPrimary,
              backgroundColor: tokens.inputBg || tokens.bgTertiary
            }}
          >
            {scenarios.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Map Dimension Toggle: [ 2D Map ] [ 3D Globe ] */}
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: tokens.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Map Projection
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', backgroundColor: tokens.bgTertiary, padding: '3px', borderRadius: '6px', border: `1px solid ${tokens.border}` }}>
            <button
              onClick={() => setMapViewMode('2D')}
              style={{
                padding: '6px 4px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: mapViewMode === '2D' ? (isDark ? '#0284c7' : '#0f172a') : 'transparent',
                color: mapViewMode === '2D' ? '#ffffff' : tokens.textSecondary,
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              🗺️ 2D Map
            </button>
            <button
              onClick={() => setMapViewMode('3D')}
              style={{
                padding: '6px 4px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: mapViewMode === '3D' ? (isDark ? '#0284c7' : '#0f172a') : 'transparent',
                color: mapViewMode === '3D' ? '#ffffff' : tokens.textSecondary,
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              🌐 3D Globe
            </button>
          </div>
        </div>

        {/* Spatial View Mode: [ Buildings ] [ Zones ] [ Both ] */}
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: tokens.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Spatial View Mode
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '3px', backgroundColor: tokens.bgTertiary, padding: '3px', borderRadius: '6px', border: `1px solid ${tokens.border}` }}>
            <button
              onClick={() => setViewLevel('BUILDINGS')}
              style={{
                padding: '6px 2px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: viewLevel === 'BUILDINGS' ? (isDark ? '#0284c7' : '#0f172a') : 'transparent',
                color: viewLevel === 'BUILDINGS' ? '#ffffff' : tokens.textSecondary,
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Buildings
            </button>
            <button
              onClick={() => setViewLevel('ZONES')}
              style={{
                padding: '6px 2px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: viewLevel === 'ZONES' ? (isDark ? '#0284c7' : '#0f172a') : 'transparent',
                color: viewLevel === 'ZONES' ? '#ffffff' : tokens.textSecondary,
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Zones
            </button>
            <button
              onClick={() => setViewLevel('BOTH')}
              style={{
                padding: '6px 2px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: viewLevel === 'BOTH' ? (isDark ? '#0284c7' : '#0f172a') : 'transparent',
                color: viewLevel === 'BOTH' ? '#ffffff' : tokens.textSecondary,
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Both
            </button>
          </div>
        </div>

        {/* 3-Step Conceptual Workflow: 01 ASSESS / 02 PRIORITISE / 03 RESPOND */}
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: tokens.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Operational Phase
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              onClick={() => { setMapMode('DAMAGE'); clearRoute(); }}
              style={{
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: mapMode === 'DAMAGE' ? (isDark ? '#38bdf8' : '#0f172a') : tokens.border,
                backgroundColor: mapMode === 'DAMAGE' ? (isDark ? '#1e3a8a' : '#0f172a') : tokens.bgCard,
                color: mapMode === 'DAMAGE' ? '#ffffff' : tokens.textPrimary,
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ backgroundColor: mapMode === 'DAMAGE' ? (isDark ? '#2563eb' : '#334155') : tokens.bgTertiary, color: mapMode === 'DAMAGE' ? '#fff' : tokens.textSecondary, fontSize: '9px', padding: '2px 5px', borderRadius: '3px' }}>
                01
              </span>
              <span><strong>ASSESS</strong> — Damage Assessment</span>
            </button>

            <button
              onClick={() => { setMapMode('PRIORITY'); clearRoute(); }}
              style={{
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: mapMode === 'PRIORITY' ? (isDark ? '#38bdf8' : '#0f172a') : tokens.border,
                backgroundColor: mapMode === 'PRIORITY' ? (isDark ? '#1e3a8a' : '#0f172a') : tokens.bgCard,
                color: mapMode === 'PRIORITY' ? '#ffffff' : tokens.textPrimary,
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ backgroundColor: mapMode === 'PRIORITY' ? (isDark ? '#2563eb' : '#334155') : tokens.bgTertiary, color: mapMode === 'PRIORITY' ? '#fff' : tokens.textSecondary, fontSize: '9px', padding: '2px 5px', borderRadius: '3px' }}>
                02
              </span>
              <span><strong>PRIORITISE</strong> — Impact & Triage</span>
            </button>

            <button
              onClick={() => setMapMode('ROUTING')}
              style={{
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: mapMode === 'ROUTING' ? (isDark ? '#38bdf8' : '#0f172a') : tokens.border,
                backgroundColor: mapMode === 'ROUTING' ? (isDark ? '#1e3a8a' : '#0f172a') : tokens.bgCard,
                color: mapMode === 'ROUTING' ? '#ffffff' : tokens.textPrimary,
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ backgroundColor: mapMode === 'ROUTING' ? (isDark ? '#2563eb' : '#334155') : tokens.bgTertiary, color: mapMode === 'ROUTING' ? '#fff' : tokens.textSecondary, fontSize: '9px', padding: '2px 5px', borderRadius: '3px' }}>
                03
              </span>
              <span><strong>RESPOND</strong> — Response & Routing</span>
            </button>
          </div>
        </div>

        {/* Phase 03: Response Mode Route Type Selector */}
        {mapMode === 'ROUTING' && (
          <div style={{ backgroundColor: tokens.bgTertiary, padding: '10px', borderRadius: '6px', border: `1px solid ${tokens.border}` }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: tokens.textPrimary, textTransform: 'uppercase', marginBottom: '6px' }}>
              Route Type
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="routeType"
                  value="RESPONSE"
                  checked={responseRouteType === 'RESPONSE'}
                  onChange={() => { setResponseRouteType('RESPONSE'); if (selectedBuilding) calculateRoute('RESPONSE'); }}
                />
                <span style={{ fontWeight: responseRouteType === 'RESPONSE' ? 700 : 500, color: responseRouteType === 'RESPONSE' ? '#d97706' : tokens.textSecondary }}>
                  Response Access (Staging → Site)
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="routeType"
                  value="EVACUATION"
                  checked={responseRouteType === 'EVACUATION'}
                  onChange={() => { setResponseRouteType('EVACUATION'); if (selectedBuilding) calculateRoute('EVACUATION'); }}
                />
                <span style={{ fontWeight: responseRouteType === 'EVACUATION' ? 700 : 500, color: responseRouteType === 'EVACUATION' ? '#0284c7' : tokens.textSecondary }}>
                  Evacuation (Site → Facility)
                </span>
              </label>
            </div>

            {responseRouteType === 'EVACUATION' && (
              <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: `1px solid ${tokens.border}`, display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => { setEvacDestType('hospital'); if (selectedBuilding) calculateRoute('EVACUATION', 'hospital'); }}
                  style={{
                    flex: 1,
                    padding: '3px 4px',
                    fontSize: '9px',
                    fontWeight: 700,
                    borderRadius: '3px',
                    border: '1px solid',
                    borderColor: evacDestType === 'hospital' ? '#dc2626' : tokens.border,
                    backgroundColor: evacDestType === 'hospital' ? '#dc2626' : tokens.bgCard,
                    color: evacDestType === 'hospital' ? '#fff' : tokens.textPrimary,
                    cursor: 'pointer'
                  }}
                >
                  To Hospital
                </button>
                <button
                  onClick={() => { setEvacDestType('shelter'); if (selectedBuilding) calculateRoute('EVACUATION', 'shelter'); }}
                  style={{
                    flex: 1,
                    padding: '3px 4px',
                    fontSize: '9px',
                    fontWeight: 700,
                    borderRadius: '3px',
                    border: '1px solid',
                    borderColor: evacDestType === 'shelter' ? '#0284c7' : tokens.border,
                    backgroundColor: evacDestType === 'shelter' ? '#0284c7' : tokens.bgCard,
                    color: evacDestType === 'shelter' ? '#fff' : tokens.textPrimary,
                    cursor: 'pointer'
                  }}
                >
                  To Shelter
                </button>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Filters */}
        {mapMode === 'DAMAGE' && (
          <div style={{ backgroundColor: tokens.bgTertiary, padding: '10px', borderRadius: '6px', border: `1px solid ${tokens.border}` }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: tokens.textSecondary, textTransform: 'uppercase', marginBottom: '6px' }}>
              Severity Filter
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '8px' }}>
              {['ALL', 'no-damage', 'minor-damage', 'major-damage', 'destroyed'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setDamageFilter(cat)}
                  style={{
                    padding: '3px 5px',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: damageFilter === cat ? (isDark ? '#38bdf8' : '#0f172a') : tokens.border,
                    backgroundColor: damageFilter === cat ? (isDark ? '#0284c7' : '#0f172a') : tokens.bgCard,
                    color: damageFilter === cat ? '#fff' : tokens.textPrimary,
                    fontSize: '9px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {cat === 'ALL' ? 'All Classes' : DAMAGE_LABELS[cat]}
                </button>
              ))}
            </div>

            <div style={{ fontSize: '10px', fontWeight: 600, color: tokens.textSecondary, marginBottom: '2px' }}>
              Confidence: <strong style={{ color: tokens.textPrimary }}>{(confidenceThreshold * 100).toFixed(0)}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        )}

        {mapMode === 'PRIORITY' && (
          <div style={{ backgroundColor: tokens.bgTertiary, padding: '10px', borderRadius: '6px', border: `1px solid ${tokens.border}` }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: tokens.textSecondary, textTransform: 'uppercase', marginBottom: '6px' }}>
              Priority Urgency Filter
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setPriorityFilter(lvl)}
                  style={{
                    padding: '3px 5px',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: priorityFilter === lvl ? PRIORITY_COLORS[lvl] || '#0f172a' : tokens.border,
                    backgroundColor: priorityFilter === lvl ? PRIORITY_COLORS[lvl] || '#0f172a' : tokens.bgCard,
                    color: priorityFilter === lvl ? '#fff' : tokens.textPrimary,
                    fontSize: '9px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Layer Toggles */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: tokens.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Map Layers
            </span>
            <button
              onClick={() => setIsAlertDrawerOpen(true)}
              style={{
                background: alerts.length > 0 ? '#ef4444' : tokens.bgTertiary,
                color: alerts.length > 0 ? '#ffffff' : tokens.textPrimary,
                border: 'none',
                padding: '2px 7px',
                borderRadius: '4px',
                fontSize: '9px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
              title="Open Emergency Alert Broadcast Center"
            >
              <BellRing size={10} className={alerts.length > 0 ? 'alert-beacon-strobe' : ''} />
              <span>ALERTS ({alerts.length})</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11px' }}>
            {/* Emergency Alerts Layer Toggle */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              color: tokens.textPrimary,
              backgroundColor: alerts.length > 0 ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2') : 'transparent',
              padding: '4px 6px',
              borderRadius: '4px',
              border: alerts.length > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid transparent'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="checkbox"
                  checked={layers.alerts}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleTurnOnAlerts();
                    } else {
                      handleTurnOffAlerts();
                    }
                  }}
                />
                <span style={{ fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <BellRing size={12} className={alerts.length > 0 ? 'alert-beacon-strobe' : ''} />
                  Emergency Alerts (CAP)
                </span>
              </span>
              <span style={{
                fontSize: '9px',
                fontWeight: 800,
                backgroundColor: alerts.length > 0 ? '#ef4444' : tokens.bgTertiary,
                color: alerts.length > 0 ? '#ffffff' : tokens.textSecondary,
                padding: '1px 5px',
                borderRadius: '10px'
              }}>
                {alerts.length}
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: tokens.textPrimary }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  type="checkbox"
                  checked={layers.zones}
                  onChange={(e) => setLayers({ ...layers, zones: e.target.checked })}
                />
                <span style={{ fontWeight: 600 }}>Operational Zones</span>
              </span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#0284c7' }}>
                {rawDataRef.current.zones?.features?.length || 0}
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: tokens.textPrimary }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  type="checkbox"
                  checked={layers.hazards}
                  onChange={(e) => setLayers({ ...layers, hazards: e.target.checked })}
                />
                <span style={{ fontWeight: 600, color: '#dc2626' }}>⚠️ Hazard / Debris Extent</span>
              </span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#dc2626' }}>
                {rawDataRef.current.hazards?.features?.length || 0}
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: tokens.textPrimary }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  type="checkbox"
                  checked={layers.damages}
                  onChange={(e) => setLayers({ ...layers, damages: e.target.checked })}
                />
                <span>{selectedScenarioId === 3 ? 'Point Damage Grading' : 'Damage Assessment'}</span>
              </span>
              <span style={{ fontSize: '9px', fontWeight: 600, color: tokens.textSecondary }}>
                {rawDataRef.current.damages?.features?.length || 0}
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: tokens.textPrimary }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  type="checkbox"
                  checked={layers.roads}
                  onChange={(e) => setLayers({ ...layers, roads: e.target.checked })}
                />
                <span>Road Network</span>
              </span>
              <span style={{ fontSize: '9px', fontWeight: 600, color: tokens.textSecondary }}>
                {rawDataRef.current.roads?.features?.length || 0}
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: tokens.textPrimary }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  type="checkbox"
                  checked={layers.hospitals}
                  onChange={(e) => setLayers({ ...layers, hospitals: e.target.checked })}
                />
                <span>Emergency Hospitals</span>
              </span>
              <span style={{ fontSize: '9px', fontWeight: 600, color: '#dc2626' }}>
                {rawDataRef.current.hospitals?.features?.length || 0}
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: tokens.textPrimary }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  type="checkbox"
                  checked={layers.shelters}
                  onChange={(e) => setLayers({ ...layers, shelters: e.target.checked })}
                />
                <span>Relief Shelters</span>
              </span>
              <span style={{ fontSize: '9px', fontWeight: 600, color: '#0284c7' }}>
                {rawDataRef.current.shelters?.features?.length || 0}
              </span>
            </label>



            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: tokens.textPrimary }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  type="checkbox"
                  checked={layers.boundary}
                  onChange={(e) => setLayers({ ...layers, boundary: e.target.checked })}
                />
                <span>Scenario Perimeter</span>
              </span>
              <span style={{ fontSize: '9px', fontWeight: 600, color: tokens.textSecondary }}>1</span>
            </label>
          </div>
        </div>

      </div>

      {/* ============================================================ */}
      {/* CENTER COLUMN: Large Interactive Map Canvas (Flex-1)        */}
      {/* ============================================================ */}
      <div style={{ flex: 1, position: 'relative', height: '100%', overflow: 'hidden' }}>
        {/* Floating Quick 2D / 3D Switcher in Top-Right of Map Canvas (2D Mode) */}
        {mapViewMode === '2D' && (
          <div style={{
            position: 'absolute',
            top: '14px',
            right: '54px',
            zIndex: 1000,
            display: 'flex',
            backgroundColor: tokens.mapOverlayBg || 'rgba(15, 23, 42, 0.85)',
            borderRadius: '8px',
            padding: '3px',
            border: `1px solid ${tokens.border}`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(6px)'
          }}>
            <button
              onClick={() => setMapViewMode('2D')}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: mapViewMode === '2D' ? '#0284c7' : 'transparent',
                color: mapViewMode === '2D' ? '#fff' : tokens.textSecondary,
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              🗺️ 2D Map
            </button>
            <button
              onClick={() => setMapViewMode('3D')}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: mapViewMode === '3D' ? '#0284c7' : 'transparent',
                color: mapViewMode === '3D' ? '#fff' : tokens.textSecondary,
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              🌐 3D Globe
            </button>
          </div>
        )}

        {/* 2D Leaflet Container */}
        <div
          ref={mapContainerRef}
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#e2e8f0',
            display: mapViewMode === '2D' ? 'block' : 'none'
          }}
        />

        {/* 3D Cesium Container */}
        {mapViewMode === '3D' && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}>
            <CesiumGlobe
              selectedScenarioId={selectedScenarioId}
              scenarios={scenarios}
              onSelectScenario={(newId) => {
                setSelectedScenarioId(newId);
                navigate(`/scenario/${newId}/map`);
              }}
              mapMode={mapMode}
              setMapMode={setMapMode}
              viewLevel={viewLevel}
              layers={layers}
              damageFilter={damageFilter}
              priorityFilter={priorityFilter}
              confidenceThreshold={confidenceThreshold}
              selectedBuilding={selectedBuilding}
              onSelectBuilding={setSelectedBuilding}
              selectedZone={selectedZone}
              onSelectZone={setSelectedZone}
              activeRoute={activeRoute}
              rawDataRef={rawDataRef}
              gisDataVersion={gisDataVersion}
              mapViewMode={mapViewMode}
              setMapViewMode={setMapViewMode}
              isDark={isDark}
              tokens={tokens}
            />
          </div>
        )}

        {/* Dharali 2025 Compact Status Banner */}
        {selectedScenarioId === 4 && (
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            backgroundColor: isDark ? 'rgba(30, 20, 20, 0.95)' : 'rgba(254, 242, 242, 0.96)',
            border: `1.5px solid ${isDark ? '#b91c1c' : '#f87171'}`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            borderRadius: '8px',
            padding: '8px 16px',
            maxWidth: '680px',
            width: '90%',
            textAlign: 'center',
            fontSize: '11px',
            color: isDark ? '#fca5a5' : '#991b1b',
            backdropFilter: 'blur(4px)'
          }}>
            <strong style={{ color: isDark ? '#f87171' : '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <span>⚠️</span> DHARALI 2025: QUALITATIVE ZERO-SHOT CROSS-EVENT GENERALISATION SCENARIO
            </strong>
            <div style={{ fontSize: '10px', marginTop: '3px', color: isDark ? '#cbd5e1' : '#7f1d1d', lineHeight: 1.35 }}>
              Quantitative building damage metrics are <strong>N/A</strong> (no verified ground truth annotations). Operational priority sectors are derived from the 20.4 ha debris fan overlay at Kheer Ganga-Bhagirathi confluence & Cartosat-2S.
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* LIVE EMERGENCY ALERT BAR ON DISASTER MAP                     */}
        {/* ============================================================ */}
        {/* Collapsed Alert Mini Badge (When user turns off or dismisses the top banner) */}
        {isAlertBannerDismissed && (
          <button
            onClick={() => {
              if (!layers.alerts) {
                handleTurnOnAlerts();
              } else {
                setIsAlertBannerDismissed(false);
              }
            }}
            style={{
              position: 'absolute',
              top: selectedScenarioId === 4 ? '78px' : '12px',
              left: '14px',
              zIndex: 999,
              backgroundColor: layers.alerts && alerts.length > 0 ? '#dc2626' : (isDark ? '#1e293b' : '#ffffff'),
              color: layers.alerts && alerts.length > 0 ? '#ffffff' : tokens.textPrimary,
              border: `1.5px solid ${layers.alerts && alerts.length > 0 ? '#ef4444' : tokens.border}`,
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
            title={layers.alerts ? "Reopen Emergency Alert Banner" : "Turn On Emergency Alerts on Map"}
          >
            {layers.alerts && alerts.length > 0 ? (
              <>
                <BellRing size={13} className="alert-beacon-strobe" />
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

        {/* Full Active Alert Bar (Collision-free: max-width bounded before 2D/3D toggle) */}
        {!isAlertBannerDismissed && (
          <div style={{
            position: 'absolute',
            top: selectedScenarioId === 4 ? '78px' : '12px',
            left: '14px',
            maxWidth: 'calc(100% - 250px)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: layers.alerts && alerts.length > 0
              ? (isDark ? 'rgba(28, 10, 10, 0.95)' : 'rgba(254, 242, 242, 0.97)')
              : (isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.92)'),
            border: layers.alerts && alerts.length > 0 ? '1.5px solid #ef4444' : `1px solid ${tokens.border}`,
            boxShadow: layers.alerts && alerts.length > 0 ? '0 4px 20px rgba(239, 68, 68, 0.35)' : tokens.shadow,
            borderRadius: '8px',
            padding: '5px 12px',
            backdropFilter: 'blur(8px)',
            boxSizing: 'border-box'
          }}>
            {/* Beacon Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {layers.alerts && alerts.length > 0 ? (
                <>
                  <span className="alert-beacon-dot" style={{ backgroundColor: '#ef4444' }}></span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: '#ef4444',
                    letterSpacing: '0.02em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <BellRing size={12} className="alert-beacon-strobe" />
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

            {/* Headline snippet */}
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
              {layers.alerts && alerts.length > 0
                ? alerts[0].headline || 'Immediate evacuation order in effect for active critical hazard sectors'
                : `Alert layers cleared from map • ${alerts.length} CAP warnings standby in EOC`}
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
              {alerts.length > 0 ? (
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
                      gap: '4px',
                      boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)'
                    }}
                  >
                    <span>BRIEFING</span>
                    <span style={{ backgroundColor: '#b91c1c', padding: '1px 5px', borderRadius: '8px', fontSize: '9px' }}>{alerts.length}</span>
                  </button>

                  {layers.alerts && (
                    <button
                      onClick={() => playEmergencySiren()}
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
                      title={sirenPlaying ? 'Silence Siren' : 'Test Acoustic Siren Array'}
                    >
                      {sirenPlaying ? <VolumeX size={12} /> : <Volume2 size={12} />}
                      <span>{sirenPlaying ? 'SILENCE' : 'SIREN'}</span>
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => setIsAlertDrawerOpen(true)}
                  style={{
                    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                    color: tokens.textPrimary,
                    border: `1px solid ${tokens.border}`,
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  + BROADCAST
                </button>
              )}

              <button
                onClick={() => navigate(`/scenario/${selectedScenarioId}/emergency`)}
                style={{
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  color: '#0284c7',
                  border: `1px solid ${isDark ? '#0284c7' : '#cbd5e1'}`,
                  padding: '4px 7px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
                title="Open Emergency Dispatch CAD"
              >
                <span>CAD</span>
                <ExternalLink size={10} />
              </button>

              {/* Turn Off / Turn On Button directly controlling map layer */}
              {layers.alerts ? (
                <button
                  onClick={handleTurnOffAlerts}
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
                  onClick={handleTurnOnAlerts}
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
                    gap: '3px',
                    boxShadow: '0 2px 6px rgba(16, 185, 129, 0.4)'
                  }}
                  title="Turn on emergency alerts and render on the map"
                >
                  <BellRing size={11} />
                  <span>Turn On</span>
                </button>
              )}

              {/* Dismiss Banner Button */}
              <button
                onClick={() => setIsAlertBannerDismissed(true)}
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
                title="Dismiss top banner (can restore anytime from mini badge)"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* INTERACTIVE EMERGENCY ALERT BRIEFING DRAWER / MODAL          */}
        {/* ============================================================ */}
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
            {/* Drawer Header */}
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
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: tokens.textSecondary,
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Content */}
            <div style={{ padding: '14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Quick Siren & Dissemination Bar */}
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
                  onClick={() => playEmergencySiren()}
                  style={{
                    backgroundColor: sirenPlaying ? '#b91c1c' : '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '5px 10px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {sirenPlaying ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  <span>{sirenPlaying ? 'STOP SIREN' : 'TEST SIREN'}</span>
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
                    <span style={{ color: layers.alerts ? '#ef4444' : '#94a3b8', fontWeight: 800 }}>
                      {layers.alerts ? '🔴 ACTIVE ON MAP' : '⚪ TURNED OFF (MUTED)'}
                    </span>
                  </div>
                  <div style={{ fontSize: '9px', color: tokens.textSecondary }}>
                    {layers.alerts ? 'Red hazard perimeters and siren badges rendered' : 'Alert polygons and badges removed from map view'}
                  </div>
                </div>
                <button
                  onClick={layers.alerts ? handleTurnOffAlerts : handleTurnOnAlerts}
                  style={{
                    backgroundColor: layers.alerts ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2') : '#10b981',
                    color: layers.alerts ? '#ef4444' : '#ffffff',
                    border: layers.alerts ? '1px solid rgba(239, 68, 68, 0.4)' : 'none',
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
                  {layers.alerts ? <BellOff size={12} /> : <BellRing size={12} />}
                  <span>{layers.alerts ? 'Turn Off from Map' : 'Turn On on Map'}</span>
                </button>
              </div>

              {/* Active Broadcasts List */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.textPrimary, textTransform: 'uppercase', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Active Broadcast Alerts ({alerts.length})</span>
                  <span style={{ fontSize: '9px', color: '#10b981', fontWeight: 600 }}>🟢 EOC DISPATCH SYNCED</span>
                </div>

                {alerts.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', backgroundColor: tokens.bgTertiary, borderRadius: '6px', fontSize: '11px', color: tokens.textSecondary }}>
                    No active emergency broadcasts for this scenario. Use the form below to generate a rapid evacuation order from any operational zone.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {alerts.map(a => {
                      const isExtreme = a.severity === 'Extreme';
                      return (
                        <div
                          key={a.id}
                          style={{
                            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#f8fafc',
                            border: `1px solid ${isExtreme ? 'rgba(239, 68, 68, 0.5)' : 'rgba(245, 158, 11, 0.5)'}`,
                            borderLeft: `4px solid ${isExtreme ? '#ef4444' : '#f59e0b'}`,
                            borderRadius: '6px',
                            padding: '10px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                            <span style={{
                              fontSize: '8px',
                              fontWeight: 800,
                              backgroundColor: isExtreme ? '#ef4444' : '#f59e0b',
                              color: '#ffffff',
                              padding: '2px 5px',
                              borderRadius: '3px',
                              textTransform: 'uppercase'
                            }}>
                              {a.severity} • {a.urgency}
                            </span>
                            <span style={{ fontSize: '9px', color: tokens.textSecondary, fontFamily: 'monospace' }}>
                              {a.identifier}
                            </span>
                          </div>

                          <div style={{ fontSize: '12px', fontWeight: 800, color: tokens.textPrimary, margin: '4px 0 2px 0' }}>
                            {a.headline}
                          </div>

                          <div style={{ fontSize: '10px', color: tokens.textSecondary, marginBottom: '6px', lineHeight: 1.35 }}>
                            {a.instruction || a.description}
                          </div>

                          {/* Broadcast Channel Indicators */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '6px 0' }}>
                            <span style={{ fontSize: '8px', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 5px', borderRadius: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <CheckCircle2 size={9} /> WEA / CMAS Cell Broadcast
                            </span>
                            <span style={{ fontSize: '8px', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 5px', borderRadius: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <CheckCircle2 size={9} /> EAS Radio Broadcast
                            </span>
                            <span style={{ fontSize: '8px', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 5px', borderRadius: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <CheckCircle2 size={9} /> PostGIS Perimeter
                            </span>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                            <button
                              onClick={() => handleLocateAlert(a)}
                              style={{
                                flex: 1,
                                backgroundColor: '#0284c7',
                                color: '#ffffff',
                                border: 'none',
                                padding: '5px 8px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              🎯 Locate on Map
                            </button>
                            <button
                              onClick={() => handleFetchCapXml(a.id)}
                              disabled={capXmlLoading}
                              style={{
                                backgroundColor: isDark ? '#334155' : '#e2e8f0',
                                color: tokens.textPrimary,
                                border: 'none',
                                padding: '5px 8px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              📜 CAP XML
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* CAP XML Viewer */}
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
                        setBroadcastToast('📋 CAP XML copied to clipboard');
                        setTimeout(() => setBroadcastToast(null), 3000);
                      }}
                      style={{
                        backgroundColor: '#0284c7',
                        color: '#fff',
                        border: 'none',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '9px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
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
                    whiteSpace: 'pre-wrap',
                    margin: 0
                  }}>
                    {selectedCapXml}
                  </pre>
                </div>
              )}

              {/* Rapid Zone Evacuation Order Broadcast Trigger */}
              <div style={{
                backgroundColor: tokens.bgTertiary,
                padding: '12px',
                borderRadius: '8px',
                border: `1px solid ${tokens.border}`
              }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.textPrimary, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Issue Rapid Evacuation Broadcast
                </div>
                <div style={{ fontSize: '10px', color: tokens.textSecondary, marginBottom: '8px' }}>
                  Select an operational sector to generate and transmit a certified CAP 1.2 alert.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <select
                    value={newAlertZoneId}
                    onChange={(e) => setNewAlertZoneId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      border: `1px solid ${tokens.border}`,
                      backgroundColor: tokens.bgCard,
                      color: tokens.textPrimary,
                      fontSize: '11px',
                      fontWeight: 600
                    }}
                  >
                    <option value="">-- Select Operational Sector --</option>
                    {(rawDataRef.current.zones?.features || []).map(f => (
                      <option key={f.properties.id} value={f.properties.id}>
                        [{f.properties.criticality}] {f.properties.name} ({f.properties.zoneCode})
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => {
                      if (!newAlertZoneId) {
                        alert('Please select an operational sector first.');
                        return;
                      }
                      handleBroadcastZoneCap(newAlertZoneId);
                    }}
                    style={{
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)'
                    }}
                  >
                    <Radio size={13} />
                    <span>BROADCAST CAP 1.2 EMERGENCY ORDER</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Broadcast Toast Notification */}
        {broadcastToast && (
          <div style={{
            position: 'absolute',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2000,
            backgroundColor: '#0f172a',
            color: '#ffffff',
            border: '2px solid #ef4444',
            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.5)',
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'alertStrobe 1.5s ease-in-out'
          }}>
            <BellRing size={16} color="#ef4444" />
            <span>{broadcastToast}</span>
          </div>
        )}

        {/* Collapsible Floating Mode & Legend Badge */}
        {isLegendCollapsed && (
          <button
            onClick={() => setIsLegendCollapsed(false)}
            title="Expand Map Legend"
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              backgroundColor: tokens.mapOverlayBg,
              padding: '7px 12px',
              borderRadius: '8px',
              boxShadow: tokens.shadow,
              zIndex: 1000,
              fontSize: '11px',
              fontWeight: 700,
              border: `1px solid ${tokens.border}`,
              color: tokens.textPrimary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backdropFilter: 'blur(6px)'
            }}
          >
            <Layers size={13} color={tokens.accent} />
            <span>Map Legend</span>
            <ChevronRight size={13} />
          </button>
        )}

        {!isLegendCollapsed && (
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            backgroundColor: tokens.mapOverlayBg,
            padding: '10px 14px',
            borderRadius: '8px',
            boxShadow: tokens.shadow,
            zIndex: 1000,
            fontSize: '10px',
            border: `1px solid ${tokens.border}`,
            color: tokens.textPrimary,
            minWidth: '220px',
            maxWidth: '280px',
            maxHeight: '260px',
            overflowY: 'auto',
            backdropFilter: 'blur(6px)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', borderBottom: `1px solid ${tokens.border}`, paddingBottom: '3px' }}>
              <div style={{ fontWeight: 800, color: tokens.textPrimary, textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Layers size={12} color={tokens.accent} />
                {mapMode === 'DAMAGE' ? 'DAMAGE ASSESSMENT' : (mapMode === 'PRIORITY' ? 'TRIAGE PRIORITY' : 'RESPONSE & ROUTING')}
              </div>
              <button
                onClick={() => setIsLegendCollapsed(true)}
                title="Collapse Legend"
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: tokens.textSecondary,
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={12} />
              </button>
            </div>

            {/* Scenario-Specific Semantic Legend */}
            {selectedScenarioId === 2 && (
              <div style={{ marginBottom: '6px', padding: '4px 6px', backgroundColor: isDark ? '#162033' : '#f1f5f9', borderRadius: '4px', fontSize: '9px', color: tokens.textSecondary }}>
                <strong>CHAMOLI 2021 PROTOCOL:</strong> Native EIDC binary grading (Intact vs Damaged/Obstructed).
              </div>
            )}

            {selectedScenarioId === 3 && (
              <div style={{ marginBottom: '6px', padding: '4px 6px', backgroundColor: isDark ? '#162033' : '#f1f5f9', borderRadius: '4px', fontSize: '9px', color: tokens.textSecondary }}>
                <strong>CYCLONE FANI PROTOCOL:</strong> Copernicus EMS EMSR357 point grading.
              </div>
            )}

            {selectedScenarioId === 4 && (
              <div style={{ marginBottom: '6px', padding: '4px 6px', backgroundColor: isDark ? '#2a1a1a' : '#fff1f2', borderRadius: '4px', fontSize: '9px', color: '#b91c1c' }}>
                <strong>DHARALI 2025 PROTOCOL:</strong> Qualitative Zero-Shot. 20.4 ha debris extent.
              </div>
            )}

            {mapMode === 'DAMAGE' && (
              <>
                {selectedScenarioId === 2 ? (
                  // Chamoli Binary Legend
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ width: '10px', height: '10px', backgroundColor: DAMAGE_COLORS['destroyed'], borderRadius: '2px' }}></span>
                      <span style={{ fontWeight: 600 }}>Damaged / Obstructed</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ width: '10px', height: '10px', backgroundColor: DAMAGE_COLORS['no-damage'], borderRadius: '2px' }}></span>
                      <span style={{ fontWeight: 600 }}>Intact / Undamaged</span>
                    </div>
                  </>
                ) : selectedScenarioId === 3 ? (
                  // Fani Point Legend
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ width: '8px', height: '8px', backgroundColor: DAMAGE_COLORS['destroyed'], borderRadius: '50%', border: '1px solid #000' }}></span>
                      <span>Destroyed (EMSR357)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ width: '8px', height: '8px', backgroundColor: DAMAGE_COLORS['major-damage'], borderRadius: '50%', border: '1px solid #000' }}></span>
                      <span>Damaged (EMSR357)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ width: '8px', height: '8px', backgroundColor: DAMAGE_COLORS['minor-damage'], borderRadius: '50%', border: '1px solid #000' }}></span>
                      <span>Possibly damaged</span>
                    </div>
                  </>
                ) : (
                  // Standard 4-Class Scale
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ width: '10px', height: '10px', backgroundColor: DAMAGE_COLORS['no-damage'], borderRadius: '2px' }}></span>
                      <span>No Damage</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ width: '10px', height: '10px', backgroundColor: DAMAGE_COLORS['minor-damage'], borderRadius: '2px' }}></span>
                      <span>Minor Damage</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ width: '10px', height: '10px', backgroundColor: DAMAGE_COLORS['major-damage'], borderRadius: '2px' }}></span>
                      <span>Major Damage</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ width: '10px', height: '10px', backgroundColor: DAMAGE_COLORS['destroyed'], borderRadius: '2px' }}></span>
                      <span>Destroyed</span>
                    </div>
                  </>
                )}
              </>
            )}

            {mapMode !== 'DAMAGE' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                  <span style={{ width: '10px', height: '10px', backgroundColor: PRIORITY_COLORS['CRITICAL'], borderRadius: '2px' }}></span>
                  <span style={{ fontWeight: 700, color: PRIORITY_COLORS['CRITICAL'] }}>Critical Priority (≥70%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                  <span style={{ width: '10px', height: '10px', backgroundColor: PRIORITY_COLORS['HIGH'], borderRadius: '2px' }}></span>
                  <span style={{ fontWeight: 600, color: PRIORITY_COLORS['HIGH'] }}>High Priority (50-70%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                  <span style={{ width: '10px', height: '10px', backgroundColor: PRIORITY_COLORS['MEDIUM'], borderRadius: '2px' }}></span>
                  <span>Medium Priority (30-50%)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                  <span style={{ width: '10px', height: '10px', backgroundColor: PRIORITY_COLORS['LOW'], borderRadius: '2px' }}></span>
                  <span>Low Priority (&lt;30%)</span>
                </div>
              </>
            )}

            <div style={{ borderTop: `1px solid ${tokens.border}`, paddingTop: '5px', color: tokens.textSecondary, fontSize: '10px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: 12, height: 0, borderTop: '2px dashed #dc2626' }} />
                <span><strong style={{ color: '#dc2626' }}>Red Dashed:</strong> Hazard / Debris Extent</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: 12, height: 0, borderTop: '2px dashed #7c3aed' }} />
                <span><strong style={{ color: '#7c3aed' }}>Violet Dashed:</strong> Blocked road corridor</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: 12, height: 3, backgroundColor: '#d97706', borderRadius: 1 }} />
                <span><strong style={{ color: '#d97706' }}>Amber Glow:</strong> Response Access Route</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: 12, height: 3, backgroundColor: '#0284c7', borderRadius: 1 }} />
                <span><strong style={{ color: '#0284c7' }}>Cyan Glow:</strong> Evacuation Route</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* RIGHT COLUMN: Priority-Centered Details & Routing (360px)   */}
      {/* ============================================================ */}
      <div style={{
        width: '360px',
        backgroundColor: tokens.bgSecondary,
        borderLeft: `1px solid ${tokens.border}`,
        padding: '14px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        zIndex: 10,
        color: tokens.textPrimary
      }}>
        
        {/* Error Alert if any */}
        {error && (
          <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '8px 10px', borderRadius: '6px', fontSize: '11px', border: '1px solid #fecaca', lineHeight: 1.3 }}>
            <strong>Alert:</strong> {error}
          </div>
        )}

        {/* Selected Building Details Panel */}
        {selectedBuilding ? (
          <div style={{
            backgroundColor: tokens.bgCard,
            border: `2px solid ${isDark ? tokens.border : '#0f172a'}`,
            borderRadius: '8px',
            padding: '14px',
            boxShadow: tokens.shadow
          }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 700, color: tokens.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {selectedScenarioId === 3 || selectedBuilding.geometry?.type === 'Point' 
                    ? 'COPERNICUS EMSR357 POINT OBSERVATION' 
                    : (selectedScenarioId === 4 ? 'QUALITATIVE ZERO-SHOT REFERENCE' : 'SELECTED STRUCTURE FOOTPRINT')}
                </span>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: tokens.textPrimary, margin: 0 }}>
                  {selectedScenarioId === 3 || selectedBuilding.geometry?.type === 'Point'
                    ? `Observation Point #${selectedBuilding.id || selectedBuilding.buildingId}`
                    : `Structure #${selectedBuilding.id || selectedBuilding.buildingId}`}
                </h3>
                <span style={{ fontSize: '10px', color: tokens.textSecondary }}>
                  Scenario: <strong>{scenarios.find(s => s.id === selectedScenarioId)?.name || `Scenario ${selectedScenarioId}`}</strong>
                </span>
              </div>
              <button
                onClick={() => { setSelectedBuilding(null); clearRoute(); }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: tokens.textSecondary }}
              >
                ✕
              </button>
            </div>

            {/* Evidence Type Badge */}
            <div style={{ marginBottom: '10px' }}>
              <span style={{
                fontSize: '9px',
                fontWeight: 800,
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: selectedScenarioId === 2 ? '#dcfce7' : (selectedScenarioId === 3 ? '#e0f2fe' : (selectedScenarioId === 4 ? '#fef3c7' : '#f1f5f9')),
                color: selectedScenarioId === 2 ? '#15803d' : (selectedScenarioId === 3 ? '#0369a1' : (selectedScenarioId === 4 ? '#b45309' : '#334155')),
                border: `1px solid ${selectedScenarioId === 2 ? '#86efac' : (selectedScenarioId === 3 ? '#7dd3fc' : (selectedScenarioId === 4 ? '#fcd34d' : '#cbd5e1'))}`,
                display: 'inline-block'
              }}>
                EVIDENCE: {selectedScenarioId === 2 ? 'VERIFIED GROUND TRUTH (EIDC)' : (selectedScenarioId === 3 ? 'POINT OBSERVATION (EMSR357)' : (selectedScenarioId === 4 ? 'QUALITATIVE / ZERO-SHOT OVERLAY' : 'SUPERVISED BENCHMARK (xBD)'))}
              </span>
            </div>

            {/* AI SATELLITE EVIDENCE (BEFORE / AFTER COMPARISON OR SENSOR CONTEXT) */}
            <div style={{ backgroundColor: tokens.bgTertiary, padding: '8px', borderRadius: '6px', border: `1px solid ${tokens.border}`, marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: tokens.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Satellite size={12} color={tokens.accent} /> AI SATELLITE EVIDENCE
                </span>
                <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', backgroundColor: '#38bdf820', color: '#0284c7', fontWeight: 700 }}>
                  {selectedScenarioId === 1 ? 'Bi-Temporal Optical Chips (xBD)' : (selectedScenarioId === 3 ? 'Copernicus EMS Rapid Mapping' : (selectedScenarioId === 2 ? 'EIDC Orthomosaic Sensor' : 'Cartosat-2S / PlanetScope'))}
                </span>
              </div>

              {selectedScenarioId === 1 ? (
                /* Dual Before / After Frames for xBD Benchmark */
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                  <div style={{ border: `1px solid ${tokens.border}`, borderRadius: '4px', overflow: 'hidden', backgroundColor: '#020617' }}>
                    <div style={{ padding: '2px 5px', backgroundColor: '#0284c7', color: '#fff', fontSize: '10px', fontWeight: 800, display: 'flex', justifyContent: 'space-between' }}>
                      <span>PRE-DISASTER</span>
                      <span>Reference</span>
                    </div>
                    <div style={{ height: '88px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img
                        src={`/satellite_evidence/crops/scen1_${selectedBuilding.damageClass || 'no-damage'}_pre.png`}
                        alt="Pre-disaster satellite crop"
                        onError={(e) => { e.target.src = '/satellite_evidence/scenario_1_pre.png'; }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  </div>

                  <div style={{ border: `1px solid ${tokens.border}`, borderRadius: '4px', overflow: 'hidden', backgroundColor: '#020617' }}>
                    <div style={{ padding: '2px 5px', backgroundColor: DAMAGE_COLORS[selectedBuilding.damageClass] || '#dc2626', color: '#fff', fontSize: '10px', fontWeight: 800, display: 'flex', justifyContent: 'space-between' }}>
                      <span>POST-DISASTER</span>
                      <span>Impact</span>
                    </div>
                    <div style={{ height: '88px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img
                        src={`/satellite_evidence/crops/scen1_${selectedBuilding.damageClass || 'no-damage'}_post.png`}
                        alt="Post-disaster satellite crop"
                        onError={(e) => { e.target.src = '/satellite_evidence/scenario_1_post.png'; }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Honest Regional Sensor Context without fake identical chips */
                <div style={{ border: `1px solid ${tokens.border}`, borderRadius: '4px', overflow: 'hidden', backgroundColor: '#020617', marginBottom: '6px' }}>
                  <div style={{ padding: '3px 6px', backgroundColor: isDark ? '#1e293b' : '#334155', color: '#fff', fontSize: '10px', fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>SENSOR SCENE CONTEXT</span>
                    <span style={{ fontSize: '9px', opacity: 0.85 }}>
                      {selectedScenarioId === 3 ? 'Copernicus AOI08 Puri' : (selectedScenarioId === 2 ? 'EIDC Rishiganga Scour' : 'Cartosat-2S Debris Fan')}
                    </span>
                  </div>
                  <div style={{ height: '96px', overflow: 'hidden', position: 'relative' }}>
                    <img
                      src={`/satellite_evidence/scenario_${selectedScenarioId}_post.png`}
                      alt="Sensor scene context"
                      onError={(e) => { e.target.src = `/satellite_evidence/scenario_${selectedScenarioId}_pre.png`; }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{ position: 'absolute', bottom: '4px', right: '6px', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '1px 5px', borderRadius: '3px', fontSize: '9px' }}>
                      {selectedScenarioId === 3 ? 'EMSR357 High-Res Photo-Interpretation' : (selectedScenarioId === 2 ? 'EIDC Westoby Orthomosaic' : 'Zero-Shot Hazard Extent')}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ fontSize: '10px', color: tokens.textSecondary, lineHeight: 1.35, backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)', padding: '5px 7px', borderRadius: '4px' }}>
                <strong style={{ color: tokens.textPrimary }}>Detection Rationale: </strong>
                {selectedBuilding.priorityInfo?.explanation || (
                  selectedScenarioId === 3
                    ? `Copernicus EMS EMSR357 rapid mapping point grade: ${(selectedBuilding.damageClass || 'Damaged').toUpperCase()}. Photo-interpreted satellite assessment across coastal Puri.`
                    : selectedScenarioId === 2
                      ? `EIDC Westoby et al. (2023) survey condition: ${(selectedBuilding.damageClass === 'no-damage' ? 'Intact Structure' : 'Damaged / Obstructed')}. Post-flood avalanche scour corridor.`
                      : selectedScenarioId === 4
                        ? `Qualitative Zero-Shot Protocol: Building exposure derived relative to 20.4 ha Kheer Ganga debris fan. No verified ground truth labels exist.`
                        : (selectedBuilding.damageClass === 'destroyed'
                            ? 'Structural collapse detected. Complete obliteration of roof plane and dispersed rubble scatter.'
                            : selectedBuilding.damageClass === 'major-damage'
                              ? 'Major structural trauma. Severe roof shearing and foundation breach detected via high-res spectral delta.'
                              : selectedBuilding.damageClass === 'minor-damage'
                                ? 'Minor exterior shingle displacement and perimeter flooding/smoke staining; frame intact.'
                                : 'Structure intact. Clean geometric roof boundaries and no detectable physical disruption.')
                )}
              </div>
            </div>

            {/* Damage Assessment */}
            <div style={{ backgroundColor: tokens.bgTertiary, padding: '8px', borderRadius: '6px', border: `1px solid ${tokens.border}`, marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: tokens.textSecondary, textTransform: 'uppercase' }}>
                  Damage Classification
                </span>
                <span style={{
                  padding: '2px 6px',
                  borderRadius: '3px',
                  backgroundColor: DAMAGE_COLORS[selectedBuilding.damageClass] || '#94a3b8',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}>
                  {DAMAGE_LABELS[selectedBuilding.damageClass] || selectedBuilding.damageClass}
                </span>
              </div>

              <div style={{ fontSize: '10px', color: tokens.textSecondary, marginBottom: '6px' }}>
                Confidence: <strong style={{ color: tokens.textPrimary }}>{selectedBuilding.confidence ? (selectedBuilding.confidence * 100).toFixed(1) : '100.0'}%</strong>
                {selectedScenarioId === 4 && <span style={{ color: '#d97706', marginLeft: '6px', fontWeight: 600 }}>(Inferred / Zero-Shot)</span>}
              </div>

              {/* Exposure and Access Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', borderTop: `1px solid ${tokens.border}`, paddingTop: '5px', fontSize: '10px' }}>
                <div>
                  <span style={{ color: tokens.textSecondary }}>Estimated Exposure:</span>
                  <strong style={{ display: 'block', color: tokens.textPrimary }}>
                    {selectedScenarioId === 3 
                      ? 'Unspecified (Point Observation)' 
                      : (selectedScenarioId === 4 ? 'Unverified (Zero-Shot Exposure)' : '~4-8 occupants (cadastral footprint)')}
                  </strong>
                </div>
                <div>
                  <span style={{ color: tokens.textSecondary }}>Road Accessibility:</span>
                  <strong style={{ display: 'block', color: avoidBlockedRoads ? '#10b981' : '#f59e0b' }}>
                    {avoidBlockedRoads ? 'Detour Route Clear' : 'Direct Corridor'}
                  </strong>
                </div>
              </div>

              {/* 4-Class Softmax Probability Distribution */}
              {selectedBuilding.probabilities && (
                <div style={{ borderTop: `1px solid ${tokens.border}`, paddingTop: '4px', marginTop: '5px' }}>
                  {['no-damage', 'minor-damage', 'major-damage', 'destroyed'].map(k => {
                    const prob = selectedBuilding.probabilities[k] || 0;
                    return (
                      <div key={k} style={{ marginBottom: '2px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                          <span style={{ color: tokens.textSecondary }}>{DAMAGE_LABELS[k]}:</span>
                          <strong style={{ color: tokens.textPrimary }}>{(prob * 100).toFixed(1)}%</strong>
                        </div>
                        <div style={{ height: '3px', backgroundColor: tokens.border, borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${prob * 100}%`, height: '100%', backgroundColor: DAMAGE_COLORS[k] }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Priority Assessment & 5-Factor Breakdown */}
            {selectedBuilding.priorityInfo && (
              <div style={{ backgroundColor: tokens.bgTertiary, padding: '8px', borderRadius: '6px', border: `1px solid ${tokens.border}`, marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: '3px',
                    backgroundColor: PRIORITY_COLORS[selectedBuilding.priorityInfo.priority_level || selectedBuilding.priorityInfo.priorityLevel] || '#0f172a',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '10px'
                  }}>
                    {selectedBuilding.priorityInfo.priority_level || selectedBuilding.priorityInfo.priorityLevel} PRIORITY
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: tokens.textPrimary }}>
                    Score: {((selectedBuilding.priorityInfo.priority_score || selectedBuilding.priorityInfo.priorityScore) * 100).toFixed(0)}%
                  </span>
                </div>

                {/* 5 Heuristic Factor Contribution Bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '9px', marginBottom: '6px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: tokens.textSecondary }}>Structural Severity (40%):</span>
                      <strong style={{ color: tokens.textPrimary }}>{((selectedBuilding.priorityInfo.severity_score || 0) * 100).toFixed(0)}%</strong>
                    </div>
                    <div style={{ height: '3px', backgroundColor: tokens.border, borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${(selectedBuilding.priorityInfo.severity_score || 0) * 100}%`, height: '100%', backgroundColor: '#ef4444' }}></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: tokens.textSecondary }}>Population Exposure (20%):</span>
                      <strong style={{ color: tokens.textPrimary }}>{((selectedBuilding.priorityInfo.population_score || 0) * 100).toFixed(0)}%</strong>
                    </div>
                    <div style={{ height: '3px', backgroundColor: tokens.border, borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${(selectedBuilding.priorityInfo.population_score || 0) * 100}%`, height: '100%', backgroundColor: '#f59e0b' }}></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: tokens.textSecondary }}>Critical Infrastructure (15%):</span>
                      <strong style={{ color: tokens.textPrimary }}>{((selectedBuilding.priorityInfo.infrastructure_score || 0) * 100).toFixed(0)}%</strong>
                    </div>
                    <div style={{ height: '3px', backgroundColor: tokens.border, borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${(selectedBuilding.priorityInfo.infrastructure_score || 0) * 100}%`, height: '100%', backgroundColor: '#0284c7' }}></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: tokens.textSecondary }}>Road Accessibility (15%):</span>
                      <strong style={{ color: tokens.textPrimary }}>{((selectedBuilding.priorityInfo.accessibility_score || 0) * 100).toFixed(0)}%</strong>
                    </div>
                    <div style={{ height: '3px', backgroundColor: tokens.border, borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${(selectedBuilding.priorityInfo.accessibility_score || 0) * 100}%`, height: '100%', backgroundColor: '#7c3aed' }}></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: tokens.textSecondary }}>Hazard Zone Proximity (10%):</span>
                      <strong style={{ color: tokens.textPrimary }}>
                        {((selectedBuilding.priorityInfo.hazard_proximity_score || (selectedScenarioId === 4 ? 0.85 : 0.70)) * 100).toFixed(0)}%
                      </strong>
                    </div>
                    <div style={{ height: '3px', backgroundColor: tokens.border, borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${(selectedBuilding.priorityInfo.hazard_proximity_score || (selectedScenarioId === 4 ? 0.85 : 0.70)) * 100}%`, height: '100%', backgroundColor: '#dc2626' }}></div>
                    </div>
                  </div>
                </div>

                {/* Plain-Language Rationale */}
                <div style={{ fontSize: '10px', color: tokens.textPrimary, lineHeight: 1.3, borderTop: `1px solid ${tokens.border}`, paddingTop: '4px' }}>
                  <strong>WHY PRIORITISED:</strong> {selectedBuilding.priorityInfo.explanation}
                </div>
              </div>
            )}

            {/* RESPONSE ACTIONS */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: tokens.textPrimary, textTransform: 'uppercase', marginBottom: '4px' }}>
                Response Actions
              </div>

              <label style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px', cursor: 'pointer', color: tokens.textSecondary }}>
                <input
                  type="checkbox"
                  checked={avoidBlockedRoads}
                  onChange={(e) => {
                    setAvoidBlockedRoads(e.target.checked);
                    if (activeRoute) calculateRoute(activeRoute.routePurpose);
                  }}
                />
                <span>Avoid Blocked Roads (Detour Mode)</span>
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* 1. Response Access Route Button */}
                <button
                  onClick={() => calculateRoute('RESPONSE')}
                  disabled={routingLoading}
                  style={{
                    backgroundColor: '#d97706',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  <span>RESPONSE ACCESS ROUTE</span>
                  <span style={{ fontSize: '9px', fontWeight: 500, opacity: 0.9 }}>EOC Staging → Site</span>
                </button>

                {/* 2. Evacuation Route Button */}
                <button
                  onClick={() => calculateRoute('EVACUATION', 'hospital')}
                  disabled={routingLoading}
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  <span>EVACUATION ROUTE</span>
                  <span style={{ fontSize: '9px', fontWeight: 500, opacity: 0.9 }}>Site → Hospital</span>
                </button>
              </div>
            </div>

          </div>
        ) : selectedZone ? (
          /* Operational Zone Details Panel */
          <div style={{
            backgroundColor: tokens.bgCard,
            border: `2px solid ${PRIORITY_COLORS[selectedZone.criticality] || (isDark ? tokens.border : '#0f172a')}`,
            borderRadius: '8px',
            padding: '14px',
            boxShadow: tokens.shadow
          }}>
            {/* Zone Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  backgroundColor: PRIORITY_COLORS[selectedZone.criticality] || '#0f172a',
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  textTransform: 'uppercase'
                }}>
                  {selectedZone.criticality} SECTOR
                </span>
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: tokens.textPrimary, margin: '4px 0 0 0' }}>
                  {selectedZone.name}
                </h3>
                <span style={{ fontSize: '10px', color: tokens.textSecondary, fontWeight: 600 }}>
                  {selectedZone.zoneCode}
                </span>
              </div>
              <button
                onClick={() => { setSelectedZone(null); clearRoute(); }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: tokens.textSecondary }}
              >
                ✕
              </button>
            </div>

            {/* Zone Evidence Explanation Card */}
            <div style={{
              backgroundColor: selectedScenarioId === 4 ? (isDark ? '#2a1a1a' : '#fffbeb') : (isDark ? tokens.bgTertiary : '#f8fafc'),
              border: `1px solid ${selectedScenarioId === 4 ? '#fcd34d' : tokens.border}`,
              borderRadius: '6px',
              padding: '8px',
              marginBottom: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  padding: '1px 5px',
                  borderRadius: '3px',
                  backgroundColor: selectedScenarioId === 4 ? '#b45309' : (selectedScenarioId === 2 ? '#15803d' : '#0369a1'),
                  color: '#fff'
                }}>
                  {selectedScenarioId === 4 ? 'QUALITATIVE / ZERO-SHOT' : (selectedScenarioId === 2 ? 'VERIFIED GROUND TRUTH' : 'POINT-BASED OBSERVATION')}
                </span>
              </div>
              <div style={{ fontSize: '10px', color: tokens.textPrimary, lineHeight: 1.3 }}>
                {selectedScenarioId === 4 && 'Zone perimeter delineated from 20.4-ha debris fan overlay at Kheer Ganga-Bhagirathi confluence. Structural building damage is unverified.'}
                {selectedScenarioId === 2 && 'Zone delineated from field-surveyed building damage polygons by EIDC Westoby et al. and post-flood avalanche scour corridor.'}
                {selectedScenarioId === 3 && 'Zone delineated from Copernicus EMS EMSR357 point grading and OSDMA cyclone shelter records across coastal Puri.'}
                {selectedScenarioId === 1 && 'Zone delineated from supervised xBD cadastral building footprints across Malibu fire corridor.'}
              </div>
            </div>

            {/* Criticality Score Bar */}
            <div style={{ backgroundColor: tokens.bgTertiary, padding: '8px', borderRadius: '6px', border: `1px solid ${tokens.border}`, marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 700, marginBottom: '4px' }}>
                <span style={{ color: tokens.textSecondary }}>Criticality Score Index</span>
                <strong style={{ color: PRIORITY_COLORS[selectedZone.criticality] || tokens.textPrimary }}>
                  {((selectedZone.criticalityScore || 0) * 100).toFixed(0)}%
                </strong>
              </div>
              <div style={{ height: '4px', backgroundColor: tokens.border, borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${(selectedZone.criticalityScore || 0) * 100}%`, height: '100%', backgroundColor: PRIORITY_COLORS[selectedZone.criticality] || '#0f172a' }}></div>
              </div>
            </div>

            {/* Aggregated Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
              <div style={{ padding: '6px 8px', backgroundColor: tokens.bgTertiary, borderRadius: '4px', border: `1px solid ${tokens.border}` }}>
                <span style={{ fontSize: '9px', color: tokens.textSecondary, display: 'block' }}>Total Evaluated</span>
                <strong style={{ fontSize: '12px', color: tokens.textPrimary }}>{selectedZone.totalBuildings} {selectedScenarioId === 3 ? 'Observations' : 'Buildings'}</strong>
              </div>
              <div style={{ padding: '6px 8px', backgroundColor: isDark ? '#2a1a1a' : '#fef2f2', borderRadius: '4px', border: `1px solid ${isDark ? '#7f1d1d' : '#fee2e2'}` }}>
                <span style={{ fontSize: '9px', color: isDark ? '#fca5a5' : '#991b1b', display: 'block' }}>Severe Impact</span>
                <strong style={{ fontSize: '12px', color: '#dc2626' }}>
                  {(selectedZone.destroyedCount || 0) + (selectedZone.majorDamageCount || 0)} {selectedScenarioId === 3 ? 'Points' : 'Structures'}
                </strong>
              </div>
              <div style={{ padding: '6px 8px', backgroundColor: isDark ? '#162438' : '#f0f9ff', borderRadius: '4px', border: `1px solid ${isDark ? '#1e3a8a' : '#e0f2fe'}` }}>
                <span style={{ fontSize: '9px', color: isDark ? '#93c5fd' : '#0369a1', display: 'block' }}>Exposed Population</span>
                <strong style={{ fontSize: '12px', color: '#0284c7' }}>~{selectedZone.estimatedPopulation} Residents</strong>
              </div>
              <div style={{ padding: '6px 8px', backgroundColor: isDark ? '#221c35' : '#faf5ff', borderRadius: '4px', border: `1px solid ${isDark ? '#581c87' : '#f3e8ff'}` }}>
                <span style={{ fontSize: '9px', color: isDark ? '#d8b4fe' : '#7e22ce', display: 'block' }}>Blocked Corridors</span>
                <strong style={{ fontSize: '12px', color: '#7c3aed' }}>{selectedZone.blockedRoadsCount} Roadblocks</strong>
              </div>
            </div>

            {/* Civil Defence Recommendation */}
            <div style={{ backgroundColor: isDark ? '#2a2216' : '#fffbeb', border: `1px solid ${isDark ? '#78350f' : '#fde68a'}`, borderRadius: '6px', padding: '8px', marginBottom: '10px' }}>
              <div style={{ fontSize: '9px', fontWeight: 800, color: isDark ? '#fbbf24' : '#92400e', textTransform: 'uppercase', marginBottom: '2px' }}>
                CIVIL DEFENCE DIRECTIVE
              </div>
              <div style={{ fontSize: '10px', color: isDark ? '#fde68a' : '#78350f', lineHeight: 1.35, fontWeight: 500 }}>
                {selectedZone.recommendedAction}
              </div>
            </div>

            {/* Explainable Rationale */}
            <div style={{ fontSize: '10px', color: tokens.textSecondary, lineHeight: 1.35, marginBottom: '12px' }}>
              {selectedZone.explanation}
            </div>

            {/* Zone Apex Routing Actions */}
            <div style={{ borderTop: `1px solid ${tokens.border}`, paddingTop: '10px', marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: tokens.textPrimary, textTransform: 'uppercase', marginBottom: '6px' }}>
                Zone Command Routing (Apex Target #{selectedZone.highestPriorityBuildingId})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  onClick={() => {
                    const bMatch = rawDataRef.current.damages?.features?.find(f => (f.properties?.buildingId || f.properties?.id) === selectedZone.highestPriorityBuildingId);
                    const priMatch = rawDataRef.current.priorities?.features?.find(f => (f.properties?.building_id || f.properties?.id) === selectedZone.highestPriorityBuildingId);
                    let bObj = null;
                    if (bMatch) {
                      bObj = {
                        ...bMatch.properties,
                        id: selectedZone.highestPriorityBuildingId,
                        geometry: bMatch.geometry,
                        priorityInfo: priMatch?.properties
                      };
                      setSelectedBuilding(bObj);
                    }
                    calculateRoute('RESPONSE', null, bObj);
                  }}
                  disabled={routingLoading}
                  style={{
                    backgroundColor: '#d97706',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  <span>DISPATCH TO ZONE APEX</span>
                  <span style={{ fontSize: '9px', fontWeight: 500, opacity: 0.9 }}>EOC Staging → Target</span>
                </button>

                <button
                  onClick={() => {
                    const bMatch = rawDataRef.current.damages?.features?.find(f => (f.properties?.buildingId || f.properties?.id) === selectedZone.highestPriorityBuildingId);
                    const priMatch = rawDataRef.current.priorities?.features?.find(f => (f.properties?.building_id || f.properties?.id) === selectedZone.highestPriorityBuildingId);
                    let bObj = null;
                    if (bMatch) {
                      bObj = {
                        ...bMatch.properties,
                        id: selectedZone.highestPriorityBuildingId,
                        geometry: bMatch.geometry,
                        priorityInfo: priMatch?.properties
                      };
                      setSelectedBuilding(bObj);
                    }
                    calculateRoute('EVACUATION', 'hospital', bObj);
                  }}
                  disabled={routingLoading}
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  <span>EVACUATE ZONE APEX</span>
                  <span style={{ fontSize: '9px', fontWeight: 500, opacity: 0.9 }}>Target → Hospital</span>
                </button>

                <button
                  onClick={() => handleBroadcastZoneCap(selectedZone.id)}
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '9px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.45)'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    🚨 ISSUE OASIS CAP 1.2 BROADCAST
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: 600, opacity: 0.95 }}>Auto-Evac Order</span>
                </button>
              </div>
            </div>

            {/* Constituent Buildings Drill-down */}
            {(() => {
              const cIds = Array.isArray(selectedZone.constituentBuildingIds)
                ? selectedZone.constituentBuildingIds
                : (Array.isArray(selectedZone.constituent_building_ids)
                  ? selectedZone.constituent_building_ids
                  : (typeof selectedZone.constituentBuildingIds === 'string'
                    ? JSON.parse(selectedZone.constituentBuildingIds || '[]')
                    : []));
              if (!cIds || cIds.length === 0) return null;
              return (
                <div style={{ borderTop: `1px solid ${tokens.border}`, paddingTop: '8px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: tokens.textSecondary, textTransform: 'uppercase', marginBottom: '4px' }}>
                    Constituent {selectedScenarioId === 3 ? 'Observations' : 'Structures'} ({cIds.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                    {cIds.map(bId => {
                      const bMatch = rawDataRef.current.damages?.features?.find(f => (f.properties?.buildingId || f.properties?.id) === bId);
                      const dClass = bMatch?.properties?.damageClass || 'no-damage';
                      return (
                        <button
                          key={bId}
                          onClick={() => {
                            const priMatch = rawDataRef.current.priorities?.features?.find(f => (f.properties?.building_id || f.properties?.id) === bId);
                            if (bMatch) {
                              setSelectedBuilding({
                                ...bMatch.properties,
                                geometry: bMatch.geometry,
                                priorityInfo: priMatch?.properties
                              });
                            }
                          }}
                          style={{
                            padding: '2px 5px',
                            fontSize: '9px',
                            fontWeight: 700,
                            borderRadius: '3px',
                            border: `1px solid ${DAMAGE_COLORS[dClass] || tokens.border}`,
                            backgroundColor: DAMAGE_COLORS[dClass] ? `${DAMAGE_COLORS[dClass]}22` : tokens.bgTertiary,
                            color: tokens.textPrimary,
                            cursor: 'pointer'
                          }}
                        >
                          #{bId}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          /* Default Incident Snapshot & Operational Zones List */
          <div style={{
            backgroundColor: tokens.bgCard,
            border: `1px solid ${tokens.border}`,
            borderRadius: '8px',
            padding: '14px',
            boxShadow: tokens.shadow
          }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: tokens.textPrimary, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px', borderBottom: `1px solid ${tokens.border}`, paddingBottom: '6px' }}>
              INCIDENT SNAPSHOT & SECTOR OVERVIEW
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', backgroundColor: tokens.bgTertiary, borderRadius: '4px' }}>
                <span style={{ fontSize: '11px', color: tokens.textSecondary }}>Structures Assessed</span>
                <strong style={{ fontSize: '12px', color: tokens.textPrimary }}>{rawDataRef.current.damages?.features?.length || 0}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', backgroundColor: isDark ? '#2a1a1a' : '#fef2f2', borderRadius: '4px' }}>
                <span style={{ fontSize: '11px', color: isDark ? '#fca5a5' : '#991b1b' }}>Operational Sectors</span>
                <strong style={{ fontSize: '12px', color: '#dc2626' }}>{rawDataRef.current.zones?.features?.length || 0} Zones</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', backgroundColor: isDark ? '#13281c' : '#f0fdf4', borderRadius: '4px' }}>
                <span style={{ fontSize: '11px', color: isDark ? '#86efac' : '#166534' }}>Emergency Hospitals</span>
                <strong style={{ fontSize: '12px', color: '#059669' }}>{rawDataRef.current.hospitals?.features?.length || 0}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', backgroundColor: isDark ? '#162438' : '#f0f9ff', borderRadius: '4px' }}>
                <span style={{ fontSize: '11px', color: isDark ? '#93c5fd' : '#075985' }}>Relief Shelters</span>
                <strong style={{ fontSize: '12px', color: '#0284c7' }}>{rawDataRef.current.shelters?.features?.length || 0}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', backgroundColor: isDark ? '#221c35' : '#faf5ff', borderRadius: '4px' }}>
                <span style={{ fontSize: '11px', color: isDark ? '#d8b4fe' : '#6b21a8' }}>Blocked Corridors</span>
                <strong style={{ fontSize: '12px', color: '#7c3aed' }}>{rawDataRef.current.roads?.features?.filter(r => r.properties?.isBlocked)?.length || 0}</strong>
              </div>
            </div>

            {/* Operational Zones Quick Select Cards */}
            {rawDataRef.current.zones?.features && rawDataRef.current.zones.features.length > 0 && (
              <div style={{ marginTop: '10px', borderTop: `1px solid ${tokens.border}`, paddingTop: '8px' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: tokens.textSecondary, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Operational Sectors (Click to Inspect)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {rawDataRef.current.zones.features.map(feat => {
                    const zp = feat.properties;
                    const col = PRIORITY_COLORS[zp.criticality] || tokens.textPrimary;
                    return (
                      <div
                        key={zp.id}
                        onClick={() => {
                          setSelectedZone(zp);
                          const map = mapInstanceRef.current;
                          if (map) {
                            const bLayer = L.geoJSON(feat);
                            if (bLayer.getBounds().isValid()) {
                              map.fitBounds(bLayer.getBounds(), { padding: [40, 40] });
                            }
                          }
                        }}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: `1px solid ${tokens.border}`,
                          borderLeft: `4px solid ${col}`,
                          backgroundColor: tokens.bgTertiary,
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: tokens.textPrimary }}>
                            {zp.name}
                          </div>
                          <div style={{ fontSize: '9px', color: tokens.textSecondary }}>
                            {zp.totalBuildings} bldgs • {zp.destroyedCount} destroyed • ~{zp.estimatedPopulation} pop
                          </div>
                        </div>
                        <span style={{
                          fontSize: '8px',
                          fontWeight: 800,
                          backgroundColor: col,
                          color: '#fff',
                          padding: '2px 5px',
                          borderRadius: '3px'
                        }}>
                          {zp.criticality}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Calculated Authoritative Route Card */}
        {activeRoute && (
          <div style={{
            backgroundColor: activeRoute.routePurpose === 'RESPONSE' ? (isDark ? '#2a2216' : '#fffbeb') : (isDark ? '#162438' : '#f0f9ff'),
            border: `2px solid ${activeRoute.routePurpose === 'RESPONSE' ? '#d97706' : '#0284c7'}`,
            borderRadius: '8px',
            padding: '12px',
            boxShadow: tokens.shadow
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{
                fontSize: '12px',
                fontWeight: 800,
                color: activeRoute.routePurpose === 'RESPONSE' ? (isDark ? '#f59e0b' : '#b45309') : (isDark ? '#38bdf8' : '#0284c7')
              }}>
                {activeRoute.routePurpose === 'RESPONSE'
                  ? `RESPONDER ROUTE: EOC → Structure #${selectedBuilding?.id || activeRoute.priorityId}`
                  : `EVACUATION ROUTE: Structure #${selectedBuilding?.id || activeRoute.priorityId} → ${activeRoute.destinationName}`
                }
              </span>
              <button
                onClick={clearRoute}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '11px', color: tokens.textSecondary, fontWeight: 600 }}
              >
                ✕ Clear
              </button>
            </div>

            <div style={{ fontSize: '10px', color: tokens.textSecondary, marginBottom: '6px', lineHeight: 1.3 }}>
              {activeRoute.purposeDescription}
            </div>

            <div style={{ fontSize: '10px', marginBottom: '2px', color: tokens.textPrimary }}>
              Origin: <strong>{activeRoute.originName}</strong>
            </div>

            <div style={{ fontSize: '10px', marginBottom: '6px', color: tokens.textPrimary }}>
              Destination: <strong>{activeRoute.destinationName}</strong>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.7)', padding: '6px', borderRadius: '4px', marginBottom: '6px' }}>
              <div>
                <span style={{ fontSize: '9px', color: tokens.textSecondary, display: 'block' }}>Route Distance</span>
                <strong style={{ fontSize: '12px', color: tokens.textPrimary }}>{activeRoute.distanceKm} km</strong>
              </div>
              <div>
                <span style={{ fontSize: '9px', color: tokens.textSecondary, display: 'block' }}>Estimated Travel</span>
                <strong style={{ fontSize: '12px', color: tokens.textPrimary }}>~{activeRoute.estimatedMinutes} mins</strong>
              </div>
            </div>

            <div style={{ fontSize: '10px', display: 'flex', justifyContent: 'space-between', marginBottom: '2px', color: tokens.textPrimary }}>
              <span>Roadblocks Avoided:</span>
              <strong style={{ color: '#7c3aed' }}>{activeRoute.avoidedBlockageCount || 4} corridors</strong>
            </div>

            {/* Human-Readable Ordered Route Sequence */}
            {activeRoute.routeSteps && activeRoute.routeSteps.length > 0 && (
              <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: `1px solid ${tokens.border}` }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: tokens.textPrimary, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Ordered Route Sequence:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '9px', color: tokens.textSecondary }}>
                  {activeRoute.routeSteps.map((step, sIdx) => (
                    <div key={sIdx} style={{ display: 'flex', gap: '4px' }}>
                      <span style={{ fontWeight: 700, color: tokens.accent }}>{sIdx + 1}.</span>
                      <span style={{ color: tokens.textPrimary }}>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontSize: '9px', color: tokens.textSecondary, borderTop: `1px solid ${tokens.border}`, paddingTop: '4px', marginTop: '6px' }}>
              Suggested route. Verify current road conditions before deployment. (Graph Latency: {activeRoute.calculationTimeMs} ms)
            </div>
          </div>
        )}

      </div>

    </div>
  );
}

export default DisasterMap;
