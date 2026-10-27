package com.disastermgmt.repository;

import com.disastermgmt.entity.OperationalZone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OperationalZoneRepository extends JpaRepository<OperationalZone, Long> {
    List<OperationalZone> findByScenarioId(Long scenarioId);
    List<OperationalZone> findByScenarioIdOrderByCriticalityScoreDesc(Long scenarioId);
    Long countByScenarioId(Long scenarioId);
}
