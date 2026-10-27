package com.disastermgmt.repository;

import com.disastermgmt.entity.EvacuationRoute;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EvacuationRouteRepository extends JpaRepository<EvacuationRoute, Long> {
    List<EvacuationRoute> findByScenarioIdOrderByCreatedAtDesc(Long scenarioId);
    List<EvacuationRoute> findByPriorityAssessmentId(Long priorityAssessmentId);
}
