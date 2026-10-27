"""
============================================================
Disaster Management System — Loss Functions (v2.0)
============================================================

Implements:
  1. Standard Multi-Class Cross-Entropy Loss
  2. Combined Loss (Cross-Entropy + Multi-class Dice Loss)
  3. Class-Weighted Cross-Entropy & Dice Loss (for severe background imbalance)
  4. Multi-class Focal Loss
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import segmentation_models_pytorch as smp


class FocalLoss(nn.Module):
    """
    Multi-class Focal Loss to address extreme foreground-background class imbalance:
      FL(p_t) = -alpha * (1 - p_t)^gamma * log(p_t)
    """
    def __init__(self, gamma=2.0, weight=None):
        super().__init__()
        self.gamma = gamma
        self.weight = weight

    def forward(self, logits, targets):
        # logits: (B, C, H, W), targets: (B, H, W)
        ce_loss = F.cross_entropy(logits, targets, weight=self.weight, reduction="none")
        pt = torch.exp(-ce_loss)
        focal_loss = ((1.0 - pt) ** self.gamma) * ce_loss
        return focal_loss.mean()


class CombinedLoss(nn.Module):
    def __init__(self, loss_type="ce_dice", num_classes=5, ce_weight=0.5, dice_weight=0.5, class_weights=None):
        super().__init__()
        self.loss_type = loss_type
        self.ce_weight = ce_weight
        self.dice_weight = dice_weight
        
        # Class weights tensor (if provided)
        if class_weights is not None:
            if not isinstance(class_weights, torch.Tensor):
                class_weights = torch.tensor(class_weights, dtype=torch.float32)
            self.register_buffer("weights", class_weights)
            self.ce_loss = nn.CrossEntropyLoss(weight=self.weights)
            self.focal_loss = FocalLoss(gamma=2.0, weight=self.weights)
        else:
            self.weights = None
            self.ce_loss = nn.CrossEntropyLoss()
            self.focal_loss = FocalLoss(gamma=2.0)

        self.dice_loss = smp.losses.DiceLoss(mode="multiclass", from_logits=True)

    def forward(self, logits, targets):
        if self.loss_type == "ce_only":
            return self.ce_loss(logits, targets)
        elif self.loss_type == "dice_only":
            return self.dice_loss(logits, targets)
        elif self.loss_type == "focal":
            return self.focal_loss(logits, targets)
        elif self.loss_type == "focal_dice":
            focal = self.focal_loss(logits, targets)
            dice = self.dice_loss(logits, targets)
            return self.ce_weight * focal + self.dice_weight * dice
        else:
            # Standard or Class-Weighted Combined CE + Dice Loss
            ce = self.ce_loss(logits, targets)
            dice = self.dice_loss(logits, targets)
            return self.ce_weight * ce + self.dice_weight * dice
