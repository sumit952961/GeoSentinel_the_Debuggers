package com.disastermgmt.service;

import com.disastermgmt.entity.DataSource;
import com.disastermgmt.repository.DataSourceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class DataSourceService {

    @Autowired
    private DataSourceRepository dataSourceRepository;

    public List<DataSource> getDataSourcesByScenarioId(Long scenarioId) {
        return dataSourceRepository.findByScenarioId(scenarioId);
    }
}
