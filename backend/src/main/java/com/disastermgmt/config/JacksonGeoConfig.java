package com.disastermgmt.config;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.*;
import org.locationtech.jts.geom.*;
import org.locationtech.jts.io.geojson.GeoJsonReader;
import org.locationtech.jts.io.geojson.GeoJsonWriter;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;

@Configuration
public class JacksonGeoConfig {

    public static class GeometrySerializer<T extends Geometry> extends JsonSerializer<T> {
        @Override
        public void serialize(T value, JsonGenerator gen, SerializerProvider serializers) throws IOException {
            if (value == null) {
                gen.writeNull();
            } else {
                GeoJsonWriter writer = new GeoJsonWriter();
                String geoJson = writer.write(value);
                gen.writeRawValue(geoJson);
            }
        }
    }

    public static class GeometryDeserializer<T extends Geometry> extends JsonDeserializer<T> {
        @Override
        @SuppressWarnings("unchecked")
        public T deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
            JsonNode node = p.getCodec().readTree(p);
            if (node == null || node.isNull()) {
                return null;
            }
            GeoJsonReader reader = new GeoJsonReader();
            try {
                Geometry geom = reader.read(node.toString());
                if (geom != null) {
                    geom.setSRID(4326);
                }
                return (T) geom;
            } catch (Exception e) {
                throw new IOException("Failed to parse GeoJSON geometry: " + e.getMessage(), e);
            }
        }
    }

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer jsonCustomizer() {
        return builder -> {
            GeometrySerializer<Geometry> serializer = new GeometrySerializer<>();
            GeometryDeserializer<Geometry> deserializer = new GeometryDeserializer<>();

            builder.serializerByType(Geometry.class, serializer);
            builder.serializerByType(Point.class, serializer);
            builder.serializerByType(Polygon.class, serializer);
            builder.serializerByType(LineString.class, serializer);
            builder.serializerByType(MultiPolygon.class, serializer);
            builder.serializerByType(MultiLineString.class, serializer);

            builder.deserializerByType(Geometry.class, deserializer);
            builder.deserializerByType(Point.class, (JsonDeserializer) deserializer);
            builder.deserializerByType(Polygon.class, (JsonDeserializer) deserializer);
            builder.deserializerByType(LineString.class, (JsonDeserializer) deserializer);
        };
    }
}
