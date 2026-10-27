package com.disastermgmt.entity;

import jakarta.persistence.*;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.Polygon;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "disaster_scenarios")
public class DisasterScenario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "disaster_type", nullable = false)
    private String disasterType;

    @Column(name = "event_date")
    private LocalDate eventDate;

    @Column(name = "location_name")
    private String locationName;

    @Column(name = "center_point", columnDefinition = "geometry(Point, 4326)")
    private Point centerPoint;

    @Column(columnDefinition = "geometry(Polygon, 4326)")
    private Polygon boundary;

    @Column(name = "pre_image_path")
    private String preImagePath;

    @Column(name = "post_image_path")
    private String postImagePath;

    @Column(name = "data_source")
    private String dataSource;

    @Column(name = "is_demo")
    private Boolean isDemo;

    private String state;
    private String district;

    @Column(name = "country", length = 100)
    private String country = "India";

    @Column(name = "disaster_subtype")
    private String disasterSubtype;

    @Column(name = "data_provenance", columnDefinition = "TEXT")
    private String dataProvenance;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public DisasterScenario() {}

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getDisasterType() { return disasterType; }
    public void setDisasterType(String disasterType) { this.disasterType = disasterType; }

    public LocalDate getEventDate() { return eventDate; }
    public void setEventDate(LocalDate eventDate) { this.eventDate = eventDate; }

    public String getLocationName() { return locationName; }
    public void setLocationName(String locationName) { this.locationName = locationName; }

    public Point getCenterPoint() { return centerPoint; }
    public void setCenterPoint(Point centerPoint) { this.centerPoint = centerPoint; }

    public Polygon getBoundary() { return boundary; }
    public void setBoundary(Polygon boundary) { this.boundary = boundary; }

    public String getPreImagePath() { return preImagePath; }
    public void setPreImagePath(String preImagePath) { this.preImagePath = preImagePath; }

    public String getPostImagePath() { return postImagePath; }
    public void setPostImagePath(String postImagePath) { this.postImagePath = postImagePath; }

    public String getDataSource() { return dataSource; }
    public void setDataSource(String dataSource) { this.dataSource = dataSource; }

    public Boolean getIsDemo() { return isDemo; }
    public void setIsDemo(Boolean isDemo) { this.isDemo = isDemo; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }

    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }

    public String getDisasterSubtype() { return disasterSubtype; }
    public void setDisasterSubtype(String disasterSubtype) { this.disasterSubtype = disasterSubtype; }

    public String getDataProvenance() { return dataProvenance; }
    public void setDataProvenance(String dataProvenance) { this.dataProvenance = dataProvenance; }
}
