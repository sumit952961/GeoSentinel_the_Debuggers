package com.disastermgmt.repository;

import com.disastermgmt.entity.Shelter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ShelterRepository extends JpaRepository<Shelter, Long> {
    List<Shelter> findByScenarioId(Long scenarioId);
    List<Shelter> findByScenarioIdAndIsOperationalTrue(Long scenarioId);
    long countByScenarioId(Long scenarioId);
}
