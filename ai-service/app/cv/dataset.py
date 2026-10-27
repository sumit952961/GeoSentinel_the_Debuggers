"""
============================================================
Disaster Management System — xBD Dataset & Data Loader
============================================================

Handles:
  1. Disaster/Event-Aware Deterministic Train/Val/Test Split
  2. Multi-channel (Pre+Post) or Single-channel (Post-only) PyTorch Dataset
  3. Image & Mask Preprocessing (Normalization, Resize/Tiling)
"""

import os
import csv
import cv2
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader
from collections import defaultdict


def create_disaster_aware_split(manifest_csv_path, seed=42):
    """
    Creates a deterministic disaster/event-aware train/val/test split
    ensuring zero image pair leakage between splits.
    
    Returns:
      train_pairs, val_pairs, test_pairs (lists of row dicts)
    """
    with open(manifest_csv_path, "r") as f:
        reader = list(csv.DictReader(f))
        
    disaster_groups = defaultdict(list)
    for row in reader:
        disaster_groups[row["disaster"]].append(row)
        
    rng = np.random.RandomState(seed)
    
    train_pairs = []
    val_pairs = []
    test_pairs = []
    
    # Split quotas per disaster event:
    # michael: 12 train, 3 val, 2 test (17)
    # matthew: 10 train, 2 val, 2 test (14)
    # harvey:   8 train, 2 val, 2 test (12)
    # wildfire: 7 train, 1 val, 2 test (10)
    # flooding: 11 train, 2 val, 2 test (15)
    # Total:   48 train (70.6%), 10 val (14.7%), 10 test (14.7%)
    
    split_ratios = {
        "hurricane-michael": (12, 3, 2),
        "hurricane-matthew": (10, 2, 2),
        "hurricane-harvey": (8, 2, 2),
        "santa-rosa-wildfire": (7, 1, 2),
        "midwest-flooding": (11, 2, 2)
    }
    
    for disaster, rows in sorted(disaster_groups.items()):
        indices = list(range(len(rows)))
        rng.shuffle(indices)
        
        n_train, n_val, n_test = split_ratios.get(disaster, (int(len(rows)*0.7), int(len(rows)*0.15), int(len(rows)*0.15)))
        
        tr_idx = indices[:n_train]
        va_idx = indices[n_train:n_train+n_val]
        te_idx = indices[n_train+n_val:n_train+n_val+n_test]
        
        train_pairs.extend([rows[i] for i in tr_idx])
        val_pairs.extend([rows[i] for i in va_idx])
        test_pairs.extend([rows[i] for i in te_idx])
        
    return train_pairs, val_pairs, test_pairs


class XBDDataset(Dataset):
    """
    PyTorch Dataset for xBD Satellite Damage Segmentation.
    
    Modes:
      mode='post_only' -> Returns (3, H, W) post-disaster image tensor
      mode='pre_post'  -> Returns (6, H, W) concatenated [pre, post] image tensor
    """
    def __init__(self, pairs_list, data_dir, mode="pre_post", target_size=(512, 512), is_training=False):
        self.pairs = pairs_list
        self.data_dir = data_dir
        self.mode = mode
        self.target_size = target_size
        self.is_training = is_training
        
        # ImageNet normalization parameters
        self.mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        self.std = np.array([0.229, 0.224, 0.225], dtype=np.float32)

    def __len__(self):
        return len(self.pairs)

    def __getitem__(self, idx):
        row = self.pairs[idx]
        pair_id = row["pair_id"]
        
        pre_p = os.path.join(self.data_dir, row["pre_image"])
        post_p = os.path.join(self.data_dir, row["post_image"])
        mask_p = os.path.join(self.data_dir, "masks", f"{pair_id}_target.png")
        
        # Read BGR images and convert to RGB
        pre_bgr = cv2.imread(pre_p)
        post_bgr = cv2.imread(post_p)
        mask = cv2.imread(mask_p, cv2.IMREAD_GRAYSCALE)
        
        if pre_bgr is None:
            pre_bgr = np.zeros((1024, 1024, 3), dtype=np.uint8)
        if post_bgr is None:
            post_bgr = np.zeros((1024, 1024, 3), dtype=np.uint8)
        if mask is None:
            mask = np.zeros((1024, 1024), dtype=np.uint8)
            
        pre_rgb = cv2.cvtColor(pre_bgr, cv2.COLOR_BGR2RGB)
        post_rgb = cv2.cvtColor(post_bgr, cv2.COLOR_BGR2RGB)
        
        # Resize to target input resolution (e.g. 512x512 for fast CPU inference)
        if self.target_size:
            pre_rgb = cv2.resize(pre_rgb, self.target_size, interpolation=cv2.INTER_LINEAR)
            post_rgb = cv2.resize(post_rgb, self.target_size, interpolation=cv2.INTER_LINEAR)
            mask = cv2.resize(mask, self.target_size, interpolation=cv2.INTER_NEAREST)
            
        # Optional Light Data Augmentations during Training (Horizontal & Vertical Flips)
        if self.is_training:
            if np.random.rand() > 0.5:
                pre_rgb = np.fliplr(pre_rgb).copy()
                post_rgb = np.fliplr(post_rgb).copy()
                mask = np.fliplr(mask).copy()
            if np.random.rand() > 0.5:
                pre_rgb = np.flipud(pre_rgb).copy()
                post_rgb = np.flipud(post_rgb).copy()
                mask = np.flipud(mask).copy()
                
        # Normalize to [0, 1] then standardize
        pre_norm = ((pre_rgb.astype(np.float32) / 255.0) - self.mean) / self.std
        post_norm = ((post_rgb.astype(np.float32) / 255.0) - self.mean) / self.std
        
        # HWC to CHW
        pre_tensor = np.transpose(pre_norm, (2, 0, 1))
        post_tensor = np.transpose(post_norm, (2, 0, 1))
        
        if self.mode == "pre_only":
            input_tensor = pre_tensor
        elif self.mode == "post_only":
            input_tensor = post_tensor
        else:
            # 6-channel stack: [pre_R, pre_G, pre_B, post_R, post_G, post_B]
            input_tensor = np.concatenate([pre_tensor, post_tensor], axis=0)
            
        return {
            "image": torch.tensor(input_tensor, dtype=torch.float32),
            "mask": torch.tensor(mask, dtype=torch.long),
            "pair_id": pair_id,
            "disaster": row["disaster"],
            "pre_rgb_raw": pre_rgb,
            "post_rgb_raw": post_rgb
        }
