package com.disastermgmt.entity;

import jakarta.persistence.*;
import org.locationtech.jts.geom.Geometry;
import java.time.LocalDateTime;

@Entity
@Table(name = "operational_zones")
public class OperationalZone {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "scenario_id", nullable = false)
    private Long scenarioId;

    @Column(name = "zone_code", nullable = false)
    private String zoneCode;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String criticality;

    @Column(name = "criticality_score")
    private Double criticalityScore;

    @Column(name = "total_buildings")
    private Integer totalBuildings;

    @Column(name = "destroyed_count")
    private Integer destroyedCount;

    @Column(name = "major_damage_count")
    private Integer majorDamageCount;

    @Column(name = "minor_damage_count")
    private Integer minorDamageCount;

    @Column(name = "no_damage_count")
    private Integer noDamageCount;

    @Column(name = "estimated_population")
    private Integer estimatedPopulation;

    @Column(name = "avg_priority_score")
    private Double avgPriorityScore;

    @Column(name = "hospitals_count")
    private Integer hospitalsCount;

    @Column(name = "shelters_count")
    private Integer sheltersCount;

    @Column(name = "blocked_roads_count")
    private Integer blockedRoadsCount;

    @Column(name = "highest_priority_building_id")
    private Integer highestPriorityBuildingId;

    @Column(name = "recommended_action", columnDefinition = "TEXT")
    private String recommendedAction;

    @Column(columnDefinition = "TEXT")
    private String explanation;

    @Column(name = "constituent_building_ids", columnDefinition = "TEXT")
    private String constituentBuildingIds;

    @Column(columnDefinition = "geometry(Geometry, 4326)", nullable = false)
    private Geometry geometry;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public OperationalZone() {}

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getScenarioId() { return scenarioId; }
    public void setScenarioId(Long scenarioId) { this.scenarioId = scenarioId; }

    public String getZoneCode() { return zoneCode; }
    public void setZoneCode(String zoneCode) { this.zoneCode = zoneCode; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCriticality() { return criticality; }
    public void setCriticality(String criticality) { this.criticality = criticality; }

    public Double getCriticalityScore() { return criticalityScore; }
    public void setCriticalityScore(Double criticalityScore) { this.criticalityScore = criticalityScore; }

    public Integer getTotalBuildings() { return totalBuildings; }
    public void setTotalBuildings(Integer totalBuildings) { this.totalBuildings = totalBuildings; }

    public Integer getDestroyedCount() { return destroyedCount; }
    public void setDestroyedCount(Integer destroyedCount) { this.destroyedCount = destroyedCount; }

    public Integer getMajorDamageCount() { return majorDamageCount; }
    public void setMajorDamageCount(Integer majorDamageCount) { this.majorDamageCount = majorDamageCount; }

    public Integer getMinorDamageCount() { return minorDamageCount; }
    public void setMinorDamageCount(Integer minorDamageCount) { this.minorDamageCount = minorDamageCount; }

    public Integer getNoDamageCount() { return noDamageCount; }
    public void setNoDamageCount(Integer noDamageCount) { this.noDamageCount = noDamageCount; }

    public Integer getEstimatedPopulation() { return estimatedPopulation; }
    public void setEstimatedPopulation(Integer estimatedPopulation) { this.estimatedPopulation = estimatedPopulation; }

    public Double getAvgPriorityScore() { return avgPriorityScore; }
    public void setAvgPriorityScore(Double avgPriorityScore) { this.avgPriorityScore = avgPriorityScore; }

    public Integer getHospitalsCount() { return hospitalsCount; }
    public void setHospitalsCount(Integer hospitalsCount) { this.hospitalsCount = hospitalsCount; }

    public Integer getSheltersCount() { return sheltersCount; }
    public void setSheltersCount(Integer sheltersCount) { this.sheltersCount = sheltersCount; }

    public Integer getBlockedRoadsCount() { return blockedRoadsCount; }
    public void setBlockedRoadsCount(Integer blockedRoadsCount) { this.blockedRoadsCount = blockedRoadsCount; }

    public Integer getHighestPriorityBuildingId() { return highestPriorityBuildingId; }
    public void setHighestPriorityBuildingId(Integer highestPriorityBuildingId) { this.highestPriorityBuildingId = highestPriorityBuildingId; }

    public String getRecommendedAction() { return recommendedAction; }
    public void setRecommendedAction(String recommendedAction) { this.recommendedAction = recommendedAction; }

    public String getExplanation() { return explanation; }
    public void setExplanation(String explanation) { this.explanation = explanation; }

    public String getConstituentBuildingIds() { return constituentBuildingIds; }
    public void setConstituentBuildingIds(String constituentBuildingIds) { this.constituentBuildingIds = constituentBuildingIds; }

    public Geometry getGeometry() { return geometry; }
    public void setGeometry(Geometry geometry) { this.geometry = geometry; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
