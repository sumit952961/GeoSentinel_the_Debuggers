package com.disastermgmt.repository;

import com.disastermgmt.entity.Hospital;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HospitalRepository extends JpaRepository<Hospital, Long> {
    List<Hospital> findByScenarioId(Long scenarioId);
    List<Hospital> findByScenarioIdAndIsOperationalTrue(Long scenarioId);
    long countByScenarioId(Long scenarioId);
}
