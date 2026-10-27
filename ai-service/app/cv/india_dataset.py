"""
============================================================
India-Specific Disaster Dataset — PyTorch Dataset Class
============================================================

Loads India-specific pre/post disaster imagery tiles with
building damage labels from multiple Indian disaster events.

Supports:
  - Chamoli 2021 (EIDC verified damage labels)
  - Wayanad 2024 (OSM community damage tags)
  - Dharali 2025 (weak inference labels — cross-event test only)

Label Sources:
  - 'verified_ground_truth': EIDC shapefile damage attributes
  - 'osm_community_mapping': OSM disaster:damage tags
  - 'weak_inference': Overlay with disaster extent polygon
  - 'manual_annotation': Researcher-annotated labels

Classes:
  0 = Background
  1 = No Damage
  2 = Minor Damage
  3 = Major Damage
  4 = Destroyed
"""

import os
import json
import csv
import cv2
import numpy as np
import torch
from torch.utils.data import Dataset
from collections import defaultdict


def load_india_manifest(manifest_path):
    """
    Loads the India-specific dataset manifest CSV.
    
    Expected columns:
        event_id, tile_id, pre_image, post_image, mask_file,
        damage_class_counts, label_source, confidence,
        state, district, disaster_type
    """
    with open(manifest_path, "r") as f:
        return list(csv.DictReader(f))


def create_india_split(manifest_path, train_events, test_events, val_fraction=0.15, seed=42):
    """
    Creates train/val/test split for India dataset.
    
    Strategy:
      - train_events: events used for training (e.g., ['chamoli_2021', 'wayanad_2024'])
      - test_events: events used ONLY for testing (e.g., ['dharali_2025'])
      - val_fraction: fraction of train_events tiles held out for validation
    
    This enables cross-event generalization experiments:
      Train on Chamoli + Wayanad → Test on Dharali
    """
    rows = load_india_manifest(manifest_path)
    rng = np.random.RandomState(seed)
    
    train_pool = [r for r in rows if r["event_id"] in train_events]
    test_pairs = [r for r in rows if r["event_id"] in test_events]
    
    # Shuffle and split train pool into train + validation
    indices = list(range(len(train_pool)))
    rng.shuffle(indices)
    
    n_val = max(1, int(len(train_pool) * val_fraction))
    val_indices = indices[:n_val]
    train_indices = indices[n_val:]
    
    train_pairs = [train_pool[i] for i in train_indices]
    val_pairs = [train_pool[i] for i in val_indices]
    
    print(f"[IndiaDataset] Split Created:")
    print(f"  Train: {len(train_pairs)} tiles from {train_events}")
    print(f"  Val:   {len(val_pairs)} tiles (held-out from train events)")
    print(f"  Test:  {len(test_pairs)} tiles from {test_events}")
    
    return train_pairs, val_pairs, test_pairs


class IndiaDisasterDataset(Dataset):
    """
    PyTorch Dataset for India-specific disaster damage segmentation.
    
    Compatible with the existing xBD pipeline architecture:
      mode='post_only' -> (3, H, W) post-disaster image tensor
      mode='pre_post'  -> (6, H, W) concatenated [pre, post] tensor
    
    Each sample returns:
      {
        'image': Tensor,
        'mask': Tensor (long),
        'tile_id': str,
        'event_id': str,
        'label_source': str,
        'confidence': float,
        'pre_rgb_raw': ndarray,
        'post_rgb_raw': ndarray
      }
    """
    
    def __init__(self, pairs_list, data_dir, mode="pre_post",
                 target_size=(512, 512), is_training=False,
                 min_confidence=0.0):
        """
        Args:
            pairs_list: List of row dicts from manifest CSV
            data_dir: Root data directory (data/india/)
            mode: 'pre_post' (6ch) or 'post_only' (3ch)
            target_size: (H, W) resize target
            is_training: Enable data augmentation
            min_confidence: Filter out tiles with confidence below this
        """
        self.data_dir = data_dir
        self.mode = mode
        self.target_size = target_size
        self.is_training = is_training
        
        # Filter by minimum confidence
        self.pairs = [p for p in pairs_list 
                      if float(p.get("confidence", 1.0)) >= min_confidence]
        
        # ImageNet normalization (same as xBD pipeline)
        self.mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        self.std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    
    def __len__(self):
        return len(self.pairs)
    
    def __getitem__(self, idx):
        row = self.pairs[idx]
        tile_id = row["tile_id"]
        event_id = row["event_id"]
        label_source = row.get("label_source", "unknown")
        confidence = float(row.get("confidence", 0.5))
        
        # Construct paths
        event_dir = os.path.join(self.data_dir, event_id)
        pre_path = os.path.join(event_dir, row["pre_image"])
        post_path = os.path.join(event_dir, row["post_image"])
        mask_path = os.path.join(event_dir, row["mask_file"])
        
        # Read images (BGR -> RGB)
        pre_bgr = cv2.imread(pre_path)
        post_bgr = cv2.imread(post_path)
        mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        
        # Fallback for missing images
        h, w = self.target_size
        if pre_bgr is None:
            pre_bgr = np.zeros((h, w, 3), dtype=np.uint8)
        if post_bgr is None:
            post_bgr = np.zeros((h, w, 3), dtype=np.uint8)
        if mask is None:
            mask = np.zeros((h, w), dtype=np.uint8)
        
        pre_rgb = cv2.cvtColor(pre_bgr, cv2.COLOR_BGR2RGB)
        post_rgb = cv2.cvtColor(post_bgr, cv2.COLOR_BGR2RGB)
        
        # Resize
        if self.target_size:
            pre_rgb = cv2.resize(pre_rgb, self.target_size, interpolation=cv2.INTER_LINEAR)
            post_rgb = cv2.resize(post_rgb, self.target_size, interpolation=cv2.INTER_LINEAR)
            mask = cv2.resize(mask, self.target_size, interpolation=cv2.INTER_NEAREST)
        
        # Data augmentation (training only)
        if self.is_training:
            if np.random.rand() > 0.5:
                pre_rgb = np.fliplr(pre_rgb).copy()
                post_rgb = np.fliplr(post_rgb).copy()
                mask = np.fliplr(mask).copy()
            if np.random.rand() > 0.5:
                pre_rgb = np.flipud(pre_rgb).copy()
                post_rgb = np.flipud(post_rgb).copy()
                mask = np.flipud(mask).copy()
            # Random 90° rotation
            if np.random.rand() > 0.5:
                k = np.random.choice([1, 2, 3])
                pre_rgb = np.rot90(pre_rgb, k).copy()
                post_rgb = np.rot90(post_rgb, k).copy()
                mask = np.rot90(mask, k).copy()
        
        # Normalize (same as xBD pipeline for transfer learning compatibility)
        pre_norm = ((pre_rgb.astype(np.float32) / 255.0) - self.mean) / self.std
        post_norm = ((post_rgb.astype(np.float32) / 255.0) - self.mean) / self.std
        
        # HWC -> CHW
        pre_tensor = np.transpose(pre_norm, (2, 0, 1))
        post_tensor = np.transpose(post_norm, (2, 0, 1))
        
        if self.mode == "post_only":
            input_tensor = post_tensor
        else:
            input_tensor = np.concatenate([pre_tensor, post_tensor], axis=0)
        
        return {
            "image": torch.tensor(input_tensor, dtype=torch.float32),
            "mask": torch.tensor(mask, dtype=torch.long),
            "tile_id": tile_id,
            "event_id": event_id,
            "label_source": label_source,
            "confidence": confidence,
            "pre_rgb_raw": pre_rgb,
            "post_rgb_raw": post_rgb
        }
