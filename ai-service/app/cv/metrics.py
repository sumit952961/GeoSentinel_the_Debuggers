"""
============================================================
Disaster Management System — Comprehensive Evaluation Metrics
============================================================

Calculates:
  - Per-class Precision, Recall, F1-Score, IoU
  - Mean IoU (mIoU) & Macro F1
  - 5x5 Confusion Matrix
  - Overall Pixel Accuracy
"""

import numpy as np
import torch
from sklearn.metrics import confusion_matrix


CLASS_NAMES = {
    0: "Background",
    1: "No Damage",
    2: "Minor Damage",
    3: "Major Damage",
    4: "Destroyed"
}


def compute_metrics(y_true, y_pred, num_classes=5):
    """
    y_true: 1D numpy array of ground truth labels (flattened)
    y_pred: 1D numpy array of predicted labels (flattened)
    """
    cm = confusion_matrix(y_true, y_pred, labels=list(range(num_classes)))
    
    total_pixels = np.sum(cm)
    correct_pixels = np.trace(cm)
    overall_accuracy = float(correct_pixels / total_pixels) if total_pixels > 0 else 0.0
    
    per_class = {}
    ious = []
    f1s = []
    
    for c in range(num_classes):
        tp = float(cm[c, c])
        fp = float(np.sum(cm[:, c]) - tp)
        fn = float(np.sum(cm[c, :]) - tp)
        
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
        iou = tp / (tp + fp + fn) if (tp + fp + fn) > 0 else 0.0
        
        per_class[c] = {
            "class_id": c,
            "class_name": CLASS_NAMES[c],
            "precision": float(precision),
            "recall": float(recall),
            "f1": float(f1),
            "iou": float(iou),
            "support": int(np.sum(cm[c, :]))
        }
        ious.append(iou)
        f1s.append(f1)
        
    mean_iou = float(np.mean(ious))
    macro_f1 = float(np.mean(f1s))
    
    # Building-only metrics (excluding background class 0)
    bldg_iou = float(np.mean(ious[1:]))
    bldg_f1 = float(np.mean(f1s[1:]))
    
    return {
        "overall_accuracy": overall_accuracy,
        "mean_iou": mean_iou,
        "macro_f1": macro_f1,
        "building_mean_iou": bldg_iou,
        "building_macro_f1": bldg_f1,
        "per_class": per_class,
        "confusion_matrix": cm.tolist()
    }
