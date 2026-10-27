package com.disastermgmt.repository;

import com.disastermgmt.entity.CapAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CapAlertRepository extends JpaRepository<CapAlert, Long> {
    List<CapAlert> findByScenarioIdOrderByCreatedAtDesc(Long scenarioId);
    List<CapAlert> findByStatusOrderByCreatedAtDesc(String status);
}
