package com.disastermgmt.repository;

import com.disastermgmt.entity.DamagePrediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface DamagePredictionRepository extends JpaRepository<DamagePrediction, Long> {
    List<DamagePrediction> findByScenarioId(Long scenarioId);
    List<DamagePrediction> findByScenarioIdAndDamageClass(Long scenarioId, String damageClass);
    long countByScenarioId(Long scenarioId);
    long countByScenarioIdAndDamageClass(Long scenarioId, String damageClass);
    
    @Transactional
    @Modifying
    @Query("DELETE FROM DamagePrediction d WHERE d.scenarioId = :scenarioId")
    void deleteByScenarioId(Long scenarioId);
}
