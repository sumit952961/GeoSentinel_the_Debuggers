package com.disastermgmt.service;

import com.disastermgmt.dto.GeoJsonFeature;
import com.disastermgmt.dto.GeoJsonFeatureCollection;
import com.disastermgmt.entity.DamagePrediction;
import com.disastermgmt.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.Polygon;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class AnalysisService {

    @Autowired
    private DamagePredictionRepository damagePredictionRepository;

    @Autowired
    private BuildingRepository buildingRepository;

    @Autowired
    private HospitalRepository hospitalRepository;

    @Autowired
    private ShelterRepository shelterRepository;

    @Autowired
    private RoadRepository roadRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    public Map<String, Object> importPredictions(Long scenarioId, GeoJsonFeatureCollection featureCollection, String modelVersion) {
        if (featureCollection == null || featureCollection.getFeatures() == null) {
            throw new IllegalArgumentException("FeatureCollection cannot be null or empty");
        }

        // Clean prior predictions for this scenario to avoid stale duplicates
        damagePredictionRepository.deleteByScenarioId(scenarioId);

        List<DamagePrediction> entities = new ArrayList<>();
        int importedCount = 0;

        for (GeoJsonFeature feat : featureCollection.getFeatures()) {
            Geometry geom = feat.getJtsGeometry();
            if (geom == null || !geom.isValid() || geom.isEmpty()) {
                continue;
            }

            Polygon polyGeom = null;
            if (geom instanceof Polygon) {
                polyGeom = (Polygon) geom;
            } else if (geom.getGeometryType().equalsIgnoreCase("Polygon")) {
                polyGeom = (Polygon) geom;
            }

            if (polyGeom == null) {
                continue;
            }

            Map<String, Object> props = feat.getProperties();
            String damageClass = "no-damage";
            Double confidence = 0.5;
            Double probNo = null, probMin = null, probMaj = null, probDes = null;
            String probJson = null;

            if (props != null) {
                if (props.containsKey("damage_class")) {
                    damageClass = String.valueOf(props.get("damage_class"));
                } else if (props.containsKey("damageClass")) {
                    damageClass = String.valueOf(props.get("damageClass"));
                }

                if (props.containsKey("confidence")) {
                    try {
                        confidence = Double.parseDouble(String.valueOf(props.get("confidence")));
                    } catch (Exception ignored) {}
                }

                if (props.containsKey("probabilities") && props.get("probabilities") instanceof Map) {
                    try {
                        Map<?, ?> probMap = (Map<?, ?>) props.get("probabilities");
                        probJson = objectMapper.writeValueAsString(probMap);
                        if (probMap.containsKey("no-damage")) probNo = Double.parseDouble(String.valueOf(probMap.get("no-damage")));
                        if (probMap.containsKey("minor-damage")) probMin = Double.parseDouble(String.valueOf(probMap.get("minor-damage")));
                        if (probMap.containsKey("major-damage")) probMaj = Double.parseDouble(String.valueOf(probMap.get("major-damage")));
                        if (probMap.containsKey("destroyed")) probDes = Double.parseDouble(String.valueOf(probMap.get("destroyed")));
                    } catch (Exception ignored) {}
                }
            }

            DamagePrediction dp = new DamagePrediction();
            dp.setScenarioId(scenarioId);
            dp.setGeometry(polyGeom);
            dp.setDamageClass(damageClass);
            dp.setConfidence(confidence);
            dp.setProbNoDamage(probNo);
            dp.setProbMinor(probMin);
            dp.setProbMajor(probMaj);
            dp.setProbDestroyed(probDes);
            dp.setProbabilities(probJson);
            dp.setModelVersion(modelVersion != null ? modelVersion : "Two-Stage ResNet34+SiameseResNet18");
            dp.setSource("AI Prediction");
            dp.setIsPrediction(true);

            entities.add(dp);
            importedCount++;
        }

        damagePredictionRepository.saveAll(entities);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("scenarioId", scenarioId);
        response.put("importedPredictionsCount", importedCount);
        response.put("status", "SUCCESS");
        return response;
    }

    public Map<String, Object> getScenarioSummary(Long scenarioId) {
        List<DamagePrediction> predictions = damagePredictionRepository.findByScenarioId(scenarioId);
        long totalBuildings = buildingRepository.countByScenarioId(scenarioId);
        long totalHospitals = hospitalRepository.countByScenarioId(scenarioId);
        long totalShelters = shelterRepository.countByScenarioId(scenarioId);
        long totalRoads = roadRepository.countByScenarioId(scenarioId);

        long noDamageCount = 0;
        long minorDamageCount = 0;
        long majorDamageCount = 0;
        long destroyedCount = 0;
        long highConfidenceDamageCount = 0;

        for (DamagePrediction p : predictions) {
            String dc = p.getDamageClass();
            if ("no-damage".equalsIgnoreCase(dc)) noDamageCount++;
            else if ("minor-damage".equalsIgnoreCase(dc)) minorDamageCount++;
            else if ("major-damage".equalsIgnoreCase(dc)) majorDamageCount++;
            else if ("destroyed".equalsIgnoreCase(dc)) destroyedCount++;

            if (!"no-damage".equalsIgnoreCase(dc) && p.getConfidence() != null && p.getConfidence() >= 0.70) {
                highConfidenceDamageCount++;
            }
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("scenarioId", scenarioId);
        summary.put("totalBuildings", totalBuildings > 0 ? totalBuildings : predictions.size());
        summary.put("totalPredictions", predictions.size());
        summary.put("noDamageCount", noDamageCount);
        summary.put("minorDamageCount", minorDamageCount);
        summary.put("majorDamageCount", majorDamageCount);
        summary.put("destroyedCount", destroyedCount);
        summary.put("highConfidenceDamageCount", highConfidenceDamageCount);
        summary.put("hospitalCount", totalHospitals);
        summary.put("shelterCount", totalShelters);
        summary.put("roadCount", totalRoads);
        summary.put("disclaimer", "Model predictions are automated AI estimates and do not represent verified field reports.");

        return summary;
    }
}
