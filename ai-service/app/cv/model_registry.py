"""
============================================================
DRAS Computer Vision Model Registry
============================================================
Explicit mapping from model version to:
  - Stage 1 Checkpoint & Architecture
  - Stage 2 Checkpoint & Architecture
  - Dataset Version
  - Preprocessing Version & Normalization Parameters
"""

import os

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

MODEL_REGISTRY = {
    "dras_india_v3": {
        "model_version": "dras-india-v3",
        "pipeline_type": "two_stage",
        "description": "DRAS India Model V3 Two-Stage Decoupled Pipeline (U-Net++ & Siamese ResNet50)",
        "stage1": {
            "checkpoint_path": os.path.join(ROOT_DIR, "models", "india_v3", "stage1", "best_model.pt"),
            "relative_path": "models/india_v3/stage1/best_model.pt",
            "architecture": "U-Net++",
            "encoder": "timm-efficientnet-b2",
            "in_channels": 6,
            "classes": 1
        },
        "stage2": {
            "checkpoint_path": os.path.join(ROOT_DIR, "models", "india_v3", "stage2", "best_model.pt"),
            "relative_path": "models/india_v3/stage2/best_model.pt",
            "architecture": "SiameseResNet",
            "backbone": "resnet50",
            "num_classes": 4
        },
        "dataset_version": "india-disaster-v3.1",
        "input_modalities": ["pre_disaster_optical", "post_disaster_optical"],
        "has_sar_rasters": False,
        "preprocessing_version": "bitemporal_512_norm_v3",
        "target_size": (512, 512),
        "mean": [0.485, 0.456, 0.406],
        "std": [0.229, 0.224, 0.225]
    },
    "dras_v2_joint": {
        "model_version": "dras-v2-joint",
        "pipeline_type": "joint_segmentation",
        "description": "DRAS v2.0 Joint 5-Class U-Net ResNet34",
        "stage1": {
            "checkpoint_path": os.path.join(ROOT_DIR, "models", "india_v2", "best_model.pth"),
            "relative_path": "models/india_v2/best_model.pth",
            "architecture": "U-Net",
            "encoder": "resnet34",
            "in_channels": 6,
            "classes": 5
        },
        "stage2": None,
        "dataset_version": "india-v2",
        "preprocessing_version": "imagenet_norm_512",
        "target_size": (512, 512),
        "mean": [0.485, 0.456, 0.406],
        "std": [0.229, 0.224, 0.225]
    },
    "xbd_baseline_pre_post": {
        "model_version": "xbd-baseline-pre-post",
        "pipeline_type": "joint_segmentation",
        "description": "Global xBD Pretrained Baseline U-Net ResNet34",
        "stage1": {
            "checkpoint_path": os.path.join(ROOT_DIR, "ai-service", "models", "unet_resnet34_pre_post.pth"),
            "relative_path": "ai-service/models/unet_resnet34_pre_post.pth",
            "architecture": "U-Net",
            "encoder": "resnet34",
            "in_channels": 6,
            "classes": 5
        },
        "stage2": None,
        "dataset_version": "xbd-subset-v2",
        "preprocessing_version": "imagenet_norm_512",
        "target_size": (512, 512),
        "mean": [0.485, 0.456, 0.406],
        "std": [0.229, 0.224, 0.225]
    },
    "xbd_baseline_post_only": {
        "model_version": "xbd-baseline-post-only",
        "pipeline_type": "joint_segmentation",
        "description": "Global xBD Post-Disaster Baseline U-Net ResNet34",
        "stage1": {
            "checkpoint_path": os.path.join(ROOT_DIR, "ai-service", "models", "unet_resnet34_post_only.pth"),
            "relative_path": "ai-service/models/unet_resnet34_post_only.pth",
            "architecture": "U-Net",
            "encoder": "resnet34",
            "in_channels": 3,
            "classes": 5
        },
        "stage2": None,
        "dataset_version": "xbd-subset-v2",
        "preprocessing_version": "imagenet_norm_512",
        "target_size": (512, 512),
        "mean": [0.485, 0.456, 0.406],
        "std": [0.229, 0.224, 0.225]
    }
}


def get_model_entry(version_or_mode="dras_india_v3"):
    """Resolves registry entry from alias or version name."""
    if version_or_mode in MODEL_REGISTRY:
        return MODEL_REGISTRY[version_or_mode]
    # Check aliases
    alias_map = {
        "pre_post": "xbd_baseline_pre_post",
        "post_only": "xbd_baseline_post_only",
        "dras-india-v3": "dras_india_v3",
        "india_v3": "dras_india_v3",
        "v3": "dras_india_v3",
        "india_v2": "dras_v2_joint",
        "india_tuned_v2": "dras_v2_joint"
    }
    target_key = alias_map.get(version_or_mode, "dras_india_v3")
    return MODEL_REGISTRY[target_key]
