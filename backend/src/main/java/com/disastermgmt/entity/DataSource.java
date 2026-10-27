package com.disastermgmt.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "data_sources")
public class DataSource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "scenario_id")
    private Long scenarioId;

    @Column(name = "source_name", nullable = false)
    private String sourceName;

    @Column(name = "source_url")
    private String sourceUrl;

    @Column(name = "acquisition_date")
    private LocalDate acquisitionDate;

    @Column(name = "spatial_resolution")
    private String spatialResolution;

    private String crs;
    private String license;

    @Column(name = "data_type")
    private String dataType;

    private Double confidence;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public DataSource() {}

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getScenarioId() { return scenarioId; }
    public void setScenarioId(Long scenarioId) { this.scenarioId = scenarioId; }

    public String getSourceName() { return sourceName; }
    public void setSourceName(String sourceName) { this.sourceName = sourceName; }

    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }

    public LocalDate getAcquisitionDate() { return acquisitionDate; }
    public void setAcquisitionDate(LocalDate acquisitionDate) { this.acquisitionDate = acquisitionDate; }

    public String getSpatialResolution() { return spatialResolution; }
    public void setSpatialResolution(String spatialResolution) { this.spatialResolution = spatialResolution; }

    public String getCrs() { return crs; }
    public void setCrs(String crs) { this.crs = crs; }

    public String getLicense() { return license; }
    public void setLicense(String license) { this.license = license; }

    public String getDataType() { return dataType; }
    public void setDataType(String dataType) { this.dataType = dataType; }

    public Double getConfidence() { return confidence; }
    public void setConfidence(Double confidence) { this.confidence = confidence; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
