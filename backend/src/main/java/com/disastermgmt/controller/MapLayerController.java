package com.disastermgmt.controller;

import com.disastermgmt.dto.GeoJsonFeatureCollection;
import com.disastermgmt.service.MapLayerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * MAP LAYER CONTROLLER
 *
 * REST Endpoints returning GeoJSON FeatureCollections for GIS visualization.
 * Supports both /api/map and /api/map-layers prefixes, and both ?scenarioId= query param
 * and /{scenarioId} path variable for maximum client compatibility.
 */
@RestController
@RequestMapping({"/api/map", "/api/map-layers"})
@CrossOrigin(origins = "*")
public class MapLayerController {

    @Autowired
    private MapLayerService mapLayerService;

    // --- Buildings ---
    @GetMapping({"/buildings", "/buildings/{scenarioId}"})
    public ResponseEntity<GeoJsonFeatureCollection> getBuildings(
            @PathVariable(required = false) Long scenarioId,
            @RequestParam(value = "scenarioId", required = false) Long scenarioIdParam) {
        Long id = scenarioId != null ? scenarioId : scenarioIdParam;
        return ResponseEntity.ok(mapLayerService.getBuildingsGeoJson(id));
    }

    // --- Roads ---
    @GetMapping({"/roads", "/roads/{scenarioId}"})
    public ResponseEntity<GeoJsonFeatureCollection> getRoads(
            @PathVariable(required = false) Long scenarioId,
            @RequestParam(value = "scenarioId", required = false) Long scenarioIdParam) {
        Long id = scenarioId != null ? scenarioId : scenarioIdParam;
        return ResponseEntity.ok(mapLayerService.getRoadsGeoJson(id));
    }

    // --- Hospitals ---
    @GetMapping({"/hospitals", "/hospitals/{scenarioId}"})
    public ResponseEntity<GeoJsonFeatureCollection> getHospitals(
            @PathVariable(required = false) Long scenarioId,
            @RequestParam(value = "scenarioId", required = false) Long scenarioIdParam) {
        Long id = scenarioId != null ? scenarioId : scenarioIdParam;
        return ResponseEntity.ok(mapLayerService.getHospitalsGeoJson(id));
    }

    // --- Shelters ---
    @GetMapping({"/shelters", "/shelters/{scenarioId}"})
    public ResponseEntity<GeoJsonFeatureCollection> getShelters(
            @PathVariable(required = false) Long scenarioId,
            @RequestParam(value = "scenarioId", required = false) Long scenarioIdParam) {
        Long id = scenarioId != null ? scenarioId : scenarioIdParam;
        return ResponseEntity.ok(mapLayerService.getSheltersGeoJson(id));
    }

    // --- Damages ---
    @GetMapping({"/damages", "/damages/{scenarioId}"})
    public ResponseEntity<GeoJsonFeatureCollection> getDamages(
            @PathVariable(required = false) Long scenarioId,
            @RequestParam(value = "scenarioId", required = false) Long scenarioIdParam) {
        Long id = scenarioId != null ? scenarioId : scenarioIdParam;
        return ResponseEntity.ok(mapLayerService.getDamageGeoJson(id));
    }

    // --- Hazards ---
    @GetMapping({"/hazards", "/hazards/{scenarioId}"})
    public ResponseEntity<GeoJsonFeatureCollection> getHazards(
            @PathVariable(required = false) Long scenarioId,
            @RequestParam(value = "scenarioId", required = false) Long scenarioIdParam) {
        Long id = scenarioId != null ? scenarioId : scenarioIdParam;
        return ResponseEntity.ok(mapLayerService.getHazardZonesGeoJson(id));
    }

    // --- Boundary ---
    @GetMapping({"/boundary", "/boundary/{scenarioId}"})
    public ResponseEntity<GeoJsonFeatureCollection> getBoundary(
            @PathVariable(required = false) Long scenarioId,
            @RequestParam(value = "scenarioId", required = false) Long scenarioIdParam) {
        Long id = scenarioId != null ? scenarioId : scenarioIdParam;
        return ResponseEntity.ok(mapLayerService.getBoundaryGeoJson(id));
    }

    // --- Operational Zones ---
    @GetMapping({"/zones", "/zones/{scenarioId}"})
    public ResponseEntity<GeoJsonFeatureCollection> getZones(
            @PathVariable(required = false) Long scenarioId,
            @RequestParam(value = "scenarioId", required = false) Long scenarioIdParam) {
        Long id = scenarioId != null ? scenarioId : scenarioIdParam;
        return ResponseEntity.ok(mapLayerService.getOperationalZonesGeoJson(id));
    }
}

