package com.disastermgmt.service;

import com.disastermgmt.dto.ScenarioDto;
import com.disastermgmt.entity.DisasterScenario;
import com.disastermgmt.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ScenarioService {

    @Autowired
    private DisasterScenarioRepository scenarioRepository;

    @Autowired
    private BuildingRepository buildingRepository;

    @Autowired
    private HospitalRepository hospitalRepository;

    @Autowired
    private ShelterRepository shelterRepository;

    @Autowired
    private RoadRepository roadRepository;

    @Autowired
    private HazardZoneRepository hazardZoneRepository;

    public List<ScenarioDto> getAllScenarios() {
        return scenarioRepository.findAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public Optional<ScenarioDto> getScenarioById(Long id) {
        return scenarioRepository.findById(id).map(this::toDto);
    }

    private ScenarioDto toDto(DisasterScenario s) {
        ScenarioDto dto = new ScenarioDto();
        dto.setId(s.getId());
        dto.setName(s.getName());
        dto.setDescription(s.getDescription());
        dto.setDisasterType(s.getDisasterType());
        dto.setEventDate(s.getEventDate());
        dto.setLocationName(s.getLocationName());
        dto.setCenterPoint(s.getCenterPoint());
        dto.setBoundary(s.getBoundary());
        dto.setPreImagePath(s.getPreImagePath());
        dto.setPostImagePath(s.getPostImagePath());
        dto.setDataSource(s.getDataSource());
        dto.setIsDemo(s.getIsDemo());
        dto.setState(s.getState());
        dto.setDistrict(s.getDistrict());
        dto.setCountry(s.getCountry());
        dto.setDisasterSubtype(s.getDisasterSubtype());
        dto.setDataProvenance(s.getDataProvenance());

        dto.setBuildingCount(buildingRepository.countByScenarioId(s.getId()));
        dto.setHospitalCount(hospitalRepository.countByScenarioId(s.getId()));
        dto.setShelterCount(shelterRepository.countByScenarioId(s.getId()));
        dto.setRoadCount(roadRepository.countByScenarioId(s.getId()));
        dto.setHazardZoneCount(hazardZoneRepository.countByScenarioId(s.getId()));

        return dto;
    }
}
