package com.disastermgmt.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * WEBCLIENT CONFIGURATION
 *
 * What is WebClient?
 *   WebClient is Spring's HTTP client — it lets our Java backend
 *   make HTTP calls to other services. We use it to call the
 *   Python FastAPI AI service.
 *
 * How it works:
 *   React → Spring Boot → [WebClient calls] → FastAPI (Python)
 *
 *   When the React frontend asks Spring Boot to "analyse an image",
 *   Spring Boot uses WebClient to send that image to the Python
 *   FastAPI service and get the AI predictions back.
 *
 * The @Value annotation reads the URL from application.yml:
 *   ai-service.url = http://localhost:8000
 */
@Configuration
public class WebClientConfig {

    @Value("${ai-service.url:http://localhost:8000}")
    private String aiServiceUrl;

    @Bean
    public WebClient aiServiceWebClient() {
        return WebClient.builder()
                .baseUrl(aiServiceUrl)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }
}
