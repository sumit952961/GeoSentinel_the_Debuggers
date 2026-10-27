package com.disastermgmt.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.List;

/**
 * CORS CONFIGURATION
 *
 * What is CORS?
 *   When your React app (running on http://localhost:5173) tries to call
 *   the Spring Boot API (running on http://localhost:8080), the browser
 *   blocks it by default because they are on different "origins" (different ports).
 *   This is a security feature called CORS (Cross-Origin Resource Sharing).
 *
 * What this file does:
 *   It tells Spring Boot: "It's OK for requests from localhost:5173 to
 *   reach our API." Without this, your React app would get CORS errors.
 *
 * Where it fits:
 *   React (port 5173) --[HTTP request]--> Spring Boot (port 8080)
 *   This config says: "Allow that request."
 */
@Configuration
public class CorsConfig {

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();

        // Allow all origins (including localhost, LAN IPs, and Cloudflare tunnels)
        config.setAllowedOriginPatterns(List.of("*"));

        // Allow all standard HTTP methods
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));

        // Allow all headers
        config.setAllowedHeaders(List.of("*"));

        // Allow cookies/auth headers if needed later
        config.setAllowCredentials(true);

        // Apply this config to all API routes
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        return new CorsFilter(source);
    }
}
