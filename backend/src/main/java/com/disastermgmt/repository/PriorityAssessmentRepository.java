package com.disastermgmt.repository;

import com.disastermgmt.entity.PriorityAssessment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface PriorityAssessmentRepository extends JpaRepository<PriorityAssessment, Long> {
    List<PriorityAssessment> findByScenarioIdOrderByPriorityScoreDesc(Long scenarioId);
    List<PriorityAssessment> findByScenarioIdAndPriorityLevelOrderByPriorityScoreDesc(Long scenarioId, String priorityLevel);
    long countByScenarioId(Long scenarioId);
    long countByScenarioIdAndPriorityLevel(Long scenarioId, String priorityLevel);

    @Transactional
    @Modifying
    @Query("DELETE FROM PriorityAssessment p WHERE p.scenarioId = :scenarioId")
    void deleteByScenarioId(Long scenarioId);
}
