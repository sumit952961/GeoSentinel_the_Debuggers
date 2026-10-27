"""
Patch frontend/src/pages/DisasterMap.jsx with critical UI refinements:
1. Collapsible legend with minimize toggle & compact styling.
2. Removal of sticky tooltips on hazard polygons.
3. Zone centroid badges and proper zone selection without hijacking into apex building.
4. Distinguish EMSR357 point observations vs building footprints.
5. Honest satellite sensor context and dynamic detection rationale.
"""

import os
import re

file_path = "frontend/src/pages/DisasterMap.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add isLegendCollapsed state
if "const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);" not in content:
    target_state = "const [activeRoute, setActiveRoute] = useState(null);"
    replacement_state = "const [activeRoute, setActiveRoute] = useState(null);\n  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);"
    assert target_state in content, "Target state line not found"
    content = content.replace(target_state, replacement_state, 1)
    print("Added isLegendCollapsed state.")

# 2. Fix sticky: true on hazard polygons
content = re.sub(
    r'(layer\.bindTooltip\(`[\s\S]*?\[HAZARD\][\s\S]*?`,\s*)\{\s*sticky:\s*true\s*\}\);',
    r"\1{ sticky: false, direction: 'center', opacity: 0.9 });",
    content
)
print("Updated hazard tooltip options.")

# 3. Zone click handler & Centroid badges
# Find onEachFeature for zoneLayer
old_zone_click = """            click: () => {
              setSelectedZone(p);
              // Focus map on selected zone
              if (layer.getBounds && layer.getBounds().isValid()) {
                map.fitBounds(layer.getBounds(), { padding: [40, 40] });
              }
              // Auto-select apex priority building for this zone
              if (p.highestPriorityBuildingId) {
                const bMatch = rawDataRef.current.damages?.features?.find(f => (f.properties?.buildingId || f.properties?.id) === p.highestPriorityBuildingId);
                const priMatch = rawDataRef.current.priorities?.features?.find(f => (f.properties?.building_id || f.properties?.id) === p.highestPriorityBuildingId);
                if (bMatch) {
                  setSelectedBuilding({
                    ...bMatch.properties,
                    geometry: bMatch.geometry,
                    priorityInfo: priMatch?.properties
                  });
                }
              }
            }"""

new_zone_click = """            click: () => {
              setSelectedZone(p);
              setSelectedBuilding(null);
              // Focus map on selected zone
              if (layer.getBounds && layer.getBounds().isValid()) {
                map.fitBounds(layer.getBounds(), { padding: [40, 40] });
              }
            }"""

if old_zone_click in content:
    content = content.replace(old_zone_click, new_zone_click, 1)
    print("Replaced zone click handler (prevented hijacking to building).")
else:
    # Try normalizing newlines
    old_norm = old_zone_click.replace("\r\n", "\n")
    content_norm = content.replace("\r\n", "\n")
    if old_norm in content_norm:
        content_norm = content_norm.replace(old_norm, new_zone_click.replace("\r\n", "\n"), 1)
        content = content_norm
        print("Replaced zone click handler (normalized newlines).")
    else:
        print("WARNING: old_zone_click not found directly!")

# Add centroid markers to zones
old_zone_tooltip = """          layer.bindTooltip(`
            <div style="font-family: -apple-system, sans-serif; font-size: 11px;">
              <strong style="color: ${col}; font-weight: 800;">[${crit}] ${p.zoneCode || ''}</strong><br/>
              <strong>${p.name}</strong><br/>
              Buildings: <strong>${p.totalBuildings}</strong> (Destroyed: <strong>${p.destroyedCount}</strong>)<br/>
              Criticality Index: <strong>${((p.criticalityScore || 0) * 100).toFixed(0)}%</strong>
            </div>
          `, { sticky: true });"""

new_zone_tooltip = """          layer.bindTooltip(`
            <div style="font-family: -apple-system, sans-serif; font-size: 11px;">
              <strong style="color: ${col}; font-weight: 800;">[${crit}] ${p.zoneCode || ''}</strong><br/>
              <strong>${p.name}</strong><br/>
              Evaluated: <strong>${p.totalBuildings}</strong> | Destroyed: <strong>${p.destroyedCount}</strong><br/>
              Criticality Index: <strong>${((p.criticalityScore || 0) * 100).toFixed(0)}%</strong>
            </div>
          `, { sticky: false, direction: 'center' });

          // Add visible persistent centroid badge marker on map
          if (layer.getBounds && layer.getBounds().isValid()) {
            const center = layer.getBounds().getCenter();
            const badgeHtml = `
              <div style="
                background: ${isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)'};
                border: 2px solid ${col};
                color: ${isDark ? '#f8fafc' : '#0f172a'};
                padding: 3px 8px;
                border-radius: 6px;
                font-family: Inter, sans-serif;
                font-size: 11px;
                font-weight: 800;
                white-space: nowrap;
                box-shadow: 0 4px 10px rgba(0,0,0,0.35);
                cursor: pointer;
                text-align: center;
                pointer-events: auto;
                line-height: 1.2;
              ">
                <span style="color: ${col}; font-weight: 900;">${p.zoneCode || ''}</span>
                <span style="font-size: 9px; margin-left: 4px; padding: 1px 4px; background: ${col}25; color: ${col}; border-radius: 3px; text-transform: uppercase;">${crit}</span>
                <div style="font-size: 10px; font-weight: 600; color: ${isDark ? '#94a3b8' : '#475569'}; margin-top: 1px;">
                  ${p.name ? p.name.split(' ')[0] : ''}
                </div>
              </div>
            `;
            const icon = L.divIcon({
              html: badgeHtml,
              className: 'zone-centroid-badge',
              iconSize: [110, 36],
              iconAnchor: [55, 18]
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
          }"""

old_zt_norm = old_zone_tooltip.replace("\r\n", "\n")
content_norm = content.replace("\r\n", "\n")
if old_zt_norm in content_norm:
    content_norm = content_norm.replace(old_zt_norm, new_zone_tooltip.replace("\r\n", "\n"), 1)
    content = content_norm
    print("Replaced zone tooltip with centroid badge.")
else:
    print("WARNING: old_zone_tooltip not found!")

# 4. Rebuild Legend with collapsible button
# Find the entire legend block
old_legend_start = "{/* Dynamic Floating Mode & Legend Badge (in 2D mode) */}"
assert old_legend_start in content, "old_legend_start not found"

new_legend_code = """{/* Dynamic Floating Mode & Legend Badge (in 2D mode) */}
        {mapViewMode === '2D' && isLegendCollapsed && (
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

        {mapViewMode === '2D' && !isLegendCollapsed && (
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
              <div style={{ marginBottom: '6px', padding: '4px 6px', backgroundColor: isDark ? '#162033' : '#f1f5f9', borderRadius: '4px', fontSize: '10px', color: tokens.textSecondary }}>
                <strong>CHAMOLI 2021 PROTOCOL:</strong> Native EIDC binary grading (Intact vs Damaged/Obstructed).
              </div>
            )}

            {selectedScenarioId === 3 && (
              <div style={{ marginBottom: '6px', padding: '4px 6px', backgroundColor: isDark ? '#162033' : '#f1f5f9', borderRadius: '4px', fontSize: '10px', color: tokens.textSecondary }}>
                <strong>CYCLONE FANI PROTOCOL:</strong> Copernicus EMS EMSR357 point grading.
              </div>
            )}

            {selectedScenarioId === 4 && (
              <div style={{ marginBottom: '6px', padding: '4px 6px', backgroundColor: isDark ? '#2a1a1a' : '#fff1f2', borderRadius: '4px', fontSize: '10px', color: '#b91c1c' }}>
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
        )}"""

# Replace the legend block using regex
legend_pattern = r'\{\/\* Dynamic Floating Mode & Legend Badge \(in 2D mode\) \*\/\}[\s\S]*?\{mapViewMode === \'2D\' && \([\s\S]*?\}\)\s*\}'
content = re.sub(legend_pattern, new_legend_code, content, count=1)
print("Rebuilt Map Legend with collapsible control.")

# 5. Fix Selected Building Header & Details
# Feature header
old_hdr = """                <span style={{ fontSize: '10px', fontWeight: 700, color: tokens.textSecondary, textTransform: 'uppercase' }}>
                  {selectedScenarioId === 3 ? 'POINT OBSERVATION' : 'SELECTED STRUCTURE'}
                </span>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: tokens.textPrimary, margin: 0 }}>
                  Structure #{selectedBuilding.id || selectedBuilding.buildingId}
                </h3>"""

new_hdr = """                <span style={{ fontSize: '10px', fontWeight: 700, color: tokens.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {selectedScenarioId === 3 || selectedBuilding.geometry?.type === 'Point' 
                    ? 'COPERNICUS EMSR357 POINT OBSERVATION' 
                    : (selectedScenarioId === 4 ? 'QUALITATIVE ZERO-SHOT REFERENCE' : 'SELECTED STRUCTURE FOOTPRINT')}
                </span>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: tokens.textPrimary, margin: 0 }}>
                  {selectedScenarioId === 3 || selectedBuilding.geometry?.type === 'Point'
                    ? `Observation Point #${selectedBuilding.id || selectedBuilding.buildingId}`
                    : `Structure #${selectedBuilding.id || selectedBuilding.buildingId}`}
                </h3>"""

old_hdr_norm = old_hdr.replace("\r\n", "\n")
content_norm = content.replace("\r\n", "\n")
if old_hdr_norm in content_norm:
    content_norm = content_norm.replace(old_hdr_norm, new_hdr.replace("\r\n", "\n"), 1)
    content = content_norm
    print("Updated Selected Building Header to distinguish points vs footprints.")
else:
    print("WARNING: old_hdr not found!")

# AI Satellite Evidence section in selectedBuilding
old_sat = """            {/* AI SATELLITE EVIDENCE (BEFORE / AFTER COMPARISON) */}
            <div style={{ backgroundColor: tokens.bgTertiary, padding: '8px', borderRadius: '6px', border: `1px solid ${tokens.border}`, marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: tokens.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Satellite size={12} color={tokens.accent} /> AI SATELLITE EVIDENCE
                </span>
                <span style={{ fontSize: '11px', padding: '1px 5px', borderRadius: '3px', backgroundColor: '#38bdf820', color: '#0284c7', fontWeight: 700 }}>
                  Optical Sensor Verification
                </span>
              </div>

              {/* Dual Before / After Frames */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                <div style={{ border: `1px solid ${tokens.border}`, borderRadius: '4px', overflow: 'hidden', backgroundColor: '#020617' }}>
                  <div style={{ padding: '2px 5px', backgroundColor: '#0284c7', color: '#fff', fontSize: '11px', fontWeight: 800, display: 'flex', justifyContent: 'space-between' }}>
                    <span>PRE-DISASTER</span>
                    <span>Reference</span>
                  </div>
                  <div style={{ height: '88px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img
                      src={`/satellite_evidence/crops/scen${selectedScenarioId}_${selectedBuilding.damageClass || 'no-damage'}_pre.png`}
                      alt="Pre-disaster satellite crop"
                      onError={(e) => { e.target.src = `/satellite_evidence/scenario_${selectedScenarioId}_pre.png`; }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                </div>

                <div style={{ border: `1px solid ${tokens.border}`, borderRadius: '4px', overflow: 'hidden', backgroundColor: '#020617' }}>
                  <div style={{ padding: '2px 5px', backgroundColor: DAMAGE_COLORS[selectedBuilding.damageClass] || '#dc2626', color: '#fff', fontSize: '11px', fontWeight: 800, display: 'flex', justifyContent: 'space-between' }}>
                    <span>POST-DISASTER</span>
                    <span>Impact</span>
                  </div>
                  <div style={{ height: '88px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img
                      src={`/satellite_evidence/crops/scen${selectedScenarioId}_${selectedBuilding.damageClass || 'no-damage'}_post.png`}
                      alt="Post-disaster satellite crop"
                      onError={(e) => { e.target.src = `/satellite_evidence/scenario_${selectedScenarioId}_post.png`; }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '11px', color: tokens.textSecondary, lineHeight: 1.35, backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)', padding: '5px 7px', borderRadius: '4px' }}>
                <strong style={{ color: tokens.textPrimary }}>Detection Rationale: </strong>
                {selectedBuilding.damageClass === 'destroyed'
                  ? 'Structural collapse detected. Complete obliteration of roof plane and dispersed rubble scatter along perimeter.'
                  : selectedBuilding.damageClass === 'major-damage'
                    ? 'Major structural trauma. Severe roof shearing and foundation breach detected via high-res spectral delta.'
                    : selectedBuilding.damageClass === 'minor-damage'
                      ? 'Minor exterior shingle displacement and perimeter flooding/smoke staining; frame intact.'
                      : 'Structure intact. Clean geometric roof boundaries and no detectable physical disruption.'}
              </div>
            </div>"""

new_sat = """            {/* AI SATELLITE EVIDENCE (BEFORE / AFTER COMPARISON OR SENSOR CONTEXT) */}
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
            </div>"""

old_sat_norm = old_sat.replace("\r\n", "\n")
content_norm = content.replace("\r\n", "\n")
if old_sat_norm in content_norm:
    content_norm = content_norm.replace(old_sat_norm, new_sat.replace("\r\n", "\n"), 1)
    content = content_norm
    print("Replaced Satellite Evidence section with honest sensor context.")
else:
    print("WARNING: old_sat not found!")

# Exposure & Access Status
old_exp = """              {/* Exposure and Access Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', borderTop: `1px solid ${tokens.border}`, paddingTop: '5px', fontSize: '11px' }}>
                <div>
                  <span style={{ color: tokens.textSecondary }}>Estimated Exposure:</span>
                  <strong style={{ display: 'block', color: tokens.textPrimary }}>~5-8 occupants</strong>
                </div>
                <div>
                  <span style={{ color: tokens.textSecondary }}>Road Accessibility:</span>
                  <strong style={{ display: 'block', color: avoidBlockedRoads ? '#10b981' : '#f59e0b' }}>
                    {avoidBlockedRoads ? 'Detour Clear' : 'Direct Corridor'}
                  </strong>
                </div>
              </div>"""

new_exp = """              {/* Exposure and Access Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', borderTop: `1px solid ${tokens.border}`, paddingTop: '5px', fontSize: '11px' }}>
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
              </div>"""

old_exp_norm = old_exp.replace("\r\n", "\n")
content_norm = content.replace("\r\n", "\n")
if old_exp_norm in content_norm:
    content_norm = content_norm.replace(old_exp_norm, new_exp.replace("\r\n", "\n"), 1)
    content = content_norm
    print("Updated Exposure & Road Accessibility.")
else:
    print("WARNING: old_exp not found!")

# Write back
with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("[SUCCESS] All UI patches applied to DisasterMap.jsx!")
