package com.disastermgmt.controller;

import com.disastermgmt.dto.GeoJsonFeature;
import com.disastermgmt.entity.EvacuationRoute;
import com.disastermgmt.service.RouteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * ROUTE CONTROLLER
 *
 * REST Endpoints:
 *   POST /api/routes            -> Calculate and save an evacuation or responder route
 *   GET  /api/routes            -> List calculated routes for a scenario
 *   GET  /api/routes/{id}       -> Get route details
 *   GET  /api/routes/{id}/geojson -> Get route GeoJSON LineString
 */
@RestController
@RequestMapping("/api/routes")
public class RouteController {

    @Autowired
    private RouteService routeService;

    public static class RouteRequestDto {
        private Long scenarioId = 1L;
        private Long priorityId;
        private Double originLon;
        private Double originLat;
        private String destinationType = "hospital";
        private Boolean avoidBlocked = true;
        private String routePurpose = "EVACUATION"; // "RESPONDER" or "EVACUATION"

        public Long getScenarioId() { return scenarioId; }
        public void setScenarioId(Long scenarioId) { this.scenarioId = scenarioId; }
        public Long getPriorityId() { return priorityId; }
        public void setPriorityId(Long priorityId) { this.priorityId = priorityId; }
        public Double getOriginLon() { return originLon; }
        public void setOriginLon(Double originLon) { this.originLon = originLon; }
        public Double getOriginLat() { return originLat; }
        public void setOriginLat(Double originLat) { this.originLat = originLat; }
        public String getDestinationType() { return destinationType; }
        public void setDestinationType(String destinationType) { this.destinationType = destinationType; }
        public Boolean getAvoidBlocked() { return avoidBlocked; }
        public void setAvoidBlocked(Boolean avoidBlocked) { this.avoidBlocked = avoidBlocked; }
        public String getRoutePurpose() { return routePurpose; }
        public void setRoutePurpose(String routePurpose) { this.routePurpose = routePurpose; }
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> calculateRoute(@RequestBody RouteRequestDto req) {
        return ResponseEntity.ok(routeService.calculateAndSaveRoute(
                req.getScenarioId(),
                req.getPriorityId(),
                req.getOriginLon(),
                req.getOriginLat(),
                req.getDestinationType(),
                req.getAvoidBlocked(),
                req.getRoutePurpose()
        ));
    }

    @GetMapping
    public ResponseEntity<List<EvacuationRoute>> getRoutes(@RequestParam Long scenarioId) {
        return ResponseEntity.ok(routeService.getRoutesByScenario(scenarioId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<EvacuationRoute> getRouteById(@PathVariable Long id) {
        return routeService.getRouteById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/geojson")
    public ResponseEntity<GeoJsonFeature> getRouteGeoJson(@PathVariable Long id) {
        return routeService.getRouteGeoJson(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
