package com.disastermgmt;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * ENTRY POINT of the Spring Boot backend.
 *
 * What this does:
 *   When you run this class, Spring Boot starts an embedded web server
 *   (Tomcat) on port 8080. It automatically discovers all our controllers,
 *   services, and repositories in the com.disastermgmt package and wires
 *   them together.
 *
 * How to run:
 *   ./mvnw spring-boot:run
 *
 * After starting, you can visit:
 *   http://localhost:8080/api/health
 */
@SpringBootApplication
public class DmsApplication {

    public static void main(String[] args) {
        SpringApplication.run(DmsApplication.class, args);
    }
}
