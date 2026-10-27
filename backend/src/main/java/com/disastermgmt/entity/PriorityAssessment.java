package com.disastermgmt.entity;

import jakarta.persistence.*;
import org.locationtech.jts.geom.Geometry;

import java.time.LocalDateTime;

@Entity
@Table(name = "priority_assessments")
public class PriorityAssessment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "scenario_id")
    private Long scenarioId;

    @Column(name = "building_id")
    private Long buildingId;

    @Column(name = "damage_prediction_id")
    private Long damagePredictionId;

    @Column(name = "priority_score", nullable = false)
    private Double priorityScore;

    @Column(name = "priority_level", nullable = false)
    private String priorityLevel;

    @Column(name = "severity_score", nullable = false)
    private Double severityScore;

    @Column(name = "population_score", nullable = false)
    private Double populationScore;

    @Column(name = "infrastructure_score", nullable = false)
    private Double infrastructureScore;

    @Column(name = "accessibility_score", nullable = false)
    private Double accessibilityScore;

    @Column(name = "weight_severity")
    private Double weightSeverity;

    @Column(name = "weight_population")
    private Double weightPopulation;

    @Column(name = "weight_infrastructure")
    private Double weightInfrastructure;

    @Column(name = "weight_accessibility")
    private Double weightAccessibility;

    @Column(name = "hazard_proximity_score")
    private Double hazardProximityScore;

    @Column(name = "weight_hazard_proximity")
    private Double weightHazardProximity;

    @Column(columnDefinition = "TEXT")
    private String explanation;

    @Column(columnDefinition = "geometry(Geometry, 4326)", nullable = false)
    private Geometry geometry;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public PriorityAssessment() {}

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getScenarioId() { return scenarioId; }
    public void setScenarioId(Long scenarioId) { this.scenarioId = scenarioId; }

    public Long getBuildingId() { return buildingId; }
    public void setBuildingId(Long buildingId) { this.buildingId = buildingId; }

    public Long getDamagePredictionId() { return damagePredictionId; }
    public void setDamagePredictionId(Long damagePredictionId) { this.damagePredictionId = damagePredictionId; }

    public Double getPriorityScore() { return priorityScore; }
    public void setPriorityScore(Double priorityScore) { this.priorityScore = priorityScore; }

    public String getPriorityLevel() { return priorityLevel; }
    public void setPriorityLevel(String priorityLevel) { this.priorityLevel = priorityLevel; }

    public Double getSeverityScore() { return severityScore; }
    public void setSeverityScore(Double severityScore) { this.severityScore = severityScore; }

    public Double getPopulationScore() { return populationScore; }
    public void setPopulationScore(Double populationScore) { this.populationScore = populationScore; }

    public Double getInfrastructureScore() { return infrastructureScore; }
    public void setInfrastructureScore(Double infrastructureScore) { this.infrastructureScore = infrastructureScore; }

    public Double getAccessibilityScore() { return accessibilityScore; }
    public void setAccessibilityScore(Double accessibilityScore) { this.accessibilityScore = accessibilityScore; }

    public Double getWeightSeverity() { return weightSeverity; }
    public void setWeightSeverity(Double weightSeverity) { this.weightSeverity = weightSeverity; }

    public Double getWeightPopulation() { return weightPopulation; }
    public void setWeightPopulation(Double weightPopulation) { this.weightPopulation = weightPopulation; }

    public Double getWeightInfrastructure() { return weightInfrastructure; }
    public void setWeightInfrastructure(Double weightInfrastructure) { this.weightInfrastructure = weightInfrastructure; }

    public Double getWeightAccessibility() { return weightAccessibility; }
    public void setWeightAccessibility(Double weightAccessibility) { this.weightAccessibility = weightAccessibility; }

    public Double getHazardProximityScore() { return hazardProximityScore; }
    public void setHazardProximityScore(Double hazardProximityScore) { this.hazardProximityScore = hazardProximityScore; }

    public Double getWeightHazardProximity() { return weightHazardProximity; }
    public void setWeightHazardProximity(Double weightHazardProximity) { this.weightHazardProximity = weightHazardProximity; }

    public String getExplanation() { return explanation; }
    public void setExplanation(String explanation) { this.explanation = explanation; }

    public Geometry getGeometry() { return geometry; }
    public void setGeometry(Geometry geometry) { this.geometry = geometry; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
