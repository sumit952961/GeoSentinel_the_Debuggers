package com.disastermgmt.service;

import com.disastermgmt.dto.GeoJsonFeature;
import com.disastermgmt.dto.GeoJsonFeatureCollection;
import com.disastermgmt.entity.*;
import com.disastermgmt.repository.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class MapLayerService {

    @Autowired
    private BuildingRepository buildingRepository;

    @Autowired
    private RoadRepository roadRepository;

    @Autowired
    private HospitalRepository hospitalRepository;

    @Autowired
    private ShelterRepository shelterRepository;

    @Autowired
    private DamagePredictionRepository damagePredictionRepository;

    @Autowired
    private HazardZoneRepository hazardZoneRepository;

    @Autowired
    private OperationalZoneRepository operationalZoneRepository;

    @Autowired
    private DisasterScenarioRepository disasterScenarioRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

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

    public GeoJsonFeatureCollection getBuildingsGeoJson(Long scenarioId) {
        List<Building> buildings = buildingRepository.findByScenarioId(scenarioId);
        List<GeoJsonFeature> features = buildings.stream().map(b -> {
            Map<String, Object> props = new LinkedHashMap<>();
            props.put("id", b.getId());
            props.put("scenarioId", b.getScenarioId());
            props.put("osmId", b.getOsmId());
            props.put("buildingType", b.getBuildingType());
            props.put("damageClass", b.getDamageClass() != null ? b.getDamageClass() : "no-damage");
            props.put("source", b.getSource() != null ? b.getSource() : "Ground Truth (xBD)");
            props.put("isPrediction", false);

            return new GeoJsonFeature(b.getId(), b.getGeometry(), props);
        }).collect(Collectors.toList());

        return new GeoJsonFeatureCollection(features);
    }

    public GeoJsonFeatureCollection getRoadsGeoJson(Long scenarioId) {
        List<Road> roads = roadRepository.findByScenarioId(scenarioId);
        List<GeoJsonFeature> features = roads.stream().map(r -> {
            Map<String, Object> props = new LinkedHashMap<>();
            props.put("id", r.getId());
            props.put("osmId", r.getOsmId());
            props.put("name", r.getName() != null ? r.getName() : "Unnamed Road");
            props.put("highwayType", r.getHighwayType());
            props.put("isBlocked", r.getIsBlocked() != null ? r.getIsBlocked() : false);
            props.put("blockReason", r.getBlockReason());
            props.put("costMultiplier", r.getCostMultiplier());

            return new GeoJsonFeature(r.getId(), r.getGeometry(), props);
        }).collect(Collectors.toList());

        return new GeoJsonFeatureCollection(features);
    }

    public GeoJsonFeatureCollection getHospitalsGeoJson(Long scenarioId) {
        List<Hospital> hospitals = hospitalRepository.findByScenarioId(scenarioId);
        List<GeoJsonFeature> features = hospitals.stream().map(h -> {
            Map<String, Object> props = new LinkedHashMap<>();
            props.put("id", h.getId());
            props.put("osmId", h.getOsmId());
            props.put("name", h.getName() != null ? h.getName() : "Emergency Medical Center");
            props.put("capacity", h.getCapacity());
            props.put("isOperational", h.getIsOperational() != null ? h.getIsOperational() : true);
            props.put("phone", h.getPhone());

            return new GeoJsonFeature(h.getId(), h.getGeometry(), props);
        }).collect(Collectors.toList());

        return new GeoJsonFeatureCollection(features);
    }

    public GeoJsonFeatureCollection getSheltersGeoJson(Long scenarioId) {
        List<Shelter> shelters = shelterRepository.findByScenarioId(scenarioId);
        List<GeoJsonFeature> features = shelters.stream().map(s -> {
            Map<String, Object> props = new LinkedHashMap<>();
            props.put("id", s.getId());
            props.put("osmId", s.getOsmId());
            props.put("name", s.getName() != null ? s.getName() : "Evacuation Shelter");
            props.put("capacity", s.getCapacity());
            props.put("isOperational", s.getIsOperational() != null ? s.getIsOperational() : true);
            props.put("shelterType", s.getShelterType());

            return new GeoJsonFeature(s.getId(), s.getGeometry(), props);
        }).collect(Collectors.toList());

        return new GeoJsonFeatureCollection(features);
    }

    public GeoJsonFeatureCollection getDamageGeoJson(Long scenarioId) {
        List<DamagePrediction> damages = damagePredictionRepository.findByScenarioId(scenarioId);
        List<GeoJsonFeature> features = damages.stream().map(d -> {
            Map<String, Object> props = new LinkedHashMap<>();
            props.put("id", d.getId());
            props.put("scenarioId", d.getScenarioId());
            props.put("buildingId", d.getBuildingId());
            props.put("damageClass", d.getDamageClass());
            props.put("confidence", d.getConfidence());
            props.put("probNoDamage", d.getProbNoDamage());
            props.put("probMinor", d.getProbMinor());
            props.put("probMajor", d.getProbMajor());
            props.put("probDestroyed", d.getProbDestroyed());

            // Parse probabilities dictionary if present
            if (d.getProbabilities() != null && !d.getProbabilities().isEmpty()) {
                try {
                    Map<String, Object> probMap = objectMapper.readValue(d.getProbabilities(), new TypeReference<Map<String, Object>>() {});
                    props.put("probabilities", probMap);
                } catch (Exception e) {
                    Map<String, Object> fallbackProbs = new LinkedHashMap<>();
                    fallbackProbs.put("no-damage", d.getProbNoDamage());
                    fallbackProbs.put("minor-damage", d.getProbMinor());
                    fallbackProbs.put("major-damage", d.getProbMajor());
                    fallbackProbs.put("destroyed", d.getProbDestroyed());
                    props.put("probabilities", fallbackProbs);
                }
            } else {
                Map<String, Object> fallbackProbs = new LinkedHashMap<>();
                fallbackProbs.put("no-damage", d.getProbNoDamage());
                fallbackProbs.put("minor-damage", d.getProbMinor());
                fallbackProbs.put("major-damage", d.getProbMajor());
                fallbackProbs.put("destroyed", d.getProbDestroyed());
                props.put("probabilities", fallbackProbs);
            }

            props.put("modelVersion", d.getModelVersion() != null ? d.getModelVersion() : "Two-Stage ResNet34+SiameseResNet18");
            props.put("source", d.getSource() != null ? d.getSource() : "AI Prediction");
            props.put("isPrediction", d.getIsPrediction() != null ? d.getIsPrediction() : true);

            return new GeoJsonFeature(d.getId(), d.getGeometry(), props);
        }).collect(Collectors.toList());

        return new GeoJsonFeatureCollection(features);
    }

    public GeoJsonFeatureCollection getBoundaryGeoJson(Long scenarioId) {
        Optional<DisasterScenario> scOpt = disasterScenarioRepository.findById(scenarioId);
        List<GeoJsonFeature> features = new ArrayList<>();
        if (scOpt.isPresent() && scOpt.get().getBoundary() != null) {
            DisasterScenario sc = scOpt.get();
            Map<String, Object> props = new LinkedHashMap<>();
            props.put("id", sc.getId());
            props.put("name", sc.getName());
            props.put("disasterType", sc.getDisasterType());
            features.add(new GeoJsonFeature(sc.getId(), sc.getBoundary(), props));
        }
        return new GeoJsonFeatureCollection(features);
    }

    public GeoJsonFeatureCollection getOperationalZonesGeoJson(Long scenarioId) {
        List<OperationalZone> zones = operationalZoneRepository.findByScenarioIdOrderByCriticalityScoreDesc(scenarioId);
        List<GeoJsonFeature> features = zones.stream().map(z -> {
            Map<String, Object> props = new LinkedHashMap<>();
            props.put("id", z.getId());
            props.put("scenarioId", z.getScenarioId());
            props.put("zoneCode", z.getZoneCode());
            props.put("name", z.getName());
            props.put("criticality", z.getCriticality());
            props.put("criticalityScore", z.getCriticalityScore());
            String crit = z.getCriticality();
            String col = "#10b981";
            if ("CRITICAL".equalsIgnoreCase(crit)) col = "#ef4444";
            else if ("HIGH".equalsIgnoreCase(crit)) col = "#f97316";
            else if ("MEDIUM".equalsIgnoreCase(crit) || "MODERATE".equalsIgnoreCase(crit)) col = "#eab308";
            props.put("color", col);
            props.put("totalBuildings", z.getTotalBuildings());
            props.put("destroyedCount", z.getDestroyedCount());
            props.put("majorDamageCount", z.getMajorDamageCount());
            props.put("minorDamageCount", z.getMinorDamageCount());
            props.put("noDamageCount", z.getNoDamageCount());
            props.put("estimatedPopulation", z.getEstimatedPopulation());
            props.put("avgPriorityScore", z.getAvgPriorityScore());
            props.put("hospitalsCount", z.getHospitalsCount());
            props.put("sheltersCount", z.getSheltersCount());
            props.put("blockedRoadsCount", z.getBlockedRoadsCount());
            props.put("highestPriorityBuildingId", z.getHighestPriorityBuildingId());
            props.put("recommendedAction", z.getRecommendedAction());
            props.put("explanation", z.getExplanation());
            if (z.getConstituentBuildingIds() != null) {
                try {
                    props.put("constituentBuildingIds", objectMapper.readValue(z.getConstituentBuildingIds(), new TypeReference<List<Long>>() {}));
                } catch (Exception e) {
                    props.put("constituentBuildingIds", Collections.emptyList());
                }
            } else {
                props.put("constituentBuildingIds", Collections.emptyList());
            }
            return new GeoJsonFeature(z.getId(), z.getGeometry(), props);
        }).collect(Collectors.toList());

        return new GeoJsonFeatureCollection(features);
    }
}

