package com.disastermgmt.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import org.locationtech.jts.geom.*;
import org.locationtech.jts.io.geojson.GeoJsonReader;

import java.util.*;

/**
 * GeoJSON Feature DTO that manually converts JTS Geometry to GeoJSON-compatible Maps.
 * Keeps the raw JTS geometry for internal use (JsonIgnored) and provides
 * a Map-based geometry getter for JSON serialization.
 */
public class GeoJsonFeature {
    private String type = "Feature";
    private Object id;

    /** The raw JTS geometry — used internally but NOT serialized directly. */
    @JsonIgnore
    private Geometry jtsGeometry;

    private Map<String, Object> properties = new LinkedHashMap<>();

    public GeoJsonFeature() {}

    public GeoJsonFeature(Object id, Geometry jtsGeometry, Map<String, Object> properties) {
        this.type = "Feature";
        this.id = id;
        this.jtsGeometry = jtsGeometry;
        this.properties = properties != null ? properties : new LinkedHashMap<>();
    }

    // ========== Getters for JSON serialization ==========

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public Object getId() { return id; }
    public void setId(Object id) { this.id = id; }

    /**
     * Returns the geometry as a GeoJSON-compatible Map for Jackson serialization.
     * This is what gets written to the JSON response.
     */
    public Map<String, Object> getGeometry() {
        return convertGeometry(jtsGeometry);
    }

    /**
     * Deserializes GeoJSON geometry into JTS Geometry with SRID 4326.
     */
    @JsonProperty("geometry")
    public void setGeometryNode(JsonNode node) {
        if (node != null && !node.isNull()) {
            try {
                GeoJsonReader reader = new GeoJsonReader();
                this.jtsGeometry = reader.read(node.toString());
                if (this.jtsGeometry != null) {
                    this.jtsGeometry.setSRID(4326);
                }
            } catch (Exception e) {
                this.jtsGeometry = null;
            }
        }
    }

    /**
     * Returns the raw JTS Geometry for internal use (e.g., in AnalysisService).
     * This is NOT serialized to JSON.
     */
    @JsonIgnore
    public Geometry getJtsGeometry() { return jtsGeometry; }
    public void setJtsGeometry(Geometry jtsGeometry) { this.jtsGeometry = jtsGeometry; }

    public Map<String, Object> getProperties() { return properties; }
    public void setProperties(Map<String, Object> properties) { this.properties = properties; }

    // ========== Geometry conversion ==========

    private Map<String, Object> convertGeometry(Geometry geom) {
        if (geom == null) return null;

        Map<String, Object> result = new LinkedHashMap<>();

        if (geom instanceof Point) {
            Point p = (Point) geom;
            result.put("type", "Point");
            result.put("coordinates", Arrays.asList(p.getX(), p.getY()));
        } else if (geom instanceof Polygon) {
            Polygon poly = (Polygon) geom;
            result.put("type", "Polygon");
            List<List<List<Double>>> rings = new ArrayList<>();
            rings.add(coordsToList(poly.getExteriorRing().getCoordinates()));
            for (int i = 0; i < poly.getNumInteriorRing(); i++) {
                rings.add(coordsToList(poly.getInteriorRingN(i).getCoordinates()));
            }
            result.put("coordinates", rings);
        } else if (geom instanceof LineString) {
            result.put("type", "LineString");
            result.put("coordinates", coordsToList(geom.getCoordinates()));
        } else if (geom instanceof MultiPolygon) {
            MultiPolygon mp = (MultiPolygon) geom;
            result.put("type", "MultiPolygon");
            List<List<List<List<Double>>>> polys = new ArrayList<>();
            for (int i = 0; i < mp.getNumGeometries(); i++) {
                Polygon poly = (Polygon) mp.getGeometryN(i);
                List<List<List<Double>>> rings = new ArrayList<>();
                rings.add(coordsToList(poly.getExteriorRing().getCoordinates()));
                for (int j = 0; j < poly.getNumInteriorRing(); j++) {
                    rings.add(coordsToList(poly.getInteriorRingN(j).getCoordinates()));
                }
                polys.add(rings);
            }
            result.put("coordinates", polys);
        } else if (geom instanceof MultiLineString) {
            MultiLineString ml = (MultiLineString) geom;
            result.put("type", "MultiLineString");
            List<List<List<Double>>> lines = new ArrayList<>();
            for (int i = 0; i < ml.getNumGeometries(); i++) {
                lines.add(coordsToList(ml.getGeometryN(i).getCoordinates()));
            }
            result.put("coordinates", lines);
        } else if (geom instanceof MultiPoint) {
            MultiPoint mp = (MultiPoint) geom;
            result.put("type", "MultiPoint");
            result.put("coordinates", coordsToList(mp.getCoordinates()));
        } else {
            result.put("type", geom.getGeometryType());
            result.put("wkt", geom.toText());
        }

        return result;
    }

    private List<List<Double>> coordsToList(Coordinate[] coords) {
        List<List<Double>> list = new ArrayList<>();
        for (Coordinate c : coords) {
            list.add(Arrays.asList(c.x, c.y));
        }
        return list;
    }
}
