package com.disastermgmt.entity;

import jakarta.persistence.*;
import org.locationtech.jts.geom.Geometry;
import java.time.LocalDateTime;

@Entity
@Table(name = "cap_alerts")
public class CapAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String identifier;

    @Column(nullable = false)
    private String sender;

    @Column(name = "sent_at")
    private LocalDateTime sentAt = LocalDateTime.now();

    @Column(nullable = false)
    private String status = "Actual"; // Actual, Exercise, System, Test, Draft

    @Column(name = "msg_type", nullable = false)
    private String msgType = "Alert"; // Alert, Update, Cancel, Ack, Error

    @Column(nullable = false)
    private String scope = "Public"; // Public, Restricted, Private

    @Column(nullable = false)
    private String category; // Geo, Met, Safety, Security, Rescue, Fire, Health, Env, Transport, Infra

    @Column(nullable = false)
    private String event;

    @Column(nullable = false)
    private String urgency; // Immediate, Expected, Future, Past, Unknown

    @Column(nullable = false)
    private String severity; // Extreme, Severe, Moderate, Minor, Unknown

    @Column(nullable = false)
    private String certainty; // Observed, Likely, Possible, Unlikely, Unknown

    @Column(nullable = false)
    private String headline;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String instruction;

    @Column(name = "target_zone_id")
    private Long targetZoneId;

    @Column(name = "scenario_id")
    private Long scenarioId;

    @Column(columnDefinition = "geometry(Geometry, 4326)")
    private Geometry geometry;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    public CapAlert() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getIdentifier() { return identifier; }
    public void setIdentifier(String identifier) { this.identifier = identifier; }

    public String getSender() { return sender; }
    public void setSender(String sender) { this.sender = sender; }

    public LocalDateTime getSentAt() { return sentAt; }
    public void setSentAt(LocalDateTime sentAt) { this.sentAt = sentAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getMsgType() { return msgType; }
    public void setMsgType(String msgType) { this.msgType = msgType; }

    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getEvent() { return event; }
    public void setEvent(String event) { this.event = event; }

    public String getUrgency() { return urgency; }
    public void setUrgency(String urgency) { this.urgency = urgency; }

    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }

    public String getCertainty() { return certainty; }
    public void setCertainty(String certainty) { this.certainty = certainty; }

    public String getHeadline() { return headline; }
    public void setHeadline(String headline) { this.headline = headline; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getInstruction() { return instruction; }
    public void setInstruction(String instruction) { this.instruction = instruction; }

    public Long getTargetZoneId() { return targetZoneId; }
    public void setTargetZoneId(Long targetZoneId) { this.targetZoneId = targetZoneId; }

    public Long getScenarioId() { return scenarioId; }
    public void setScenarioId(Long scenarioId) { this.scenarioId = scenarioId; }

    public Geometry getGeometry() { return geometry; }
    public void setGeometry(Geometry geometry) { this.geometry = geometry; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
}
