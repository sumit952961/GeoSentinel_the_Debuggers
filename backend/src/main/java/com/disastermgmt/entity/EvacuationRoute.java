package com.disastermgmt.entity;

import jakarta.persistence.*;
import org.locationtech.jts.geom.LineString;

import java.time.LocalDateTime;

@Entity
@Table(name = "evacuation_routes")
public class EvacuationRoute {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "scenario_id")
    private Long scenarioId;

    @Column(name = "priority_assessment_id")
    private Long priorityAssessmentId;

    @Column(name = "origin_lat")
    private Double originLat;

    @Column(name = "origin_lon")
    private Double originLon;

    @Column(name = "destination_id")
    private Long destinationId;

    @Column(name = "destination_name")
    private String destinationName;

    @Column(name = "destination_type")
    private String destinationType;

    @Column(name = "distance_km")
    private Double distanceKm;

    @Column(name = "estimated_minutes")
    private Double estimatedMinutes;

    @Column(name = "blocked_roads_avoided_count")
    private Integer blockedRoadsAvoidedCount;

    @Column(name = "route_type")
    private String routeType;

    @Column(columnDefinition = "geometry(LineString, 4326)", nullable = false)
    private LineString geometry;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public EvacuationRoute() {}

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getScenarioId() { return scenarioId; }
    public void setScenarioId(Long scenarioId) { this.scenarioId = scenarioId; }

    public Long getPriorityAssessmentId() { return priorityAssessmentId; }
    public void setPriorityAssessmentId(Long priorityAssessmentId) { this.priorityAssessmentId = priorityAssessmentId; }

    public Double getOriginLat() { return originLat; }
    public void setOriginLat(Double originLat) { this.originLat = originLat; }

    public Double getOriginLon() { return originLon; }
    public void setOriginLon(Double originLon) { this.originLon = originLon; }

    public Long getDestinationId() { return destinationId; }
    public void setDestinationId(Long destinationId) { this.destinationId = destinationId; }

    public String getDestinationName() { return destinationName; }
    public void setDestinationName(String destinationName) { this.destinationName = destinationName; }

    public String getDestinationType() { return destinationType; }
    public void setDestinationType(String destinationType) { this.destinationType = destinationType; }

    public Double getDistanceKm() { return distanceKm; }
    public void setDistanceKm(Double distanceKm) { this.distanceKm = distanceKm; }

    public Double getEstimatedMinutes() { return estimatedMinutes; }
    public void setEstimatedMinutes(Double estimatedMinutes) { this.estimatedMinutes = estimatedMinutes; }

    public Integer getBlockedRoadsAvoidedCount() { return blockedRoadsAvoidedCount; }
    public void setBlockedRoadsAvoidedCount(Integer blockedRoadsAvoidedCount) { this.blockedRoadsAvoidedCount = blockedRoadsAvoidedCount; }

    public String getRouteType() { return routeType; }
    public void setRouteType(String routeType) { this.routeType = routeType; }

    public LineString getGeometry() { return geometry; }
    public void setGeometry(LineString geometry) { this.geometry = geometry; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
