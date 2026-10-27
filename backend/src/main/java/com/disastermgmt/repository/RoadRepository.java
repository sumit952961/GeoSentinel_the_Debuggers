package com.disastermgmt.repository;

import com.disastermgmt.entity.Road;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoadRepository extends JpaRepository<Road, Long> {
    List<Road> findByScenarioId(Long scenarioId);
    List<Road> findByScenarioIdAndIsBlockedTrue(Long scenarioId);
    long countByScenarioId(Long scenarioId);
}
