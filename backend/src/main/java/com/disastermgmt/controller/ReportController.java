package com.disastermgmt.controller;

import com.disastermgmt.entity.*;
import com.disastermgmt.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Report Generation Controller.
 * 
 * Aggregates scenario data (buildings, damage, priorities, facilities,
 * roads, routing info) into a structured report JSON.
 */
@RestController
@RequestMapping("/api/reports")
@CrossOrigin(origins = "*")
public class ReportController {

    @Autowired private DisasterScenarioRepository scenarioRepo;
    @Autowired private BuildingRepository buildingRepo;
    @Autowired private DamagePredictionRepository damageRepo;
    @Autowired private HospitalRepository hospitalRepo;
    @Autowired private ShelterRepository shelterRepo;
    @Autowired private RoadRepository roadRepo;
    @Autowired private OperationalZoneRepository zoneRepo;
    @Autowired private com.disastermgmt.service.MapLayerService mapLayerService;

    @GetMapping("/{scenarioId}")
    public ResponseEntity<?> generateReport(@PathVariable Long scenarioId) {
        var scenarioOpt = scenarioRepo.findById(scenarioId);
        if (scenarioOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        DisasterScenario scenario = scenarioOpt.get();
        Map<String, Object> report = new LinkedHashMap<>();

        // 1. Scenario metadata
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("id", scenario.getId());
        meta.put("name", scenario.getName());
        meta.put("description", scenario.getDescription());
        meta.put("disasterType", scenario.getDisasterType());
        meta.put("eventDate", scenario.getEventDate());
        meta.put("state", scenario.getState());
        meta.put("district", scenario.getDistrict());
        meta.put("country", scenario.getCountry());
        meta.put("dataProvenance", scenario.getDataProvenance());
        report.put("scenario", meta);

        // 2. Damage distribution
        List<DamagePrediction> damages = damageRepo.findByScenarioId(scenarioId);
        Map<String, Long> damageDist = damages.stream()
                .collect(Collectors.groupingBy(DamagePrediction::getDamageClass, Collectors.counting()));
        
        Map<String, Object> damageSection = new LinkedHashMap<>();
        damageSection.put("totalPredictions", damages.size());
        damageSection.put("distribution", damageDist);
        
        // Label source breakdown
        Map<String, Long> labelSources = damages.stream()
                .collect(Collectors.groupingBy(
                    d -> d.getLabelSource() != null ? d.getLabelSource() : "unknown",
                    Collectors.counting()));
        damageSection.put("labelSources", labelSources);
        report.put("damage", damageSection);
        report.put("damages", mapLayerService.getDamageGeoJson(scenarioId));

        // 3. Buildings
        List<Building> buildings = buildingRepo.findByScenarioId(scenarioId);
        Map<String, Object> buildingSection = new LinkedHashMap<>();
        buildingSection.put("totalBuildings", buildings.size());
        Map<String, Long> buildingSources = buildings.stream()
                .collect(Collectors.groupingBy(
                    b -> b.getSource() != null ? b.getSource() : "unknown",
                    Collectors.counting()));
        buildingSection.put("sources", buildingSources);
        report.put("buildings", buildingSection);

        // 4. Facilities
        List<Hospital> hospitals = hospitalRepo.findByScenarioId(scenarioId);
        List<Shelter> shelters = shelterRepo.findByScenarioId(scenarioId);
        
        Map<String, Object> facilitySection = new LinkedHashMap<>();
        facilitySection.put("hospitals", hospitals.stream().map(h -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", h.getName());
            m.put("operational", h.getIsOperational());
            m.put("capacity", h.getCapacity());
            return m;
        }).collect(Collectors.toList()));
        
        facilitySection.put("shelters", shelters.stream().map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", s.getName());
            m.put("operational", s.getIsOperational());
            m.put("capacity", s.getCapacity());
            return m;
        }).collect(Collectors.toList()));
        
        facilitySection.put("operationalHospitals", 
            hospitals.stream().filter(Hospital::getIsOperational).count());
        facilitySection.put("totalShelterCapacity",
            shelters.stream().mapToInt(s -> s.getCapacity() != null ? s.getCapacity() : 0).sum());
        report.put("facilities", facilitySection);

        // 5. Roads
        List<Road> roads = roadRepo.findByScenarioId(scenarioId);
        Map<String, Object> roadSection = new LinkedHashMap<>();
        roadSection.put("totalRoads", roads.size());
        roadSection.put("blockedRoads", roads.stream().filter(Road::getIsBlocked).count());
        roadSection.put("roads", roads.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", r.getName());
            m.put("blocked", r.getIsBlocked());
            m.put("blockReason", r.getBlockReason());
            m.put("hazardLevel", r.getHazardLevel());
            return m;
        }).collect(Collectors.toList()));
        report.put("roads", roadSection);

        // 6. Operational Zones
        List<OperationalZone> zones = zoneRepo.findByScenarioIdOrderByCriticalityScoreDesc(scenarioId);
        Map<String, Object> zoneSection = new LinkedHashMap<>();
        zoneSection.put("totalZones", zones.size());
        zoneSection.put("criticalZones", zones.stream().filter(z -> "CRITICAL".equalsIgnoreCase(z.getCriticality())).count());
        zoneSection.put("highZones", zones.stream().filter(z -> "HIGH".equalsIgnoreCase(z.getCriticality())).count());
        zoneSection.put("mediumZones", zones.stream().filter(z -> "MEDIUM".equalsIgnoreCase(z.getCriticality())).count());
        zoneSection.put("lowZones", zones.stream().filter(z -> "LOW".equalsIgnoreCase(z.getCriticality())).count());
        zoneSection.put("zones", zones.stream().map(z -> {
            Map<String, Object> zm = new LinkedHashMap<>();
            zm.put("code", z.getZoneCode());
            zm.put("name", z.getName());
            zm.put("criticality", z.getCriticality());
            zm.put("criticalityScore", z.getCriticalityScore());
            zm.put("totalBuildings", z.getTotalBuildings());
            zm.put("destroyedCount", z.getDestroyedCount());
            zm.put("majorDamageCount", z.getMajorDamageCount());
            zm.put("estimatedPopulation", z.getEstimatedPopulation());
            zm.put("highestPriorityBuildingId", z.getHighestPriorityBuildingId());
            zm.put("recommendedAction", z.getRecommendedAction());
            zm.put("explanation", z.getExplanation());
            return zm;
        }).collect(Collectors.toList()));
        report.put("operationalZones", zoneSection);

        // 7. Model info
        Map<String, Object> modelSection = new LinkedHashMap<>();
        modelSection.put("baselineModel", "U-Net ResNet34 (xBD-trained)");
        modelSection.put("indiaTunedModel", "U-Net ResNet34 (India-tuned v1: Chamoli + Cyclone Fani)");
        modelSection.put("architecture", "Two-Stage U-Net with ResNet34 Backbone");
        modelSection.put("note", "Fine-tuned on verified Indian disaster imagery with ground truth labels");
        report.put("model", modelSection);

        // 8. Generation timestamp
        report.put("generatedAt", new Date().toInstant().toString());

        return ResponseEntity.ok(report);
    }
}
