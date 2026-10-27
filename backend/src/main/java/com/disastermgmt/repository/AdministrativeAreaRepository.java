package com.disastermgmt.repository;

import com.disastermgmt.entity.AdministrativeArea;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AdministrativeAreaRepository extends JpaRepository<AdministrativeArea, Long> {
    List<AdministrativeArea> findByLevel(String level);
    List<AdministrativeArea> findByState(String state);
}
