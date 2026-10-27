package com.disastermgmt.dto;

import java.util.ArrayList;
import java.util.List;

public class GeoJsonFeatureCollection {
    private String type = "FeatureCollection";
    private List<GeoJsonFeature> features = new ArrayList<>();

    public GeoJsonFeatureCollection() {}

    public GeoJsonFeatureCollection(List<GeoJsonFeature> features) {
        this.type = "FeatureCollection";
        this.features = features != null ? features : new ArrayList<>();
    }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public List<GeoJsonFeature> getFeatures() { return features; }
    public void setFeatures(List<GeoJsonFeature> features) { this.features = features; }
}
