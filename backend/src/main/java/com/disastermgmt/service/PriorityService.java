package com.disastermgmt.service;

import com.disastermgmt.dto.GeoJsonFeature;
import com.disastermgmt.dto.GeoJsonFeatureCollection;
import com.disastermgmt.entity.PriorityAssessment;
import com.disastermgmt.repository.PriorityAssessmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class PriorityService {

    @Autowired
    private PriorityAssessmentRepository priorityAssessmentRepository;

    public List<PriorityAssessment> getPriorities(Long scenarioId, String minLevel) {
        if (minLevel != null && !minLevel.equalsIgnoreCase("ALL")) {
            return priorityAssessmentRepository.findByScenarioIdAndPriorityLevelOrderByPriorityScoreDesc(scenarioId, minLevel.toUpperCase());
        }
        return priorityAssessmentRepository.findByScenarioIdOrderByPriorityScoreDesc(scenarioId);
    }

    public Optional<PriorityAssessment> getPriorityById(Long id) {
        return priorityAssessmentRepository.findById(id);
    }

    public GeoJsonFeatureCollection getPrioritiesGeoJson(Long scenarioId, String minLevel) {
        List<PriorityAssessment> list = getPriorities(scenarioId, minLevel);
        List<GeoJsonFeature> features = list.stream().map(p -> {
            Map<String, Object> props = new LinkedHashMap<>();
            props.put("id", p.getId());
            props.put("scenarioId", p.getScenarioId());
            props.put("buildingId", p.getBuildingId());
            props.put("building_id", p.getBuildingId());
            props.put("damagePredictionId", p.getDamagePredictionId());
            props.put("priorityScore", p.getPriorityScore());
            props.put("priority_score", p.getPriorityScore());
            props.put("priorityLevel", p.getPriorityLevel());
            props.put("priority_level", p.getPriorityLevel());
            props.put("severityScore", p.getSeverityScore());
            props.put("severity_score", p.getSeverityScore());
            props.put("populationScore", p.getPopulationScore());
            props.put("population_score", p.getPopulationScore());
            props.put("infrastructureScore", p.getInfrastructureScore());
            props.put("infrastructure_score", p.getInfrastructureScore());
            props.put("accessibilityScore", p.getAccessibilityScore());
            props.put("accessibility_score", p.getAccessibilityScore());
            props.put("hazardProximityScore", p.getHazardProximityScore() != null ? p.getHazardProximityScore() : 0.0);
            props.put("hazard_proximity_score", p.getHazardProximityScore() != null ? p.getHazardProximityScore() : 0.0);
            props.put("explanation", p.getExplanation());
            props.put("weights", Map.of(
                    "severity", p.getWeightSeverity() != null ? p.getWeightSeverity() : 0.40,
                    "population", p.getWeightPopulation() != null ? p.getWeightPopulation() : 0.25,
                    "infrastructure", p.getWeightInfrastructure() != null ? p.getWeightInfrastructure() : 0.20,
                    "accessibility", p.getWeightAccessibility() != null ? p.getWeightAccessibility() : 0.15,
                    "hazardProximity", p.getWeightHazardProximity() != null ? p.getWeightHazardProximity() : 0.10
            ));

            return new GeoJsonFeature(p.getId(), p.getGeometry(), props);
        }).collect(Collectors.toList());

        return new GeoJsonFeatureCollection(features);
    }
}
