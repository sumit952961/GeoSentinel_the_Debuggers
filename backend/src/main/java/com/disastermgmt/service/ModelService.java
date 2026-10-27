package com.disastermgmt.service;

import com.disastermgmt.entity.ModelVersion;
import com.disastermgmt.repository.ModelVersionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class ModelService {

    @Autowired
    private ModelVersionRepository modelVersionRepository;

    public List<ModelVersion> getAllModels() {
        return modelVersionRepository.findAll();
    }

    public Optional<ModelVersion> getModelById(Long id) {
        return modelVersionRepository.findById(id);
    }
}
