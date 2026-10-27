package com.disastermgmt.repository;

import com.disastermgmt.entity.DisasterScenario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DisasterScenarioRepository extends JpaRepository<DisasterScenario, Long> {
    List<DisasterScenario> findByDisasterType(String disasterType);
    List<DisasterScenario> findByIsDemoTrue();
}
