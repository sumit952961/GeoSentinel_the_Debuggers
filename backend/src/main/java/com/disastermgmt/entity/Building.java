package com.disastermgmt.entity;

import jakarta.persistence.*;
import org.locationtech.jts.geom.Polygon;

import java.time.LocalDateTime;

@Entity
@Table(name = "buildings")
public class Building {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "scenario_id")
    private Long scenarioId;

    @Column(name = "osm_id")
    private Long osmId;

    @Column(columnDefinition = "geometry(Polygon, 4326)", nullable = false)
    private Polygon geometry;

    @Column(name = "building_type")
    private String buildingType;

    @Column(name = "damage_class")
    private String damageClass;

    private String source;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public Building() {}

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getScenarioId() { return scenarioId; }
    public void setScenarioId(Long scenarioId) { this.scenarioId = scenarioId; }

    public Long getOsmId() { return osmId; }
    public void setOsmId(Long osmId) { this.osmId = osmId; }

    public Polygon getGeometry() { return geometry; }
    public void setGeometry(Polygon geometry) { this.geometry = geometry; }

    public String getBuildingType() { return buildingType; }
    public void setBuildingType(String buildingType) { this.buildingType = buildingType; }

    public String getDamageClass() { return damageClass; }
    public void setDamageClass(String damageClass) { this.damageClass = damageClass; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
