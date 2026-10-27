package com.disastermgmt.entity;

import jakarta.persistence.*;
import org.locationtech.jts.geom.Point;
import java.time.LocalDateTime;

@Entity
@Table(name = "cad_incidents")
public class CadIncident {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(name = "scenario_id")
    private Long scenarioId;

    @Column(name = "zone_id")
    private Long zoneId;

    @Column(nullable = false)
    private String title;

    @Column(name = "disaster_type", nullable = false)
    private String disasterType;

    @Column(nullable = false)
    private String priority = "P2_HIGH"; // P1_CRITICAL, P2_HIGH, P3_MEDIUM, P4_LOW

    @Column(nullable = false)
    private String status = "REPORTED"; // REPORTED, DISPATCHED, ON_SCENE, RESOLVED, CANCELLED

    @Column(columnDefinition = "geometry(Point, 4326)")
    private Point location;

    @Column(name = "address_text")
    private String addressText;

    @Column(name = "reported_by")
    private String reportedBy;

    @Column(name = "caller_phone")
    private String callerPhone;

    @Column(name = "victim_count")
    private Integer victimCount = 0;

    @Column(name = "trapped_count")
    private Integer trappedCount = 0;

    @Column(name = "hazards_present", columnDefinition = "TEXT")
    private String hazardsPresent;

    @Column(name = "assigned_unit_id")
    private Long assignedUnitId;

    @Column(name = "dispatched_at")
    private LocalDateTime dispatchedAt;

    @Column(name = "arrived_at")
    private LocalDateTime arrivedAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public CadIncident() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public Long getScenarioId() { return scenarioId; }
    public void setScenarioId(Long scenarioId) { this.scenarioId = scenarioId; }

    public Long getZoneId() { return zoneId; }
    public void setZoneId(Long zoneId) { this.zoneId = zoneId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDisasterType() { return disasterType; }
    public void setDisasterType(String disasterType) { this.disasterType = disasterType; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Point getLocation() { return location; }
    public void setLocation(Point location) { this.location = location; }

    public String getAddressText() { return addressText; }
    public void setAddressText(String addressText) { this.addressText = addressText; }

    public String getReportedBy() { return reportedBy; }
    public void setReportedBy(String reportedBy) { this.reportedBy = reportedBy; }

    public String getCallerPhone() { return callerPhone; }
    public void setCallerPhone(String callerPhone) { this.callerPhone = callerPhone; }

    public Integer getVictimCount() { return victimCount; }
    public void setVictimCount(Integer victimCount) { this.victimCount = victimCount; }

    public Integer getTrappedCount() { return trappedCount; }
    public void setTrappedCount(Integer trappedCount) { this.trappedCount = trappedCount; }

    public String getHazardsPresent() { return hazardsPresent; }
    public void setHazardsPresent(String hazardsPresent) { this.hazardsPresent = hazardsPresent; }

    public Long getAssignedUnitId() { return assignedUnitId; }
    public void setAssignedUnitId(Long assignedUnitId) { this.assignedUnitId = assignedUnitId; }

    public LocalDateTime getDispatchedAt() { return dispatchedAt; }
    public void setDispatchedAt(LocalDateTime dispatchedAt) { this.dispatchedAt = dispatchedAt; }

    public LocalDateTime getArrivedAt() { return arrivedAt; }
    public void setArrivedAt(LocalDateTime arrivedAt) { this.arrivedAt = arrivedAt; }

    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
