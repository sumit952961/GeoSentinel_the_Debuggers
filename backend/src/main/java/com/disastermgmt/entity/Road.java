package com.disastermgmt.entity;

import jakarta.persistence.*;
import org.locationtech.jts.geom.LineString;

import java.time.LocalDateTime;

@Entity
@Table(name = "roads")
public class Road {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "scenario_id")
    private Long scenarioId;

    @Column(name = "osm_id")
    private Long osmId;

    private String name;

    @Column(name = "highway_type")
    private String highwayType;

    @Column(name = "is_blocked")
    private Boolean isBlocked = false;

    @Column(name = "block_reason")
    private String blockReason;

    @Column(name = "cost_multiplier")
    private Double costMultiplier = 1.0;

    @Column(columnDefinition = "geometry(LineString, 4326)", nullable = false)
    private LineString geometry;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "hazard_level")
    private String hazardLevel;

    @Column(name = "accessibility_cost")
    private Double accessibilityCost = 1.0;

    @Column(name = "road_type")
    private String roadType;

    public Road() {}

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.isBlocked == null) this.isBlocked = false;
        if (this.costMultiplier == null) this.costMultiplier = 1.0;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getScenarioId() { return scenarioId; }
    public void setScenarioId(Long scenarioId) { this.scenarioId = scenarioId; }

    public Long getOsmId() { return osmId; }
    public void setOsmId(Long osmId) { this.osmId = osmId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getHighwayType() { return highwayType; }
    public void setHighwayType(String highwayType) { this.highwayType = highwayType; }

    public Boolean getIsBlocked() { return isBlocked; }
    public void setIsBlocked(Boolean isBlocked) { this.isBlocked = isBlocked; }

    public String getBlockReason() { return blockReason; }
    public void setBlockReason(String blockReason) { this.blockReason = blockReason; }

    public Double getCostMultiplier() { return costMultiplier; }
    public void setCostMultiplier(Double costMultiplier) { this.costMultiplier = costMultiplier; }

    public LineString getGeometry() { return geometry; }
    public void setGeometry(LineString geometry) { this.geometry = geometry; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public String getHazardLevel() { return hazardLevel; }
    public void setHazardLevel(String hazardLevel) { this.hazardLevel = hazardLevel; }

    public Double getAccessibilityCost() { return accessibilityCost; }
    public void setAccessibilityCost(Double accessibilityCost) { this.accessibilityCost = accessibilityCost; }

    public String getRoadType() { return roadType; }
    public void setRoadType(String roadType) { this.roadType = roadType; }
}
