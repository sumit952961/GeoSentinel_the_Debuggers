package com.disastermgmt.service;

import com.disastermgmt.dto.GeoJsonFeature;
import com.disastermgmt.dto.GeoJsonFeatureCollection;
import com.disastermgmt.entity.CadIncident;
import com.disastermgmt.entity.CapAlert;
import com.disastermgmt.entity.OperationalZone;
import com.disastermgmt.entity.ResponseUnit;
import com.disastermgmt.repository.CadIncidentRepository;
import com.disastermgmt.repository.CapAlertRepository;
import com.disastermgmt.repository.OperationalZoneRepository;
import com.disastermgmt.repository.ResponseUnitRepository;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class EmergencyResponseService {

    @Autowired
    private CapAlertRepository capAlertRepository;

    @Autowired
    private ResponseUnitRepository responseUnitRepository;

    @Autowired
    private CadIncidentRepository cadIncidentRepository;

    @Autowired
    private OperationalZoneRepository operationalZoneRepository;

    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);

    // ==========================================
    // 1. CAP 1.2 ALERT MANAGEMENT
    // ==========================================

    public List<CapAlert> getAlertsByScenario(Long scenarioId) {
        return capAlertRepository.findByScenarioIdOrderByCreatedAtDesc(scenarioId);
    }

    public List<CapAlert> getActiveAlerts() {
        return capAlertRepository.findByStatusOrderByCreatedAtDesc("Actual");
    }

    public CapAlert createAlert(CapAlert alert) {
        if (alert.getIdentifier() == null || alert.getIdentifier().isEmpty()) {
            alert.setIdentifier("AIDRS-" + System.currentTimeMillis() % 100000);
        }
        if (alert.getExpiresAt() == null) {
            alert.setExpiresAt(LocalDateTime.now().plusHours(4));
        }
        if (alert.getSentAt() == null) {
            alert.setSentAt(LocalDateTime.now());
        }
        return capAlertRepository.save(alert);
    }

    public CapAlert generateCapAlertForZone(Long zoneId) {
        Optional<OperationalZone> zoneOpt = operationalZoneRepository.findById(zoneId);
        if (zoneOpt.isEmpty()) return null;

        OperationalZone zone = zoneOpt.get();
        CapAlert alert = new CapAlert();
        alert.setIdentifier("AIDRS-CAP-" + zone.getZoneCode() + "-" + (System.currentTimeMillis() % 10000));
        alert.setSender("COMMAND-HQ@AIDRS.DISASTERMGMT.GOV");
        alert.setSentAt(LocalDateTime.now());
        alert.setStatus("Actual");
        alert.setMsgType("Alert");
        alert.setScope("Public");
        alert.setCategory("Safety");
        alert.setScenarioId(zone.getScenarioId());
        alert.setTargetZoneId(zone.getId());
        alert.setGeometry(zone.getGeometry());
        alert.setExpiresAt(LocalDateTime.now().plusHours(6));

        if ("CRITICAL".equalsIgnoreCase(zone.getCriticality())) {
            alert.setEvent("IMMEDIATE EVACUATION ORDER");
            alert.setUrgency("Immediate");
            alert.setSeverity("Extreme");
            alert.setCertainty("Observed");
            alert.setHeadline("MANDATORY EVACUATION: " + zone.getName() + " (" + zone.getZoneCode() + ")");
            alert.setDescription("Critical structural damage detected in " + (zone.getDestroyedCount() != null ? zone.getDestroyedCount() : 0)
                    + " buildings with severe threats to life. Estimated exposed population: "
                    + (zone.getEstimatedPopulation() != null ? zone.getEstimatedPopulation() : 0) + ".");
            alert.setInstruction("Evacuate immediately via designated green evacuation corridors toward nearest shelter. Do not return to damaged structures.");
        } else if ("HIGH".equalsIgnoreCase(zone.getCriticality())) {
            alert.setEvent("EMERGENCY PREPAREDNESS WARNING");
            alert.setUrgency("Expected");
            alert.setSeverity("Severe");
            alert.setCertainty("Likely");
            alert.setHeadline("PREPARE TO EVACUATE: " + zone.getName() + " (" + zone.getZoneCode() + ")");
            alert.setDescription("High hazard risk detected across structural assets in this sector. "
                    + (zone.getMajorDamageCount() != null ? zone.getMajorDamageCount() : 0) + " buildings sustained major damage.");
            alert.setInstruction("Secure emergency survival kits, gather identification, monitor live updates, and prepare to move to shelter.");
        } else {
            alert.setEvent("SAFETY ADVISORY");
            alert.setUrgency("Future");
            alert.setSeverity("Moderate");
            alert.setCertainty("Possible");
            alert.setHeadline("CIVIL ADVISORY: " + zone.getName() + " (" + zone.getZoneCode() + ")");
            alert.setDescription("Operational sector under monitoring. Roads may experience localized congestion or minor debris.");
            alert.setInstruction("Remain indoors, avoid restricted perimeters, and keep emergency communications lines open.");
        }

        return capAlertRepository.save(alert);
    }

    public String generateCapXml(Long alertId) {
        Optional<CapAlert> alertOpt = capAlertRepository.findById(alertId);
        if (alertOpt.isEmpty()) return "<error>Alert not found</error>";

        CapAlert a = alertOpt.get();
        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<alert xmlns=\"urn:oasis:names:tc:emergency:cap:1.2\">\n");
        xml.append("  <identifier>").append(escapeXml(a.getIdentifier())).append("</identifier>\n");
        xml.append("  <sender>").append(escapeXml(a.getSender())).append("</sender>\n");
        xml.append("  <sent>").append(a.getSentAt()).append("</sent>\n");
        xml.append("  <status>").append(a.getStatus()).append("</status>\n");
        xml.append("  <msgType>").append(a.getMsgType()).append("</msgType>\n");
        xml.append("  <scope>").append(a.getScope()).append("</scope>\n");
        xml.append("  <info>\n");
        xml.append("    <category>").append(a.getCategory()).append("</category>\n");
        xml.append("    <event>").append(escapeXml(a.getEvent())).append("</event>\n");
        xml.append("    <urgency>").append(a.getUrgency()).append("</urgency>\n");
        xml.append("    <severity>").append(a.getSeverity()).append("</severity>\n");
        xml.append("    <certainty>").append(a.getCertainty()).append("</certainty>\n");
        xml.append("    <expires>").append(a.getExpiresAt()).append("</expires>\n");
        xml.append("    <headline>").append(escapeXml(a.getHeadline())).append("</headline>\n");
        xml.append("    <description>").append(escapeXml(a.getDescription())).append("</description>\n");
        xml.append("    <instruction>").append(escapeXml(a.getInstruction())).append("</instruction>\n");
        xml.append("    <area>\n");
        xml.append("      <areaDesc>").append(escapeXml(a.getHeadline())).append("</areaDesc>\n");
        if (a.getGeometry() != null) {
            xml.append("      <circle>").append(a.getGeometry().getCentroid().getY())
               .append(",").append(a.getGeometry().getCentroid().getX()).append(",5.0</circle>\n");
        }
        xml.append("    </area>\n");
        xml.append("  </info>\n");
        xml.append("</alert>");
        return xml.toString();
    }

    private String escapeXml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    // ==========================================
    // 2. CAD INCIDENTS & SOS
    // ==========================================

    public List<CadIncident> getIncidentsByScenario(Long scenarioId) {
        return cadIncidentRepository.findByScenarioIdOrderByCreatedAtDesc(scenarioId);
    }

    public CadIncident reportIncident(CadIncident incident, Double lon, Double lat) {
        if (incident.getCode() == null || incident.getCode().isEmpty()) {
            incident.setCode("INC-" + (System.currentTimeMillis() % 100000));
        }
        if (lon != null && lat != null) {
            incident.setLocation(geometryFactory.createPoint(new Coordinate(lon, lat)));
        }
        return cadIncidentRepository.save(incident);
    }

    public CadIncident assignUnitToIncident(Long incidentId, Long unitId) {
        Optional<CadIncident> incOpt = cadIncidentRepository.findById(incidentId);
        Optional<ResponseUnit> unitOpt = responseUnitRepository.findById(unitId);

        if (incOpt.isPresent() && unitOpt.isPresent()) {
            CadIncident inc = incOpt.get();
            ResponseUnit unit = unitOpt.get();

            inc.setAssignedUnitId(unit.getId());
            inc.setStatus("DISPATCHED");
            inc.setDispatchedAt(LocalDateTime.now());

            unit.setStatus("DISPATCHED");
            unit.setActiveIncidentId(inc.getId());

            responseUnitRepository.save(unit);
            return cadIncidentRepository.save(inc);
        }
        return null;
    }

    public CadIncident updateIncidentStatus(Long incidentId, String status) {
        Optional<CadIncident> incOpt = cadIncidentRepository.findById(incidentId);
        if (incOpt.isPresent()) {
            CadIncident inc = incOpt.get();
            inc.setStatus(status);
            if ("RESOLVED".equalsIgnoreCase(status)) {
                inc.setResolvedAt(LocalDateTime.now());
                if (inc.getAssignedUnitId() != null) {
                    Optional<ResponseUnit> unitOpt = responseUnitRepository.findById(inc.getAssignedUnitId());
                    if (unitOpt.isPresent()) {
                        ResponseUnit unit = unitOpt.get();
                        unit.setStatus("AVAILABLE");
                        unit.setActiveIncidentId(null);
                        responseUnitRepository.save(unit);
                    }
                }
            } else if ("ON_SCENE".equalsIgnoreCase(status)) {
                inc.setArrivedAt(LocalDateTime.now());
            }
            return cadIncidentRepository.save(inc);
        }
        return null;
    }

    // ==========================================
    // 3. FIRST RESPONDER RESPONSE UNITS
    // ==========================================

    public List<ResponseUnit> getAllResponseUnits() {
        return responseUnitRepository.findAll();
    }

    public GeoJsonFeatureCollection getResponseUnitsGeoJson() {
        List<ResponseUnit> units = responseUnitRepository.findAll();
        List<GeoJsonFeature> features = new ArrayList<>();

        for (ResponseUnit u : units) {
            Map<String, Object> props = new LinkedHashMap<>();
            props.put("id", u.getId());
            props.put("callsign", u.getCallsign());
            props.put("unitType", u.getUnitType());
            props.put("status", u.getStatus());
            props.put("personnelCount", u.getPersonnelCount());
            props.put("equipmentManifest", u.getEquipmentManifest());
            props.put("heading", u.getHeading());
            props.put("speedKmh", u.getSpeedKmh());
            props.put("activeIncidentId", u.getActiveIncidentId());
            props.put("lastPing", u.getLastPing());

            features.add(new GeoJsonFeature(u.getId(), u.getCurrentLocation(), props));
        }

        return new GeoJsonFeatureCollection(features);
    }
}
