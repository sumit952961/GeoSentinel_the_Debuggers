package com.disastermgmt.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;

import javax.sql.DataSource;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * HEALTH CONTROLLER
 *
 * Purpose:
 *   Provides health-check endpoints so we can verify that the
 *   backend is running and can reach its dependencies (database
 *   and AI service).
 *
 * Endpoints:
 *   GET /api/health          → Is the backend itself alive?
 *   GET /api/health/detailed → Can the backend reach the database
 *                              and AI service?
 *
 * How to test:
 *   Open your browser and go to:
 *     http://localhost:8080/api/health
 *   You should see a JSON response with "status": "UP".
 *
 * Where it fits:
 *   React calls this endpoint to show a green/red status indicator
 *   on the dashboard, confirming all services are connected.
 */
@RestController
@RequestMapping("/api/health")
public class HealthController {

    // WebClient to call the FastAPI AI service
    @Autowired
    private WebClient aiServiceWebClient;

    // DataSource gives us access to the database connection pool
    @Autowired
    private DataSource dataSource;

    @Value("${ai-service.url:http://localhost:8000}")
    private String aiServiceUrl;

    /**
     * Simple health check — just confirms the backend is running.
     *
     * Response example:
     * {
     *   "status": "UP",
     *   "service": "disaster-management-backend",
     *   "timestamp": "2024-01-15T10:30:00"
     * }
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "UP");
        response.put("service", "disaster-management-backend");
        response.put("timestamp", LocalDateTime.now().toString());
        return ResponseEntity.ok(response);
    }

    /**
     * Detailed health check — tests connections to database and AI service.
     *
     * This endpoint actually tries to connect to PostgreSQL and FastAPI
     * to verify they are reachable. If a connection fails, we report
     * it as "DOWN" with the error message.
     *
     * Response example:
     * {
     *   "status": "UP",
     *   "database": { "status": "UP", "type": "PostgreSQL" },
     *   "aiService": { "status": "UP", "url": "http://localhost:8000" }
     * }
     */
    @GetMapping("/detailed")
    public ResponseEntity<Map<String, Object>> detailedHealth() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("service", "disaster-management-backend");
        response.put("timestamp", LocalDateTime.now().toString());

        // --- Check Database ---
        Map<String, Object> dbStatus = new LinkedHashMap<>();
        try (Connection conn = dataSource.getConnection()) {
            dbStatus.put("status", "UP");
            dbStatus.put("type", conn.getMetaData().getDatabaseProductName());
            dbStatus.put("version", conn.getMetaData().getDatabaseProductVersion());
        } catch (Exception e) {
            dbStatus.put("status", "DOWN");
            dbStatus.put("error", e.getMessage());
        }
        response.put("database", dbStatus);

        // --- Check AI Service ---
        Map<String, Object> aiStatus = new LinkedHashMap<>();
        try {
            // Try to call FastAPI's /health endpoint
            String aiResponse = aiServiceWebClient
                    .get()
                    .uri("/health")
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(java.time.Duration.ofSeconds(5));

            aiStatus.put("status", "UP");
            aiStatus.put("url", aiServiceUrl);
            aiStatus.put("response", aiResponse);
        } catch (Exception e) {
            aiStatus.put("status", "DOWN");
            aiStatus.put("url", aiServiceUrl);
            aiStatus.put("error", "AI service unreachable: " + e.getMessage());
        }
        response.put("aiService", aiStatus);

        // Overall status: UP only if all dependencies are UP
        boolean allUp = "UP".equals(dbStatus.get("status"))
                && "UP".equals(aiStatus.get("status"));
        response.put("status", allUp ? "UP" : "DEGRADED");

        return ResponseEntity.ok(response);
    }
}
