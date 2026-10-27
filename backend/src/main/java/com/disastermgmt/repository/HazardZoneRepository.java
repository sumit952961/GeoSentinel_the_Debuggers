package com.disastermgmt.repository;

import com.disastermgmt.entity.HazardZone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HazardZoneRepository extends JpaRepository<HazardZone, Long> {
    List<HazardZone> findByScenarioId(Long scenarioId);
    Long countByScenarioId(Long scenarioId);
}
