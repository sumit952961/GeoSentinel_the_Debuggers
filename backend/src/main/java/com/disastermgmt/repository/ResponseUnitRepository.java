package com.disastermgmt.repository;

import com.disastermgmt.entity.ResponseUnit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ResponseUnitRepository extends JpaRepository<ResponseUnit, Long> {
    List<ResponseUnit> findByStatus(String status);
}
