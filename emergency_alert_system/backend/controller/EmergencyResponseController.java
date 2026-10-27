package com.disastermgmt.controller;

import com.disastermgmt.dto.GeoJsonFeatureCollection;
import com.disastermgmt.entity.CadIncident;
import com.disastermgmt.entity.CapAlert;
import com.disastermgmt.entity.ResponseUnit;
import com.disastermgmt.service.EmergencyResponseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/emergency")
@CrossOrigin(origins = "*")
public class EmergencyResponseController {

    @Autowired
    private EmergencyResponseService emergencyService;

    // ==========================================
    // 1. CAP 1.2 ALERTS
    // ==========================================

    @GetMapping("/alerts/scenario/{scenarioId}")
    public ResponseEntity<List<CapAlert>> getAlertsByScenario(@PathVariable Long scenarioId) {
        return ResponseEntity.ok(emergencyService.getAlertsByScenario(scenarioId));
    }

    @GetMapping("/alerts/active")
    public ResponseEntity<List<CapAlert>> getActiveAlerts() {
        return ResponseEntity.ok(emergencyService.getActiveAlerts());
    }

    @PostMapping("/alerts")
    public ResponseEntity<CapAlert> createAlert(@RequestBody CapAlert alert) {
        return ResponseEntity.ok(emergencyService.createAlert(alert));
    }

    @PostMapping("/alerts/generate-from-zone/{zoneId}")
    public ResponseEntity<CapAlert> generateFromZone(@PathVariable Long zoneId) {
        CapAlert alert = emergencyService.generateCapAlertForZone(zoneId);
        if (alert == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(alert);
    }

    @GetMapping(value = "/alerts/{alertId}/cap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> getCapXml(@PathVariable Long alertId) {
        String xml = emergencyService.generateCapXml(alertId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, "application/xml; charset=UTF-8")
                .body(xml);
    }

    // ==========================================
    // 2. CAD INCIDENTS & SOS
    // ==========================================

    @GetMapping("/incidents/scenario/{scenarioId}")
    public ResponseEntity<List<CadIncident>> getIncidentsByScenario(@PathVariable Long scenarioId) {
        return ResponseEntity.ok(emergencyService.getIncidentsByScenario(scenarioId));
    }

    @PostMapping("/incidents")
    public ResponseEntity<CadIncident> reportIncident(@RequestBody Map<String, Object> payload) {
        CadIncident incident = new CadIncident();
        incident.setTitle((String) payload.getOrDefault("title", "Civilian Emergency SOS"));
        incident.setDisasterType((String) payload.getOrDefault("disasterType", "GENERAL_EMERGENCY"));
        incident.setPriority((String) payload.getOrDefault("priority", "P1_CRITICAL"));
        incident.setAddressText((String) payload.getOrDefault("addressText", "Reported via Civilian Mobile/Web"));
        incident.setReportedBy((String) payload.getOrDefault("reportedBy", "Civilian"));
        incident.setCallerPhone((String) payload.getOrDefault("callerPhone", ""));
        incident.setHazardsPresent((String) payload.getOrDefault("hazardsPresent", ""));

        if (payload.containsKey("scenarioId") && payload.get("scenarioId") != null) {
            incident.setScenarioId(Long.valueOf(payload.get("scenarioId").toString()));
        }
        if (payload.containsKey("zoneId") && payload.get("zoneId") != null) {
            incident.setZoneId(Long.valueOf(payload.get("zoneId").toString()));
        }
        if (payload.containsKey("victimCount") && payload.get("victimCount") != null) {
            incident.setVictimCount(Integer.valueOf(payload.get("victimCount").toString()));
        }
        if (payload.containsKey("trappedCount") && payload.get("trappedCount") != null) {
            incident.setTrappedCount(Integer.valueOf(payload.get("trappedCount").toString()));
        }

        Double lon = payload.containsKey("longitude") && payload.get("longitude") != null
                ? Double.valueOf(payload.get("longitude").toString()) : null;
        Double lat = payload.containsKey("latitude") && payload.get("latitude") != null
                ? Double.valueOf(payload.get("latitude").toString()) : null;

        return ResponseEntity.ok(emergencyService.reportIncident(incident, lon, lat));
    }

    @PostMapping("/incidents/{incidentId}/dispatch/{unitId}")
    public ResponseEntity<CadIncident> dispatchUnit(
            @PathVariable Long incidentId,
            @PathVariable Long unitId) {
        CadIncident inc = emergencyService.assignUnitToIncident(incidentId, unitId);
        if (inc == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(inc);
    }

    @PutMapping("/incidents/{incidentId}/status")
    public ResponseEntity<CadIncident> updateIncidentStatus(
            @PathVariable Long incidentId,
            @RequestBody Map<String, String> payload) {
        String status = payload.get("status");
        CadIncident inc = emergencyService.updateIncidentStatus(incidentId, status);
        if (inc == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(inc);
    }

    // ==========================================
    // 3. FIRST RESPONDER UNITS
    // ==========================================

    @GetMapping("/units")
    public ResponseEntity<List<ResponseUnit>> getAllUnits() {
        return ResponseEntity.ok(emergencyService.getAllResponseUnits());
    }

    @GetMapping("/units/geojson")
    public ResponseEntity<GeoJsonFeatureCollection> getUnitsGeoJson() {
        return ResponseEntity.ok(emergencyService.getResponseUnitsGeoJson());
    }
}
