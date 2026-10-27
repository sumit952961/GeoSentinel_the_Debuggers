package com.disastermgmt.service;

import com.disastermgmt.dto.GeoJsonFeature;
import com.disastermgmt.dto.GeoJsonFeatureCollection;
import com.disastermgmt.entity.HazardZone;
import com.disastermgmt.repository.HazardZoneRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class HazardService {

    @Autowired
    private HazardZoneRepository hazardZoneRepository;

    public GeoJsonFeatureCollection getHazardZonesGeoJson(Long scenarioId) {
        List<HazardZone> zones = hazardZoneRepository.findByScenarioId(scenarioId);
        List<GeoJsonFeature> features = zones.stream().map(z -> {
            Map<String, Object> props = new LinkedHashMap<>();
            props.put("id", z.getId());
            props.put("scenarioId", z.getScenarioId());
            props.put("hazardType", z.getHazardType());
            props.put("severity", z.getSeverity());
            props.put("description", z.getDescription());
            props.put("source", z.getSource());
            return new GeoJsonFeature(z.getId(), z.getGeometry(), props);
        }).collect(Collectors.toList());

        return new GeoJsonFeatureCollection(features);
    }
    
    public Optional<HazardZone> getHazardZoneById(Long id) {
        return hazardZoneRepository.findById(id);
    }
}
