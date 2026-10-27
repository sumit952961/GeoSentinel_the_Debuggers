"""
Precision patch for frontend/src/pages/DisasterMap.jsx
"""
import os

target_file = "frontend/src/pages/DisasterMap.jsx"

with open(target_file, "r", encoding="utf-8") as f:
    text = f.read()

# Normalize newlines
text = text.replace("\r\n", "\n")

# 1. Add isLegendCollapsed state
state_target = "const [activeRoute, setActiveRoute] = useState(null);"
state_replacement = "const [activeRoute, setActiveRoute] = useState(null);\n  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);"
assert state_target in text, "state_target not found"
text = text.replace(state_target, state_replacement, 1)
print("1. Added isLegendCollapsed state.")

# 2. Hazard tooltip sticky: false and no emoji
old_hazard_tooltip = """          layer.bindTooltip(`
            <div style="font-family: -apple-system, sans-serif; font-size: 11px; padding: 2px;">
              <strong style="color: #b91c1c; font-weight: 800;">⚠️ ${title}</strong><br/>
              <span style="font-size: 10px; color: #475569;">${p.source || 'Satellite Sensor Analysis'}</span>
            </div>
          `, { sticky: true });"""

new_hazard_tooltip = """          layer.bindTooltip(`
            <div style="font-family: Inter, sans-serif; font-size: 11px; padding: 2px;">
              <strong style="color: #b91c1c; font-weight: 800;">[HAZARD] ${title}</strong><br/>
              <span style="font-size: 10px; color: #475569;">${p.source || 'Satellite Sensor Analysis'}</span>
            </div>
          `, { sticky: false, direction: 'center', opacity: 0.9 });"""

assert old_hazard_tooltip in text, "old_hazard_tooltip not found"
text = text.replace(old_hazard_tooltip, new_hazard_tooltip, 1)
print("2. Updated hazard tooltip.")

# 3. Operational zones onEachFeature (no apex hijacking, centroid badge, non-sticky tooltip)
old_zone_feature = """          layer.on({
            mouseover: (e) => e.target.setStyle({ weight: 4, fillOpacity: 0.40 }),
            mouseout: (e) => {
              if (selectedZone?.id !== p.id) {
                zoneLayer.resetStyle(e.target);
              }
            },
            click: () => {
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
            }
          });

          layer.bindTooltip(`
            <div style="font-family: -apple-system, sans-serif; font-size: 11px;">
              <strong style="color: ${col}; font-weight: 800;">[${crit}] ${p.zoneCode || ''}</strong><br/>
              <strong>${p.name}</strong><br/>
              Buildings: <strong>${p.totalBuildings}</strong> (Destroyed: <strong>${p.destroyedCount}</strong>)<br/>
              Criticality Index: <strong>${((p.criticalityScore || 0) * 100).toFixed(0)}%</strong>
            </div>
          `, { sticky: true });"""

new_zone_feature = """          layer.on({
            mouseover: (e) => e.target.setStyle({ weight: 4, fillOpacity: 0.40 }),
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

          // Visible centroid badge marker on map
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

assert old_zone_feature in text, "old_zone_feature not found"
text = text.replace(old_zone_feature, new_zone_feature, 1)
print("3. Updated zone onEachFeature and centroid marker.")

# 4. Collapsible Legend
old_legend = """        {/* Dynamic Floating Mode & Legend Badge */}
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
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{ fontWeight: 800, marginBottom: '6px', color: tokens.textPrimary, borderBottom: `1px solid ${tokens.border}`, paddingBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            {mapMode === 'DAMAGE' ? 'DAMAGE ASSESSMENT' : (mapMode === 'PRIORITY' ? 'TRIAGE PRIORITY' : 'RESPONSE & ROUTING')}
          </div>

          {/* Scenario-Specific Semantic Legend */}
          {selectedScenarioId === 2 && (
            <div style={{ marginBottom: '6px', padding: '4px 6px', backgroundColor: isDark ? '#162033' : '#f1f5f9', borderRadius: '4px', fontSize: '9px', color: tokens.textSecondary }}>
              <strong>CHAMOLI 2021 PROTOCOL:</strong> Native binary grading (Intact vs Damaged/Obstructed) from EIDC field survey.
            </div>
          )}

          {selectedScenarioId === 3 && (
            <div style={{ marginBottom: '6px', padding: '4px 6px', backgroundColor: isDark ? '#162033' : '#f1f5f9', borderRadius: '4px', fontSize: '9px', color: tokens.textSecondary }}>
              <strong>CYCLONE FANI PROTOCOL:</strong> Point-based damage grading (EMSR357 / OSDMA). Not cadastral building polygons.
            </div>
          )}

          {selectedScenarioId === 4 && (
            <div style={{ marginBottom: '6px', padding: '4px 6px', backgroundColor: isDark ? '#2a1a1a' : '#fff1f2', borderRadius: '4px', fontSize: '9px', color: '#b91c1c' }}>
              <strong>DHARALI 2025 PROTOCOL:</strong> Qualitative Zero-Shot. Debris extent polygon (20.4 ha) with inferred footprints.
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
                    <span>Destroyed (Grade 4)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <span style={{ width: '8px', height: '8px', backgroundColor: DAMAGE_COLORS['major-damage'], borderRadius: '50%', border: '1px solid #000' }}></span>
                    <span>Major Damage (Grade 3)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <span style={{ width: '8px', height: '8px', backgroundColor: DAMAGE_COLORS['minor-damage'], borderRadius: '50%', border: '1px solid #000' }}></span>
                    <span>Minor Damage (Grade 2)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <span style={{ width: '8px', height: '8px', backgroundColor: DAMAGE_COLORS['no-damage'], borderRadius: '50%', border: '1px solid #000' }}></span>
                    <span>Negligible / Intact (Grade 1)</span>
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

          <div style={{ borderTop: `1px solid ${tokens.border}`, paddingTop: '4px', color: tokens.textSecondary, fontSize: '9px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div>⚠️ <strong style={{ color: '#dc2626' }}>Red Dashed:</strong> Hazard / Debris Extent</div>
            <div>⛔ <strong style={{ color: '#7c3aed' }}>Violet Dashed:</strong> Blocked road corridor</div>
            <div>🟠 <strong style={{ color: '#d97706' }}>Amber Glow:</strong> Response Access Route</div>
            <div>🔵 <strong style={{ color: '#0284c7' }}>Cyan Glow:</strong> Evacuation Route</div>
          </div>
        </div>"""

new_legend = """        {/* Collapsible Floating Mode & Legend Badge */}
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
        )}"""

assert old_legend in text, "old_legend not found"
text = text.replace(old_legend, new_legend, 1)
print("4. Rebuilt collapsible legend.")

# 5. Selected building header
old_sb_hdr = """                <span style={{ fontSize: '10px', fontWeight: 700, color: tokens.textSecondary, textTransform: 'uppercase' }}>
                  {selectedScenarioId === 3 ? 'POINT OBSERVATION' : 'SELECTED STRUCTURE'}
                </span>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: tokens.textPrimary, margin: 0 }}>
                  Structure #{selectedBuilding.id || selectedBuilding.buildingId}
                </h3>"""

new_sb_hdr = """                <span style={{ fontSize: '10px', fontWeight: 700, color: tokens.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {selectedScenarioId === 3 || selectedBuilding.geometry?.type === 'Point' 
                    ? 'COPERNICUS EMSR357 POINT OBSERVATION' 
                    : (selectedScenarioId === 4 ? 'QUALITATIVE ZERO-SHOT REFERENCE' : 'SELECTED STRUCTURE FOOTPRINT')}
                </span>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: tokens.textPrimary, margin: 0 }}>
                  {selectedScenarioId === 3 || selectedBuilding.geometry?.type === 'Point'
                    ? `Observation Point #${selectedBuilding.id || selectedBuilding.buildingId}`
                    : `Structure #${selectedBuilding.id || selectedBuilding.buildingId}`}
                </h3>"""

assert old_sb_hdr in text, "old_sb_hdr not found"
text = text.replace(old_sb_hdr, new_sb_hdr, 1)
print("5. Updated selected building header.")

# 6. Insert AI Satellite Evidence block right after EVIDENCE badge
evidence_badge_end = """              }}>
                EVIDENCE: {selectedScenarioId === 2 ? 'VERIFIED GROUND TRUTH (EIDC)' : (selectedScenarioId === 3 ? 'POINT OBSERVATION (EMSR357)' : (selectedScenarioId === 4 ? 'QUALITATIVE / ZERO-SHOT OVERLAY' : 'SUPERVISED BENCHMARK (xBD)'))}
              </span>
            </div>"""

sat_evidence_block = """              }}>
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
            </div>"""

assert evidence_badge_end in text, "evidence_badge_end not found"
text = text.replace(evidence_badge_end, sat_evidence_block, 1)
print("6. Added Satellite Evidence block.")

# 7. Update exposure & access status
old_exposure = """              {/* Exposure and Access Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', borderTop: `1px solid ${tokens.border}`, paddingTop: '5px', fontSize: '9px' }}>
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

new_exposure = """              {/* Exposure and Access Status */}
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
              </div>"""

assert old_exposure in text, "old_exposure not found"
text = text.replace(old_exposure, new_exposure, 1)
print("7. Updated Exposure & Road Accessibility.")

# Save with Windows newlines
with open(target_file, "w", encoding="utf-8", newline="\r\n") as f:
    f.write(text)

print("\n[SUCCESS] DisasterMap.jsx successfully patched!")
