import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

import {
  convertBuildingsTo3DEntities,
  convertRoadsTo3DEntities,
  convertFacilitiesTo3DEntities,
  convertHazardsTo3DEntities,
  convertZonesTo3DEntities,
  convertRouteTo3DEntities,
  convertBoundaryTo3DEntities
} from '../../services/map/cesiumAdapter';
import { cameraService } from '../../services/map/cameraService';
import { layerService } from '../../services/map/layerService';
import CesiumControls from './CesiumControls';
import GlobeLegend from './GlobeLegend';
import GlobeSearch from './GlobeSearch';

/**
 * DRAS v2.0 — Cesium 3D Earth Operations Map Component
 * Full-scale WebGL 3D globe with 3D buildings, terrain, road hazards, facilities, and dual routing.
 */
export default function CesiumGlobe({
  selectedScenarioId = 1,
  scenarios = [],
  onSelectScenario,
  mapMode = 'DAMAGE',
  setMapMode,
  viewLevel = 'BOTH',
  layers = {},
  damageFilter = 'ALL',
  priorityFilter = 'ALL',
  confidenceThreshold = 0.0,
  selectedBuilding = null,
  onSelectBuilding,
  selectedZone = null,
  onSelectZone,
  activeRoute = null,
  rawDataRef,
  gisDataVersion = 0,
  mapViewMode = '3D',
  setMapViewMode,
  presentationMode = false,
  setPresentationMode,
  isDark = true,
  tokens = {}
}) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  // DataSources for fast batch layer toggling
  const dataSourcesRef = useRef({
    boundary: new Cesium.CustomDataSource('dras-boundary'),
    zones: new Cesium.CustomDataSource('dras-zones'),
    hazards: new Cesium.CustomDataSource('dras-hazards'),
    buildings: new Cesium.CustomDataSource('dras-buildings'),
    roads: new Cesium.CustomDataSource('dras-roads'),
    facilities: new Cesium.CustomDataSource('dras-facilities'),
    routes: new Cesium.CustomDataSource('dras-routes')
  });

  // Environment States
  const [baseMap, setBaseMap] = useState('SATELLITE');
  const [enableTerrain, setEnableTerrain] = useState(true);
  const [lightingMode, setLightingMode] = useState('DAY');
  const [isOrbiting, setIsOrbiting] = useState(false);
  const [hoveredEntity, setHoveredEntity] = useState(null);

  // 1. Initialize Cesium Viewer
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    // Optional Cesium Ion Token from environment
    const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN || '';
    if (ionToken && ionToken.trim().length > 10) {
      Cesium.Ion.defaultAccessToken = ionToken.trim();
    }

    const viewer = new Cesium.Viewer(containerRef.current, {
      animation: false,
      baseLayer: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      vrButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      navigationInstructionsInitiallyVisible: false,
      creditContainer: document.createElement('div'), // hide default watermark
      terrainProvider: new Cesium.EllipsoidTerrainProvider()
    });

    // Scene configurations
    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.globe.enableLighting = false;
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = 0.00015;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 40;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 30000000;

    // Attach all DataSources
    Object.values(dataSourcesRef.current).forEach(ds => {
      viewer.dataSources.add(ds);
    });

    // Set Default BaseMap
    layerService.setBaseMap(viewer, 'SATELLITE');

    // Attempt Terrain
    layerService.setTerrain(viewer, true, ionToken);

    viewerRef.current = viewer;
    window.Cesium = Cesium;
    window.__DRAS_CESIUM_VIEWER__ = viewer;
    window.__DRAS_CESIUM_CAMERA__ = cameraService;

    // Initial dramatic flight from high orbit
    cameraService.flyToScenario(viewer, selectedScenarioId, true);

    // Setup Click & Hover Handlers
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    // Click: Select Building / Facility
    handler.setInputAction((movement) => {
      const picked = viewer.scene.pick(movement.position);
      if (Cesium.defined(picked) && picked.id && picked.id.properties) {
        const props = picked.id.properties;
        const drasType = props._drasType ? props._drasType.getValue() : null;

        if (drasType === 'building') {
          const rawFeat = props.rawFeature ? props.rawFeature.getValue() : null;
          if (rawFeat && onSelectBuilding) {
            onSelectBuilding(rawFeat);
            let lon = null, lat = null;
            if (rawFeat.geometry) {
              const { type, coordinates } = rawFeat.geometry;
              if (type === 'Point' && Array.isArray(coordinates)) {
                lon = coordinates[0];
                lat = coordinates[1];
              } else if (Array.isArray(coordinates)) {
                let sumLon = 0, sumLat = 0, count = 0;
                const traverse = (c) => {
                  if (!Array.isArray(c)) return;
                  if (typeof c[0] === 'number' && typeof c[1] === 'number') {
                    sumLon += c[0];
                    sumLat += c[1];
                    count++;
                  } else {
                    c.forEach(traverse);
                  }
                };
                traverse(coordinates);
                if (count > 0) {
                  lon = sumLon / count;
                  lat = sumLat / count;
                }
              }
            }
            if (typeof lon === 'number' && typeof lat === 'number' && !isNaN(lon) && !isNaN(lat)) {
              cameraService.flyToBuilding(viewer, lon, lat, 20);
            }
          }
        } else if (drasType === 'operational_zone' || drasType === 'zone_badge') {
          const rawFeat = props.rawFeature ? props.rawFeature.getValue() : null;
          const zProps = rawFeat?.properties || props;
          if (onSelectZone) {
            onSelectZone(zProps);
          }
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Double-Click: Smoothly zoom into clicked geographic point
    handler.setInputAction((movement) => {
      try {
        const cartesian = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid);
        if (cartesian) {
          const carto = Cesium.Cartographic.fromCartesian(cartesian);
          const lon = Cesium.Math.toDegrees(carto.longitude);
          const lat = Cesium.Math.toDegrees(carto.latitude);
          const currentHeight = viewer.camera.positionCartographic?.height || 3500;
          const targetHeight = Math.max(250, currentHeight * 0.45);
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lon, lat - 0.0015, targetHeight),
            duration: 1.2,
            easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT
          });
        }
      } catch (err) {}
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    // Throttled Hover Tooltip
    let hoverTimeout = null;
    handler.setInputAction((movement) => {
      if (hoverTimeout) return;
      hoverTimeout = setTimeout(() => {
        hoverTimeout = null;
        try {
          if (!viewer || (typeof viewer.isDestroyed === 'function' && viewer.isDestroyed())) return;
          const picked = viewer.scene.pick(movement.endPosition);
          if (Cesium.defined(picked) && picked.id && picked.id.properties) {
            const props = picked.id.properties;
            const drasType = props._drasType ? props._drasType.getValue() : null;
            if (drasType === 'building') {
              const bId = props.buildingId ? props.buildingId.getValue() : (props.id ? props.id.getValue() : 'N/A');
              const dClass = props.damageClass ? props.damageClass.getValue() : 'no-damage';
              const pScore = props.priorityScore ? props.priorityScore.getValue() : null;
              setHoveredEntity({
                type: 'building',
                id: bId,
                damageClass: dClass,
                priorityScore: pScore,
                x: movement.endPosition.x,
                y: movement.endPosition.y
              });
              return;
            } else if (drasType === 'operational_zone' || drasType === 'zone_badge') {
              setHoveredEntity({
                type: 'zone',
                name: props.name ? props.name.getValue() : 'Operational Sector',
                criticality: props.criticality ? props.criticality.getValue() : 'LOW',
                totalBuildings: props.totalBuildings ? props.totalBuildings.getValue() : 0,
                x: movement.endPosition.x,
                y: movement.endPosition.y
              });
              return;
            }
          }
          setHoveredEntity(null);
        } catch (e) {
          setHoveredEntity(null);
        }
      }, 40);
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // Native Wheel Handler on Container to prevent entire-page scroll and ensure smooth zoom
    const container = containerRef.current;
    const handleContainerWheel = (e) => {
      e.preventDefault();
      try {
        if (!viewer || (typeof viewer.isDestroyed === 'function' && viewer.isDestroyed())) return;
        if (e.deltaY > 0) {
          cameraService.zoomOut(viewer, 0.2);
        } else if (e.deltaY < 0) {
          cameraService.zoomIn(viewer, 0.2);
        }
      } catch (err) {}
    };
    if (container) {
      container.addEventListener('wheel', handleContainerWheel, { passive: false });
    }

    // Keyboard Zoom Controls (+ / -)
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
      if (e.key === '+' || e.key === '=') {
        cameraService.zoomIn(viewer, 0.3);
      } else if (e.key === '-' || e.key === '_') {
        cameraService.zoomOut(viewer, 0.3);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup on unmount
    return () => {
      if (container) {
        container.removeEventListener('wheel', handleContainerWheel);
      }
      window.removeEventListener('keydown', handleKeyDown);
      delete window.__DRAS_CESIUM_VIEWER__;
      delete window.__DRAS_CESIUM_CAMERA__;
      handler.destroy();
      cameraService.stopOrbit(viewer);
      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
    };
  }, []);

  // 2. Scenario Change: Transition camera & reload layers
  useEffect(() => {
    if (!viewerRef.current) return;
    cameraService.flyToScenario(viewerRef.current, selectedScenarioId, false);
  }, [selectedScenarioId]);

  // 2b. Fly to Selected Building when clicked in sidebar or on map
  useEffect(() => {
    if (!viewerRef.current || !selectedBuilding) return;
    const geom = selectedBuilding.geometry;
    let lon = null, lat = null;
    if (geom?.type === 'Point' && Array.isArray(geom.coordinates)) {
      lon = geom.coordinates[0];
      lat = geom.coordinates[1];
    } else if (geom?.coordinates) {
      const ring = geom.coordinates[0] || [];
      if (ring.length > 0) {
        let sumLon = 0, sumLat = 0;
        ring.forEach(pt => { sumLon += pt[0]; sumLat += pt[1]; });
        lon = sumLon / ring.length;
        lat = sumLat / ring.length;
      }
    }
    if (typeof lon === 'number' && typeof lat === 'number' && !isNaN(lon) && !isNaN(lat)) {
      cameraService.flyToBuilding(viewerRef.current, lon, lat, 20);
    }
  }, [selectedBuilding]);

  // 2c. Fly to Selected Zone when clicked in sidebar or on map
  useEffect(() => {
    if (!viewerRef.current || !selectedZone) return;
    const geom = selectedZone.geometry || selectedZone.zone_geometry;
    if (geom?.coordinates) {
      const ring = geom.coordinates[0] || [];
      if (ring.length > 0) {
        let sumLon = 0, sumLat = 0;
        ring.forEach(pt => { sumLon += pt[0]; sumLat += pt[1]; });
        const cLon = sumLon / ring.length;
        const cLat = sumLat / ring.length;
        viewerRef.current.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(cLon, cLat - 0.007, 1000),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-42),
            roll: 0
          },
          duration: 1.5
        });
      }
    }
  }, [selectedZone]);

  // 3. Render / Update 3D Buildings
  const updateBuildings = useCallback(() => {
    const ds = dataSourcesRef.current.buildings;
    ds.entities.removeAll();

    if (!layers.damages && !layers.priorities) {
      ds.show = false;
      return;
    }
    ds.show = true;

    const raw = rawDataRef.current;
    const features = mapMode === 'PRIORITY' 
      ? (raw.priorities?.features || raw.damages?.features || [])
      : (raw.damages?.features || []);

    const isFani = selectedScenarioId === 3;
    const selectedBldgId = selectedBuilding?.properties?.buildingId 
      || selectedBuilding?.properties?.building_id 
      || selectedBuilding?.properties?.id 
      || null;

    const entities = convertBuildingsTo3DEntities(features, {
      colorMode: mapMode === 'PRIORITY' ? 'PRIORITY' : 'DAMAGE',
      damageFilter,
      priorityFilter,
      confidenceThreshold,
      selectedBuildingId: selectedBldgId,
      isFani
    });

    for (const ent of entities) {
      ds.entities.add(ent);
    }
  }, [mapMode, layers.damages, layers.priorities, damageFilter, priorityFilter, confidenceThreshold, selectedBuilding, selectedScenarioId, gisDataVersion]);

  useEffect(() => {
    updateBuildings();
  }, [updateBuildings]);

  // 4. Render / Update Roads
  useEffect(() => {
    const ds = dataSourcesRef.current.roads;
    ds.entities.removeAll();

    if (!layers.roads) {
      ds.show = false;
      return;
    }
    ds.show = true;

    const roads = rawDataRef.current.roads?.features || [];
    const entities = convertRoadsTo3DEntities(roads);
    for (const ent of entities) {
      ds.entities.add(ent);
    }
  }, [layers.roads, selectedScenarioId, gisDataVersion]);

  // 5. Render / Update Emergency Facilities (Hospitals & Shelters)
  useEffect(() => {
    const ds = dataSourcesRef.current.facilities;
    ds.entities.removeAll();

    const showH = layers.hospitals !== false;
    const showS = layers.shelters !== false;

    if (!showH && !showS) {
      ds.show = false;
      return;
    }
    ds.show = true;

    const hospitals = showH ? (rawDataRef.current.hospitals?.features || []) : [];
    const shelters = showS ? (rawDataRef.current.shelters?.features || []) : [];

    const entities = convertFacilitiesTo3DEntities(hospitals, shelters);
    for (const ent of entities) {
      ds.entities.add(ent);
    }
  }, [layers.hospitals, layers.shelters, selectedScenarioId, gisDataVersion]);

  // 6. Render / Update Hazards (e.g. 20.4 ha Dharali debris fan, Chamoli glacial surge)
  useEffect(() => {
    const ds = dataSourcesRef.current.hazards;
    ds.entities.removeAll();

    if (!layers.hazards) {
      ds.show = false;
      return;
    }
    ds.show = true;

    const hazards = rawDataRef.current.hazards?.features || [];
    const entities = convertHazardsTo3DEntities(hazards, selectedScenarioId);
    for (const ent of entities) {
      ds.entities.add(ent);
    }
  }, [layers.hazards, selectedScenarioId, gisDataVersion]);

  // 6b. Render / Update Operational Zones (4-tier macro sectors)
  useEffect(() => {
    const ds = dataSourcesRef.current.zones;
    ds.entities.removeAll();

    const showZones = layers.zones !== false && (viewLevel === 'ZONES' || viewLevel === 'BOTH');
    if (!showZones) {
      ds.show = false;
      return;
    }
    ds.show = true;

    const zones = rawDataRef.current.zones?.features || [];
    const entities = convertZonesTo3DEntities(zones, { selectedZone });
    for (const ent of entities) {
      ds.entities.add(ent);
    }
  }, [layers.zones, viewLevel, selectedScenarioId, selectedZone, gisDataVersion]);

  // 6c. Render / Update Disaster Perimeter Boundary (Scenario Extent)
  useEffect(() => {
    const ds = dataSourcesRef.current.boundary;
    ds.entities.removeAll();

    if (layers.boundary === false) {
      ds.show = false;
      return;
    }
    ds.show = true;

    const scen = rawDataRef.current.scenario;
    if (scen && scen.boundary) {
      const entities = convertBoundaryTo3DEntities(scen.boundary, scen.name || 'Disaster Area');
      for (const ent of entities) {
        ds.entities.add(ent);
      }
    }
  }, [layers.boundary, selectedScenarioId, gisDataVersion]);

  // 7. Render / Update Active 3D Route
  useEffect(() => {
    const ds = dataSourcesRef.current.routes;
    ds.entities.removeAll();

    if (!activeRoute) {
      ds.show = false;
      return;
    }
    ds.show = true;

    const entities = convertRouteTo3DEntities(activeRoute);
    for (const ent of entities) {
      ds.entities.add(ent);
    }

    // Auto-fit camera to route if newly generated
    const routeCoords = activeRoute.routeGeoJson?.geometry?.coordinates 
      || activeRoute.routeGeoJson?.coordinates 
      || activeRoute.geometry?.coordinates;

    if (viewerRef.current && routeCoords && routeCoords.length >= 2) {
      cameraService.flyToRoute(viewerRef.current, routeCoords);
    }
  }, [activeRoute]);

  // 8. Base Map Switching
  useEffect(() => {
    if (viewerRef.current) {
      layerService.setBaseMap(viewerRef.current, baseMap);
    }
  }, [baseMap]);

  // 9. Terrain Toggling
  useEffect(() => {
    if (viewerRef.current) {
      const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN || '';
      layerService.setTerrain(viewerRef.current, enableTerrain, ionToken);
    }
  }, [enableTerrain]);

  // 10. Day / Night Lighting
  useEffect(() => {
    if (viewerRef.current) {
      layerService.setEarthLighting(viewerRef.current, lightingMode);
    }
  }, [lightingMode]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', backgroundColor: '#020617' }} />

      {/* Floating 3D HUD & Map Controls */}
      <CesiumControls
        mapViewMode={mapViewMode}
        setMapViewMode={setMapViewMode}
        baseMap={baseMap}
        setBaseMap={setBaseMap}
        enableTerrain={enableTerrain}
        setEnableTerrain={setEnableTerrain}
        lightingMode={lightingMode}
        setLightingMode={setLightingMode}
        activeRoute={activeRoute}
        onResetNorth={() => cameraService.resetNorth(viewerRef.current)}
        onToggleTilt={() => cameraService.toggleTilt(viewerRef.current)}
        onToggleOrbit={() => cameraService.toggleOrbit(viewerRef.current, isOrbiting, setIsOrbiting)}
        isOrbiting={isOrbiting}
        onFocusRoute={() => {
          if (activeRoute?.routeGeoJson?.coordinates) {
            cameraService.flyToRoute(viewerRef.current, activeRoute.routeGeoJson.coordinates);
          }
        }}
        onResetHome={() => cameraService.flyToScenario(viewerRef.current, selectedScenarioId, false)}
        onZoomIn={() => cameraService.zoomIn(viewerRef.current, 0.35)}
        onZoomOut={() => cameraService.zoomOut(viewerRef.current, 0.45)}
        presentationMode={presentationMode}
        setPresentationMode={setPresentationMode}
        selectedScenarioId={selectedScenarioId}
        mapMode={mapMode}
        setMapMode={setMapMode}
        isDark={isDark}
      />

      {/* 3D Omni-Search HUD */}
      {!presentationMode && (
        <GlobeSearch
          buildings={rawDataRef.current.damages?.features || []}
          hospitals={rawDataRef.current.hospitals?.features || []}
          shelters={rawDataRef.current.shelters?.features || []}
          scenarios={scenarios}
          onSelectBuilding={(bldg) => {
            if (onSelectBuilding) onSelectBuilding(bldg);
            const coords = bldg.geometry?.coordinates;
            let lon, lat;
            if (bldg.geometry.type === 'Point') {
              lon = coords[0]; lat = coords[1];
            } else if (coords?.[0]?.[0]) {
              lon = coords[0][0][0]; lat = coords[0][0][1];
            }
            if (lon && lat && viewerRef.current) {
              cameraService.flyToBuilding(viewerRef.current, lon, lat, 20);
            }
          }}
          onSelectHospital={(hosp) => {
            const coords = hosp.geometry?.coordinates;
            if (coords && viewerRef.current) {
              cameraService.flyToBuilding(viewerRef.current, coords[0], coords[1], 30);
            }
          }}
          onSelectShelter={(shltr) => {
            const coords = shltr.geometry?.coordinates;
            if (coords && viewerRef.current) {
              cameraService.flyToBuilding(viewerRef.current, coords[0], coords[1], 30);
            }
          }}
          onSelectScenario={(scId) => {
            if (onSelectScenario) onSelectScenario(scId);
          }}
          isDark={isDark}
        />
      )}

      {/* Collapsible 3D Legend */}
      {!presentationMode && (
        <GlobeLegend
          mapMode={mapMode}
          selectedScenarioId={selectedScenarioId}
          isDark={isDark}
          tokens={tokens}
        />
      )}

      {/* Hover Info Tooltip */}
      {hoveredEntity && (
        <div style={{
          position: 'absolute',
          left: `${hoveredEntity.x + 15}px`,
          top: `${hoveredEntity.y - 15}px`,
          pointerEvents: 'none',
          zIndex: 2000,
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          border: `1.5px solid ${isDark ? '#38bdf8' : '#0284c7'}`,
          borderRadius: '6px',
          padding: '6px 10px',
          fontSize: '11px',
          color: isDark ? '#f8fafc' : '#0f172a',
          boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          {hoveredEntity.type === 'zone' ? (
            <>
              <div style={{ fontWeight: 800, color: '#38bdf8' }}>{hoveredEntity.name}</div>
              <div style={{ fontSize: '10px', marginTop: '2px' }}>
                Tier: <strong style={{ color: hoveredEntity.criticality === 'CRITICAL' ? '#ef4444' : hoveredEntity.criticality === 'HIGH' ? '#f97316' : hoveredEntity.criticality === 'MEDIUM' ? '#eab308' : '#10b981' }}>{hoveredEntity.criticality}</strong>
              </div>
              <div style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b' }}>
                Buildings: <strong>{hoveredEntity.totalBuildings}</strong>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 800 }}>Structure #{hoveredEntity.id}</div>
              <div style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b' }}>
                Damage: <strong style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>{hoveredEntity.damageClass?.toUpperCase()}</strong>
              </div>
              {hoveredEntity.priorityScore && (
                <div style={{ fontSize: '10px', color: '#f59e0b' }}>
                  Priority: {(hoveredEntity.priorityScore * 100).toFixed(0)}%
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
