package com.disastermgmt.entity;

import jakarta.persistence.*;
import org.locationtech.jts.geom.Geometry;

import java.time.LocalDateTime;

@Entity
@Table(name = "damage_predictions")
public class DamagePrediction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "scenario_id")
    private Long scenarioId;

    @Column(name = "building_id")
    private Long buildingId;

    @Column(name = "job_id")
    private Long jobId;

    @Column(name = "damage_class", nullable = false)
    private String damageClass;

    private Double confidence;

    @Column(name = "prob_no_damage")
    private Double probNoDamage;

    @Column(name = "prob_minor")
    private Double probMinor;

    @Column(name = "prob_major")
    private Double probMajor;

    @Column(name = "prob_destroyed")
    private Double probDestroyed;

    @Column(columnDefinition = "TEXT")
    private String probabilities;

    @Column(name = "is_prediction")
    private Boolean isPrediction = true;

    @Column(columnDefinition = "geometry(Geometry, 4326)", nullable = false)
    private Geometry geometry;

    @Column(name = "tile_x")
    private Integer tileX;

    @Column(name = "tile_y")
    private Integer tileY;

    @Column(name = "model_version")
    private String modelVersion;

    @Column(name = "source")
    private String source;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "label_source")
    private String labelSource;

    @Column(name = "label_confidence")
    private Double labelConfidence;

    public DamagePrediction() {}

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

    public Long getJobId() { return jobId; }
    public void setJobId(Long jobId) { this.jobId = jobId; }

    public String getDamageClass() { return damageClass; }
    public void setDamageClass(String damageClass) { this.damageClass = damageClass; }

    public Double getConfidence() { return confidence; }
    public void setConfidence(Double confidence) { this.confidence = confidence; }

    public Double getProbNoDamage() { return probNoDamage; }
    public void setProbNoDamage(Double probNoDamage) { this.probNoDamage = probNoDamage; }

    public Double getProbMinor() { return probMinor; }
    public void setProbMinor(Double probMinor) { this.probMinor = probMinor; }

    public Double getProbMajor() { return probMajor; }
    public void setProbMajor(Double probMajor) { this.probMajor = probMajor; }

    public Double getProbDestroyed() { return probDestroyed; }
    public void setProbDestroyed(Double probDestroyed) { this.probDestroyed = probDestroyed; }

    public String getProbabilities() { return probabilities; }
    public void setProbabilities(String probabilities) { this.probabilities = probabilities; }

    public Boolean getIsPrediction() { return isPrediction; }
    public void setIsPrediction(Boolean isPrediction) { this.isPrediction = isPrediction; }

    public Geometry getGeometry() { return geometry; }
    public void setGeometry(Geometry geometry) { this.geometry = geometry; }

    public Integer getTileX() { return tileX; }
    public void setTileX(Integer tileX) { this.tileX = tileX; }

    public Integer getTileY() { return tileY; }
    public void setTileY(Integer tileY) { this.tileY = tileY; }

    public String getModelVersion() { return modelVersion; }
    public void setModelVersion(String modelVersion) { this.modelVersion = modelVersion; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public String getLabelSource() { return labelSource; }
    public void setLabelSource(String labelSource) { this.labelSource = labelSource; }

    public Double getLabelConfidence() { return labelConfidence; }
    public void setLabelConfidence(Double labelConfidence) { this.labelConfidence = labelConfidence; }
}
