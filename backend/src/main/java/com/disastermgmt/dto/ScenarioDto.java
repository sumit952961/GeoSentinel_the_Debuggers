package com.disastermgmt.dto;

import org.locationtech.jts.geom.Geometry;

import java.time.LocalDate;

public class ScenarioDto {
    private Long id;
    private String name;
    private String description;
    private String disasterType;
    private LocalDate eventDate;
    private String locationName;
    private Geometry centerPoint;
    private Geometry boundary;
    private String preImagePath;
    private String postImagePath;
    private String dataSource;
    private Boolean isDemo;
    private Long buildingCount;
    private Long hospitalCount;
    private Long shelterCount;
    private Long roadCount;
    private String state;
    private String district;
    private String country;
    private String disasterSubtype;
    private String dataProvenance;
    private Long hazardZoneCount;

    public ScenarioDto() {}

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

    public Geometry getCenterPoint() { return centerPoint; }
    public void setCenterPoint(Geometry centerPoint) { this.centerPoint = centerPoint; }

    public Geometry getBoundary() { return boundary; }
    public void setBoundary(Geometry boundary) { this.boundary = boundary; }

    public String getPreImagePath() { return preImagePath; }
    public void setPreImagePath(String preImagePath) { this.preImagePath = preImagePath; }

    public String getPostImagePath() { return postImagePath; }
    public void setPostImagePath(String postImagePath) { this.postImagePath = postImagePath; }

    public String getDataSource() { return dataSource; }
    public void setDataSource(String dataSource) { this.dataSource = dataSource; }

    public Boolean getIsDemo() { return isDemo; }
    public void setIsDemo(Boolean isDemo) { this.isDemo = isDemo; }

    public Long getBuildingCount() { return buildingCount; }
    public void setBuildingCount(Long buildingCount) { this.buildingCount = buildingCount; }

    public Long getHospitalCount() { return hospitalCount; }
    public void setHospitalCount(Long hospitalCount) { this.hospitalCount = hospitalCount; }

    public Long getShelterCount() { return shelterCount; }
    public void setShelterCount(Long shelterCount) { this.shelterCount = shelterCount; }

    public Long getRoadCount() { return roadCount; }
    public void setRoadCount(Long roadCount) { this.roadCount = roadCount; }

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

    public Long getHazardZoneCount() { return hazardZoneCount; }
    public void setHazardZoneCount(Long hazardZoneCount) { this.hazardZoneCount = hazardZoneCount; }
}
