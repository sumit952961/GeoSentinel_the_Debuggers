package com.disastermgmt.entity;

import jakarta.persistence.*;
import org.locationtech.jts.geom.Point;
import java.time.LocalDateTime;

@Entity
@Table(name = "response_units")
public class ResponseUnit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String callsign;

    @Column(name = "unit_type", nullable = false)
    private String unitType; // URBAN_SEARCH_RESCUE, AMBULANCE, FIRE_HAZMAT, TACTICAL_PATROL, UAV_RECON

    @Column(nullable = false)
    private String status = "AVAILABLE"; // AVAILABLE, DISPATCHED, ON_SCENE, EN_ROUTE_HOSPITAL, OUT_OF_SERVICE

    @Column(name = "personnel_count", nullable = false)
    private Integer personnelCount = 4;

    @Column(name = "equipment_manifest", columnDefinition = "TEXT")
    private String equipmentManifest;

    @Column(name = "current_location", columnDefinition = "geometry(Point, 4326)")
    private Point currentLocation;

    @Column
    private Double heading = 0.0;

    @Column(name = "speed_kmh")
    private Double speedKmh = 0.0;

    @Column(name = "active_incident_id")
    private Long activeIncidentId;

    @Column(name = "last_ping")
    private LocalDateTime lastPing = LocalDateTime.now();

    public ResponseUnit() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCallsign() { return callsign; }
    public void setCallsign(String callsign) { this.callsign = callsign; }

    public String getUnitType() { return unitType; }
    public void setUnitType(String unitType) { this.unitType = unitType; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Integer getPersonnelCount() { return personnelCount; }
    public void setPersonnelCount(Integer personnelCount) { this.personnelCount = personnelCount; }

    public String getEquipmentManifest() { return equipmentManifest; }
    public void setEquipmentManifest(String equipmentManifest) { this.equipmentManifest = equipmentManifest; }

    public Point getCurrentLocation() { return currentLocation; }
    public void setCurrentLocation(Point currentLocation) { this.currentLocation = currentLocation; }

    public Double getHeading() { return heading; }
    public void setHeading(Double heading) { this.heading = heading; }

    public Double getSpeedKmh() { return speedKmh; }
    public void setSpeedKmh(Double speedKmh) { this.speedKmh = speedKmh; }

    public Long getActiveIncidentId() { return activeIncidentId; }
    public void setActiveIncidentId(Long activeIncidentId) { this.activeIncidentId = activeIncidentId; }

    public LocalDateTime getLastPing() { return lastPing; }
    public void setLastPing(LocalDateTime lastPing) { this.lastPing = lastPing; }
}
