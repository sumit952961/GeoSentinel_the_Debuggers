package com.disastermgmt.controller;

import com.disastermgmt.dto.GeoJsonFeatureCollection;
import com.disastermgmt.entity.PriorityAssessment;
import com.disastermgmt.service.PriorityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * PRIORITY ASSESSMENT CONTROLLER
 *
 * REST Endpoints:
 *   GET /api/priorities?scenarioId={id}&minLevel={level}  -> List priorities
 *   GET /api/priorities/{id}                             -> Get specific priority details
 *   GET /api/priorities/geojson?scenarioId={id}          -> GeoJSON FeatureCollection with explainability
 */
@RestController
@RequestMapping("/api/priorities")
public class PriorityController {

    @Autowired
    private PriorityService priorityService;

    @GetMapping
    public ResponseEntity<List<PriorityAssessment>> getPriorities(
            @RequestParam Long scenarioId,
            @RequestParam(required = false) String minLevel) {
        return ResponseEntity.ok(priorityService.getPriorities(scenarioId, minLevel));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PriorityAssessment> getPriorityById(@PathVariable Long id) {
        return priorityService.getPriorityById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/geojson")
    public ResponseEntity<GeoJsonFeatureCollection> getPrioritiesGeoJson(
            @RequestParam Long scenarioId,
            @RequestParam(required = false) String minLevel) {
        return ResponseEntity.ok(priorityService.getPrioritiesGeoJson(scenarioId, minLevel));
    }
}
