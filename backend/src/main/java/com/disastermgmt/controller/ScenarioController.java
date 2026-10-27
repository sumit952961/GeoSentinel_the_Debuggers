package com.disastermgmt.controller;

import com.disastermgmt.dto.ScenarioDto;
import com.disastermgmt.service.ScenarioService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * SCENARIO CONTROLLER
 *
 * REST Endpoints:
 *   GET /api/scenarios     -> List all disaster scenarios
 *   GET /api/scenarios/{id}-> Get specific scenario details + counts
 */
@RestController
@RequestMapping("/api/scenarios")
public class ScenarioController {

    @Autowired
    private ScenarioService scenarioService;

    @GetMapping
    public ResponseEntity<List<ScenarioDto>> getAllScenarios() {
        return ResponseEntity.ok(scenarioService.getAllScenarios());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ScenarioDto> getScenarioById(@PathVariable Long id) {
        return scenarioService.getScenarioById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
