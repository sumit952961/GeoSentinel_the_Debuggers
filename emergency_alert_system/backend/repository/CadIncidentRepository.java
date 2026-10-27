package com.disastermgmt.repository;

import com.disastermgmt.entity.CadIncident;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CadIncidentRepository extends JpaRepository<CadIncident, Long> {
    List<CadIncident> findByScenarioIdOrderByCreatedAtDesc(Long scenarioId);
    List<CadIncident> findByStatusOrderByPriorityAsc(String status);
}
