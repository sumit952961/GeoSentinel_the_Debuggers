package com.disastermgmt.controller;

import com.disastermgmt.dto.GeoJsonFeatureCollection;
import com.disastermgmt.entity.HazardZone;
import com.disastermgmt.service.HazardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/hazards")
public class HazardController {

    @Autowired
    private HazardService hazardService;

    @GetMapping
    public ResponseEntity<GeoJsonFeatureCollection> getHazardZones(@RequestParam Long scenarioId) {
        return ResponseEntity.ok(hazardService.getHazardZonesGeoJson(scenarioId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<HazardZone> getHazardZoneById(@PathVariable Long id) {
        return hazardService.getHazardZoneById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
