package com.disastermgmt.controller;

import com.disastermgmt.entity.DataSource;
import com.disastermgmt.service.DataSourceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/data-sources")
public class DataSourceController {

    @Autowired
    private DataSourceService dataSourceService;

    @GetMapping
    public ResponseEntity<List<DataSource>> getDataSourcesByScenarioId(@RequestParam Long scenarioId) {
        return ResponseEntity.ok(dataSourceService.getDataSourcesByScenarioId(scenarioId));
    }
}
