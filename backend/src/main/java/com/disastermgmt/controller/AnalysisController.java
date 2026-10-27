package com.disastermgmt.controller;

import com.disastermgmt.dto.GeoJsonFeatureCollection;
import com.disastermgmt.service.AnalysisService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * ANALYSIS CONTROLLER
 *
 * REST Endpoints:
 *   POST /api/analysis/{scenarioId}/import-predictions  -> Import AI GeoJSON predictions into PostGIS
 *   GET  /api/analysis/{scenarioId}/summary             -> Get damage and infrastructure statistics
 */
@RestController
@RequestMapping("/api/analysis")
public class AnalysisController {

    @Autowired
    private AnalysisService analysisService;

    @PostMapping("/{scenarioId}/import-predictions")
    public ResponseEntity<Map<String, Object>> importPredictions(
            @PathVariable Long scenarioId,
            @RequestBody GeoJsonFeatureCollection featureCollection,
            @RequestParam(required = false) String modelVersion) {
        return ResponseEntity.ok(analysisService.importPredictions(scenarioId, featureCollection, modelVersion));
    }

    @GetMapping("/{scenarioId}/summary")
    public ResponseEntity<Map<String, Object>> getSummary(@PathVariable Long scenarioId) {
        return ResponseEntity.ok(analysisService.getScenarioSummary(scenarioId));
    }
}
