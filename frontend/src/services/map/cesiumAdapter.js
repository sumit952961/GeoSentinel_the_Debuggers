import * as Cesium from 'cesium';

/**
 * DRAS v2.0 — Cesium 3D Geospatial Adapter
 * Converts DRAS PostGIS GeoJSON features into 3D Cesium entities.
 */

export const DAMAGE_COLORS = {
  'no-damage': '#10b981',     // Green / Emerald
  'minor-damage': '#f59e0b',  // Yellow / Amber
  'major-damage': '#f97316',  // Orange
  'destroyed': '#ef4444',     // Red / Crimson
  'unknown': '#94a3b8'        // Slate
};

export const PRIORITY_COLORS = {
  'CRITICAL': '#dc2626',
  'HIGH': '#ea580c',
  'MEDIUM': '#d97706',
  'LOW': '#059669'
};

/**
 * Returns Cesium.Color for a damage class
 */
export function getCesiumDamageColor(damageClass, alpha = 0.88) {
  const hex = DAMAGE_COLORS[damageClass] || DAMAGE_COLORS['unknown'];
  return Cesium.Color.fromCssColorString(hex).withAlpha(alpha);
}

/**
 * Returns Cesium.Color for a priority level
 */
export function getCesiumPriorityColor(priorityLevel, alpha = 0.88) {
  const hex = PRIORITY_COLORS[priorityLevel] || '#0284c7';
  return Cesium.Color.fromCssColorString(hex).withAlpha(alpha);
}

/**
 * Computes estimated extrusion height for 3D building.
 * Documented approximation: Base height estimated from footprint area + priority triage bonus.
 */
export function estimateBuildingHeight(properties = {}, priorityLevel = 'LOW') {
  if (properties.building_height && properties.building_height > 0) {
    return properties.building_height;
  }
  const area = properties.area || properties.footprint_area || 100;
  // Controlled baseline height between 8m and 22m
  const baseHeight = Math.max(8, Math.min(22, Math.sqrt(area) * 0.85));
  
  // Subtle triage bonus for immediate visual recognition in 3D
  let triageBonus = 0;
  if (priorityLevel === 'CRITICAL') triageBonus = 8.0;
  else if (priorityLevel === 'HIGH') triageBonus = 4.0;
  else if (priorityLevel === 'MEDIUM') triageBonus = 2.0;

  return Math.round((baseHeight + triageBonus) * 10) / 10;
}

/**
 * Extracts coordinate list from GeoJSON Geometry
 */
function getLinearRingCoordinates(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') {
    return geom.coordinates[0] || [];
  }
  if (geom.type === 'MultiPolygon') {
    return geom.coordinates[0]?.[0] || [];
  }
  return [];
}

/**
 * Converts GeoJSON damages / buildings to 3D extruded Cesium entities.
 */
export function convertBuildingsTo3DEntities(features = [], options = {}) {
  const {
    colorMode = 'DAMAGE', // 'DAMAGE' or 'PRIORITY'
    damageFilter = 'ALL',
    priorityFilter = 'ALL',
    confidenceThreshold = 0.0,
    selectedBuildingId = null,
    isFani = false
  } = options;

  const entities = [];

  for (const feat of features) {
    if (!feat || !feat.geometry) continue;

    const props = feat.properties || {};
    const bldgId = props.buildingId || props.building_id || props.id;
    const dClass = props.damageClass || props.damage_class || 'no-damage';
    const conf = props.confidence ?? 1.0;
    const priorityLevel = props.priorityLevel || props.priority_level || 'LOW';
    const isSelected = selectedBuildingId !== null && String(bldgId) === String(selectedBuildingId);

    // Apply Damage Filter
    if (damageFilter !== 'ALL' && dClass !== damageFilter) continue;
    // Apply Priority Filter
    if (priorityFilter !== 'ALL' && priorityLevel !== priorityFilter) continue;
    // Apply Confidence Threshold
    if (conf < confidenceThreshold) continue;

    // Color Determination
    const baseColor = colorMode === 'PRIORITY' 
      ? getCesiumPriorityColor(priorityLevel, isSelected ? 0.98 : 0.85)
      : getCesiumDamageColor(dClass, isSelected ? 0.98 : 0.85);

    const height = estimateBuildingHeight(props, priorityLevel);

    // Case A: Point Observations (render as extruded 3D architectural box instead of dots)
    if (feat.geometry.type === 'Point') {
      const coords = feat.geometry.coordinates;
      const lon = coords[0];
      const lat = coords[1];
      const d = 0.00009; // ~10m x 10m footprint
      const targetExtrudedHeight = isSelected ? Math.max(35, height * 2.2 + 15) : Math.max(22, height * 1.8);

      const boxPositions = Cesium.Cartesian3.fromDegreesArray([
        lon - d, lat - d,
        lon + d, lat - d,
        lon + d, lat + d,
        lon - d, lat + d
      ]);
      const roofBoxPositions = [
        Cesium.Cartesian3.fromDegrees(lon - d, lat - d, targetExtrudedHeight),
        Cesium.Cartesian3.fromDegrees(lon + d, lat - d, targetExtrudedHeight),
        Cesium.Cartesian3.fromDegrees(lon + d, lat + d, targetExtrudedHeight),
        Cesium.Cartesian3.fromDegrees(lon - d, lat + d, targetExtrudedHeight),
        Cesium.Cartesian3.fromDegrees(lon - d, lat - d, targetExtrudedHeight)
      ];

      // 3D Building Volume
      entities.push({
        id: `building-${bldgId}`,
        name: `Structure #${bldgId}`,
        polygon: {
          hierarchy: boxPositions,
          height: 0,
          extrudedHeight: targetExtrudedHeight,
          material: isSelected
            ? new Cesium.ColorMaterialProperty(Cesium.Color.fromCssColorString('#ffffff').withAlpha(0.98))
            : new Cesium.ColorMaterialProperty(baseColor)
        },
        properties: {
          ...props,
          _drasType: 'building',
          rawFeature: feat,
          estimatedHeightMeters: height
        }
      });

      // Roof Outline
      entities.push({
        id: `building-roof-${bldgId}`,
        name: `Structure #${bldgId} Roof Outline`,
        polyline: {
          positions: roofBoxPositions,
          width: isSelected ? 3.5 : 2.0,
          material: isSelected ? Cesium.Color.RED : Cesium.Color.fromCssColorString('#020617').withAlpha(0.9)
        },
        properties: {
          ...props,
          _drasType: 'building',
          rawFeature: feat
        }
      });

      // Active beacon ONLY when selected
      if (isSelected) {
        entities.push({
          id: `building-pin-${bldgId}`,
          name: `Structure #${bldgId} Active Target`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, targetExtrudedHeight + 3.0),
          point: {
            pixelSize: 14,
            color: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.RED,
            outlineWidth: 3,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          },
          properties: {
            ...props,
            _drasType: 'building',
            rawFeature: feat
          }
        });
      }
      continue;
    }

    // Case B: Polygonal Building Footprints (Woolsey, Chamoli, Fani, Dharali)
    const ring = getLinearRingCoordinates(feat.geometry);
    if (!ring || ring.length < 3) continue;

    // Flatten coords into [lon, lat, lon, lat, ...] and compute centroid
    const flatPositions = [];
    const roofPositions = [];
    let sumLon = 0, sumLat = 0;
    const targetExtrudedHeight = isSelected ? Math.max(35, height * 2.2 + 15) : Math.max(22, height * 1.8);

    for (const pt of ring) {
      flatPositions.push(pt[0], pt[1]);
      roofPositions.push(Cesium.Cartesian3.fromDegrees(pt[0], pt[1], targetExtrudedHeight));
      sumLon += pt[0];
      sumLat += pt[1];
    }
    // Close roof ring
    if (ring.length > 0) {
      roofPositions.push(Cesium.Cartesian3.fromDegrees(ring[0][0], ring[0][1], targetExtrudedHeight));
    }
    const centroidLon = sumLon / ring.length;
    const centroidLat = sumLat / ring.length;

    try {
      const positions = Cesium.Cartesian3.fromDegreesArray(flatPositions);
      if (positions.length < 3) continue;

      // 1. 3D Extruded Building Geometry (Pure 3D architectural volume)
      entities.push({
        id: `building-${bldgId}`,
        name: `Structure #${bldgId}`,
        polygon: {
          hierarchy: positions,
          height: 0,
          extrudedHeight: targetExtrudedHeight,
          material: isSelected 
            ? new Cesium.ColorMaterialProperty(Cesium.Color.fromCssColorString('#ffffff').withAlpha(0.98))
            : new Cesium.ColorMaterialProperty(baseColor)
        },
        properties: {
          ...props,
          _drasType: 'building',
          rawFeature: feat,
          estimatedHeightMeters: height
        }
      });

      // 2. High-Definition Roof Outline Polyline (Architectural definition on 3D globe)
      entities.push({
        id: `building-roof-${bldgId}`,
        name: `Structure #${bldgId} Roof Outline`,
        polyline: {
          positions: roofPositions,
          width: isSelected ? 3.5 : 2.0,
          material: isSelected 
            ? Cesium.Color.RED 
            : Cesium.Color.fromCssColorString('#020617').withAlpha(0.9)
        },
        properties: {
          ...props,
          _drasType: 'building',
          rawFeature: feat
        }
      });

      // 3. Highlight Beacon ONLY when building is explicitly selected
      // Regular structures display purely as 3D extruded buildings without distracting dot clutter
      if (isSelected) {
        entities.push({
          id: `building-pin-${bldgId}`,
          name: `Structure #${bldgId} Active Target`,
          position: Cesium.Cartesian3.fromDegrees(centroidLon, centroidLat, targetExtrudedHeight + 3.0),
          point: {
            pixelSize: 14,
            color: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.RED,
            outlineWidth: 3,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          },
          properties: {
            ...props,
            _drasType: 'building',
            rawFeature: feat,
            estimatedHeightMeters: height
          }
        });
      }
    } catch (e) {
      console.warn(`Failed to parse building polygon #${bldgId}`, e);
    }
  }

  return entities;
}

/**
 * Converts GeoJSON Roads to 3D Cesium entities.
 * Blocked corridors are styled in bold purple with a 3D billboard indicator.
 */
export function convertRoadsTo3DEntities(roadFeatures = []) {
  const entities = [];

  for (let i = 0; i < roadFeatures.length; i++) {
    const feat = roadFeatures[i];
    if (!feat || !feat.geometry) continue;

    const props = feat.properties || {};
    const roadId = props.id || props.roadId || i;
    const isBlocked = props.isBlocked || props.is_blocked;
    const reason = props.blockageReason || props.blockage_reason || 'Road Blocked';

    const coords = feat.geometry.coordinates;
    if (!coords || coords.length < 2) continue;

    const flatCoords = [];
    for (const pt of coords) {
      flatCoords.push(pt[0], pt[1]);
    }

    try {
      const positions = Cesium.Cartesian3.fromDegreesArray(flatCoords);
      const entityId = `road-${roadId}`;

      // Road line
      entities.push({
        id: entityId,
        name: isBlocked ? `⛔ BLOCKED ROAD: ${props.name || 'Unnamed'}` : (props.name || 'Road Corridor'),
        polyline: {
          positions,
          width: isBlocked ? 5.5 : 2.5,
          clampToGround: true,
          material: isBlocked
            ? new Cesium.PolylineDashMaterialProperty({
                color: Cesium.Color.fromCssColorString('#a855f7'),
                dashLength: 16.0
              })
            : Cesium.Color.fromCssColorString('#64748b').withAlpha(0.75)
        },
        properties: {
          ...props,
          _drasType: 'road'
        }
      });

      // If road is blocked, add a prominent 3D label badge at the midpoint
      if (isBlocked && coords.length > 0) {
        const midIdx = Math.floor(coords.length / 2);
        const midPt = coords[midIdx];
        entities.push({
          id: `road-blocked-badge-${roadId}`,
          name: `Roadblock Indicator`,
          position: Cesium.Cartesian3.fromDegrees(midPt[0], midPt[1]),
          label: {
            text: `⛔ BLOCKED: ${reason}`,
            font: 'bold 11px sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.fromCssColorString('#581c87'),
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            backgroundColor: Cesium.Color.fromCssColorString('rgba(88, 28, 135, 0.9)'),
            showBackground: true,
            backgroundPadding: new Cesium.Cartesian2(7, 4),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -22),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          },
          properties: {
            ...props,
            _drasType: 'roadblock_badge'
          }
        });
      }
    } catch (e) {
      console.warn(`Failed to parse road line #${roadId}`, e);
    }
  }

  return entities;
}

/**
 * Converts Hospitals and Relief Shelters to 3D Cesium billboard/label entities.
 */
export function convertFacilitiesTo3DEntities(hospitals = [], shelters = []) {
  const entities = [];

  // 1. Emergency Hospitals
  for (const h of hospitals) {
    if (!h.geometry?.coordinates) continue;
    const [lon, lat] = h.geometry.coordinates;
    const p = h.properties || {};
    const hid = p.id || p.hospitalId || `h-${lon}-${lat}`;

    entities.push({
      id: `hospital-${hid}`,
      name: p.name || 'Emergency Hospital',
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      point: {
        pixelSize: 14,
        color: Cesium.Color.fromCssColorString('#dc2626'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2.5,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: `🏥 ${p.name || 'Hospital'}\n(${p.availableBeds || p.capacity || 'Active'} Beds)`,
        font: 'bold 11px sans-serif',
        fillColor: Cesium.Color.WHITE,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(153, 27, 27, 0.88)'),
        showBackground: true,
        backgroundPadding: new Cesium.Cartesian2(6, 4),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      properties: {
        ...p,
        _drasType: 'hospital'
      }
    });
  }

  // 2. Relief Shelters
  for (const s of shelters) {
    if (!s.geometry?.coordinates) continue;
    const [lon, lat] = s.geometry.coordinates;
    const p = s.properties || {};
    const sid = p.id || p.shelterId || `s-${lon}-${lat}`;

    entities.push({
      id: `shelter-${sid}`,
      name: p.name || 'Relief Shelter',
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      point: {
        pixelSize: 14,
        color: Cesium.Color.fromCssColorString('#0284c7'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2.5,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: `⛺ ${p.name || 'Shelter'}\n(${p.capacity || '100'} Evacuees)`,
        font: 'bold 11px sans-serif',
        fillColor: Cesium.Color.WHITE,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(3, 105, 161, 0.88)'),
        showBackground: true,
        backgroundPadding: new Cesium.Cartesian2(6, 4),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      properties: {
        ...p,
        _drasType: 'shelter'
      }
    });
  }

  return entities;
}

/**
 * Converts Hazard Zones (e.g. 20.4 ha Dharali debris fan, Chamoli surge) to 3D entities.
 */
/**
 * Converts Disaster Scenario Boundary into marked 3D perimeter entities.
 */
export function convertBoundaryTo3DEntities(boundaryGeom, scenarioName = 'Disaster Area') {
  if (!boundaryGeom) return [];
  const entities = [];

  const ring = getLinearRingCoordinates(boundaryGeom);
  if (!ring || ring.length < 3) return [];

  const flatCoords = [];
  let maxLat = -90, northLon = 0;
  for (const pt of ring) {
    flatCoords.push(pt[0], pt[1]);
    if (pt[1] > maxLat) {
      maxLat = pt[1];
      northLon = pt[0];
    }
  }
  const closedCoords = [...flatCoords, flatCoords[0], flatCoords[1]];

  try {
    const positions = Cesium.Cartesian3.fromDegreesArray(flatCoords);

    // 1. Shaded Incident Perimeter Area (Clamped to ground)
    entities.push({
      id: 'disaster-perimeter-fill',
      name: `Incident Perimeter: ${scenarioName}`,
      polygon: {
        hierarchy: positions,
        material: new Cesium.ColorMaterialProperty(Cesium.Color.fromCssColorString('#ef4444').withAlpha(0.12)),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      },
      properties: {
        _drasType: 'disaster_boundary'
      }
    });

    // 2. High-Contrast Dashed Red Perimeter Boundary Line
    entities.push({
      id: 'disaster-perimeter-line',
      name: `Disaster Boundary Line: ${scenarioName}`,
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray(closedCoords),
        width: 4.5,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString('#dc2626'),
          gapColor: Cesium.Color.fromCssColorString('#ffffff').withAlpha(0.7),
          dashLength: 20.0
        }),
        clampToGround: true
      },
      properties: {
        _drasType: 'disaster_boundary'
      }
    });

    // 3. Floating Incident Demarcation Badge at North Edge
    entities.push({
      id: 'disaster-perimeter-badge',
      name: `Disaster Boundary Tag: ${scenarioName}`,
      position: Cesium.Cartesian3.fromDegrees(northLon, maxLat),
      label: {
        text: `🚨 DISASTER AREA PERIMETER\n${scenarioName}`,
        font: 'bold 12px Inter, -apple-system, sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.fromCssColorString('#7f1d1d'),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(185, 28, 28, 0.92)'),
        showBackground: true,
        backgroundPadding: new Cesium.Cartesian2(10, 6),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -15),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      properties: {
        _drasType: 'disaster_boundary'
      }
    });
  } catch (e) {
    console.warn('Failed to parse disaster perimeter boundary', e);
  }

  return entities;
}

/**
 * Converts Hazard Zones (e.g. 20.4 ha Dharali debris fan, Chamoli surge) to 3D entities.
 */
export function convertHazardsTo3DEntities(hazardFeatures = [], scenarioId = 1) {
  const entities = [];

  for (let i = 0; i < hazardFeatures.length; i++) {
    const feat = hazardFeatures[i];
    if (!feat || !feat.geometry) continue;

    const p = feat.properties || {};
    const isDharali = scenarioId === 4;

    const ring = getLinearRingCoordinates(feat.geometry);
    if (!ring || ring.length < 3) continue;

    const flatCoords = [];
    for (const pt of ring) {
      flatCoords.push(pt[0], pt[1]);
    }
    const closedHazard = [...flatCoords, flatCoords[0], flatCoords[1]];

    try {
      const positions = Cesium.Cartesian3.fromDegreesArray(flatCoords);
      const color = isDharali ? Cesium.Color.fromCssColorString('#ef4444').withAlpha(0.32) : Cesium.Color.fromCssColorString('#f59e0b').withAlpha(0.26);
      const outlineColor = isDharali ? Cesium.Color.fromCssColorString('#dc2626') : Cesium.Color.fromCssColorString('#d97706');

      // 1. Clamped Hazard Polygon
      entities.push({
        id: `hazard-${p.id || i}`,
        name: isDharali ? 'Dharali 2025 Debris / Impact Extent (20.4 ha)' : (p.name || 'Hazard Extent'),
        polygon: {
          hierarchy: positions,
          material: new Cesium.ColorMaterialProperty(color),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        },
        properties: {
          ...p,
          _drasType: 'hazard'
        }
      });

      // 2. Clamped Dashed Border for Hazard
      entities.push({
        id: `hazard-border-${p.id || i}`,
        name: `Hazard Border: ${p.name || 'Hazard Extent'}`,
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(closedHazard),
          width: 3.5,
          material: new Cesium.PolylineDashMaterialProperty({
            color: outlineColor,
            gapColor: Cesium.Color.fromCssColorString('#000000').withAlpha(0.2),
            dashLength: 16.0
          }),
          clampToGround: true
        },
        properties: {
          ...p,
          _drasType: 'hazard'
        }
      });
    } catch (e) {
      console.warn('Failed to parse hazard polygon', e);
    }
  }

  return entities;
}

/**
 * Converts Operational Zones (4-tier macro sectors: CRITICAL, HIGH, MEDIUM, LOW) to 3D Cesium entities.
 */
export function convertZonesTo3DEntities(zoneFeatures = [], options = {}) {
  const { selectedZone = null } = options;
  const entities = [];
  const isAnySelected = selectedZone !== null;

  for (let i = 0; i < zoneFeatures.length; i++) {
    const feat = zoneFeatures[i];
    if (!feat || !feat.geometry) continue;

    const p = feat.properties || {};
    const zid = p.id || p.zoneCode || i;
    const crit = (p.criticality || 'LOW').toUpperCase();
    const isSelected = selectedZone?.id === p.id;
    const hex = p.color || PRIORITY_COLORS[crit] || '#10b981';

    let alpha = 0.25;
    if (isAnySelected) {
      alpha = isSelected ? 0.44 : 0.08;
    }
    const color = Cesium.Color.fromCssColorString(hex).withAlpha(alpha);
    const outlineCol = Cesium.Color.fromCssColorString(hex);

    const ring = getLinearRingCoordinates(feat.geometry);
    if (!ring || ring.length < 3) continue;

    const flatCoords = [];
    let sumLon = 0, sumLat = 0;
    for (const pt of ring) {
      flatCoords.push(pt[0], pt[1]);
      sumLon += pt[0];
      sumLat += pt[1];
    }
    const centroidLon = sumLon / ring.length;
    const centroidLat = sumLat / ring.length;
    const closedCoords = [...flatCoords, flatCoords[0], flatCoords[1]];

    try {
      const positions = Cesium.Cartesian3.fromDegreesArray(flatCoords);

      // 1. Clamped Sector Fill Polygon with Ground Draping
      entities.push({
        id: `operational-zone-${zid}`,
        name: `Operational Sector: ${p.name || p.zoneCode}`,
        polygon: {
          hierarchy: positions,
          material: new Cesium.ColorMaterialProperty(color),
          classificationType: Cesium.ClassificationType.BOTH
        },
        properties: {
          ...p,
          _drasType: 'operational_zone',
          rawFeature: feat
        }
      });

      // 2. High-Contrast Border Polyline (Solid for selected/high/low, dashed for critical)
      const borderWidth = isSelected ? 6.5 : (crit === 'CRITICAL' ? 5.0 : 4.0);
      const borderMaterial = isSelected
        ? new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.35,
            color: Cesium.Color.WHITE
          })
        : (crit === 'CRITICAL'
            ? new Cesium.PolylineDashMaterialProperty({
                color: Cesium.Color.fromCssColorString('#ef4444'),
                gapColor: Cesium.Color.fromCssColorString('#ffffff').withAlpha(0.6),
                dashLength: 18.0
              })
            : new Cesium.ColorMaterialProperty(outlineCol));

      entities.push({
        id: `operational-zone-border-${zid}`,
        name: `Sector Border: ${p.name || p.zoneCode}`,
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(closedCoords),
          width: borderWidth,
          material: borderMaterial,
          clampToGround: true
        },
        properties: {
          ...p,
          _drasType: 'operational_zone',
          rawFeature: feat
        }
      });

      // 3. Floating 3D Sector Badge at Zone Centroid (staggered to guarantee zero collision)
      const critEmoji = crit === 'CRITICAL' ? '🚨' : crit === 'HIGH' ? '⚠️' : crit === 'MEDIUM' ? '🟡' : '🟢';
      const labelText = isSelected
        ? `${critEmoji} ${p.name || p.zoneCode}\n📊 TIER: ${crit} [${((p.criticalityScore || 0) * 100).toFixed(0)}%]\n🏢 ${p.totalBuildings || 0} Structures (${p.destroyedCount || 0} Destroyed)\n👥 ~${p.estimatedPopulation || 0} Residents`
        : `${critEmoji} ${p.name || p.zoneCode}\n[${crit} • ${p.totalBuildings || 0} Structures • ${p.destroyedCount || 0} Destroyed]`;

      let badgeLat = centroidLat;
      const lats = ring.map(pt => pt[1]);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const latSpan = maxLat - minLat;
      if (latSpan > 0.005) {
        const factor = crit === 'CRITICAL' ? 0.82 : (crit === 'HIGH' ? 0.62 : (crit === 'MEDIUM' ? 0.38 : 0.18));
        badgeLat = minLat + latSpan * factor;
      }

      entities.push({
        id: `zone-badge-${zid}`,
        name: `Sector Indicator: ${p.name}`,
        position: Cesium.Cartesian3.fromDegrees(centroidLon, badgeLat),
        label: {
          text: labelText,
          font: isSelected ? 'bold 12px Inter, -apple-system, sans-serif' : 'bold 11px Inter, -apple-system, sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.fromCssColorString('#020617'),
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          backgroundColor: Cesium.Color.fromCssColorString(hex).withAlpha(isSelected ? 0.95 : 0.88),
          showBackground: true,
          backgroundPadding: new Cesium.Cartesian2(10, 6),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -18),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        properties: {
          ...p,
          _drasType: 'zone_badge'
        }
      });
    } catch (e) {
      console.warn(`Failed to parse zone polygon #${zid}`, e);
    }
  }

  return entities;
}

/**
 * Converts Active Route GeoJSON into a glowing 3D clamped corridor.
 */
export function convertRouteTo3DEntities(activeRoute) {
  if (!activeRoute) return [];

  const coords = activeRoute.routeGeoJson?.geometry?.coordinates 
    || activeRoute.routeGeoJson?.coordinates 
    || activeRoute.geometry?.coordinates;
  if (!coords || coords.length < 2) return [];

  const entities = [];
  const flatCoords = [];
  for (const pt of coords) {
    flatCoords.push(pt[0], pt[1]);
  }

  const positions = Cesium.Cartesian3.fromDegreesArray(flatCoords);
  const isResponse = activeRoute.routeType === 'RESPONSE' || activeRoute.routePurpose === 'RESPONSE_ACCESS';

  // 1. Glowing 3D Clamped Polyline
  entities.push({
    id: 'dras-active-3d-route',
    name: isResponse ? 'Response Access Route Corridor' : 'Evacuation Route Corridor',
    polyline: {
      positions,
      width: 8.0,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.35,
        color: isResponse ? Cesium.Color.fromCssColorString('#f59e0b') : Cesium.Color.fromCssColorString('#0284c7')
      }),
      clampToGround: true
    },
    properties: {
      ...activeRoute,
      _drasType: 'route'
    }
  });

  // 2. Origin Marker Badge
  const startPt = coords[0];
  entities.push({
    id: 'dras-route-origin-badge',
    position: Cesium.Cartesian3.fromDegrees(startPt[0], startPt[1]),
    label: {
      text: isResponse ? '🏢 EOC STAGING BASE' : '📍 EVACUATION ORIGIN',
      font: 'bold 12px sans-serif',
      fillColor: Cesium.Color.WHITE,
      backgroundColor: isResponse ? Cesium.Color.fromCssColorString('rgba(180, 83, 9, 0.95)') : Cesium.Color.fromCssColorString('rgba(15, 23, 42, 0.95)'),
      showBackground: true,
      backgroundPadding: new Cesium.Cartesian2(8, 5),
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -28),
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    }
  });

  // 3. Destination Marker Badge
  const endPt = coords[coords.length - 1];
  entities.push({
    id: 'dras-route-dest-badge',
    position: Cesium.Cartesian3.fromDegrees(endPt[0], endPt[1]),
    label: {
      text: isResponse 
        ? `🎯 PRIORITY TARGET #${activeRoute.targetBuildingId || ''}` 
        : `🏥 ${activeRoute.destinationName || 'FACILITY'}`,
      font: 'bold 12px sans-serif',
      fillColor: Cesium.Color.WHITE,
      backgroundColor: isResponse ? Cesium.Color.fromCssColorString('rgba(220, 38, 38, 0.95)') : Cesium.Color.fromCssColorString('rgba(2, 132, 199, 0.95)'),
      showBackground: true,
      backgroundPadding: new Cesium.Cartesian2(8, 5),
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -28),
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    }
  });

  return entities;
}
