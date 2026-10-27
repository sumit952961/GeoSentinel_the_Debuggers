package com.disastermgmt.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "model_versions")
public class ModelVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String version;

    private String architecture;

    @Column(name = "training_dataset")
    private String trainingDataset;

    @Column(name = "training_events")
    private String trainingEvents;

    @Column(name = "test_events")
    private String testEvents;

    @Column(columnDefinition = "JSONB")
    private String metrics;

    @Column(name = "checkpoint_path")
    private String checkpointPath;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public ModelVersion() {}

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public String getArchitecture() { return architecture; }
    public void setArchitecture(String architecture) { this.architecture = architecture; }

    public String getTrainingDataset() { return trainingDataset; }
    public void setTrainingDataset(String trainingDataset) { this.trainingDataset = trainingDataset; }

    public String getTrainingEvents() { return trainingEvents; }
    public void setTrainingEvents(String trainingEvents) { this.trainingEvents = trainingEvents; }

    public String getTestEvents() { return testEvents; }
    public void setTestEvents(String testEvents) { this.testEvents = testEvents; }

    public String getMetrics() { return metrics; }
    public void setMetrics(String metrics) { this.metrics = metrics; }

    public String getCheckpointPath() { return checkpointPath; }
    public void setCheckpointPath(String checkpointPath) { this.checkpointPath = checkpointPath; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
