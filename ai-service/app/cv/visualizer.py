"""
============================================================
Disaster Management System — Visual Evaluation & Diagnostics
============================================================

Generates 5-panel side-by-side diagnostic figures:
  1. Pre-Disaster Image
  2. Post-Disaster Image
  3. Ground-Truth Mask (Colored)
  4. Predicted Mask (Colored)
  5. Damage Overlay Comparison
"""

import os
import cv2
import numpy as np


COLOR_PALETTE = {
    0: (0, 0, 0),         # Background: Black
    1: (45, 106, 79),     # No Damage: Forest Green
    2: (244, 162, 97),    # Minor Damage: Warm Amber
    3: (231, 111, 81),    # Major Damage: Bright Orange
    4: (155, 34, 38)      # Destroyed: Crimson Red
}


def mask_to_rgb(mask_2d):
    h, w = mask_2d.shape
    rgb = np.zeros((h, w, 3), dtype=np.uint8)
    for cid, col in COLOR_PALETTE.items():
        rgb[mask_2d == cid] = col
    return rgb


def generate_5panel_evaluation(pre_rgb, post_rgb, gt_mask, pred_mask, pair_id, output_path, metrics_info=""):
    """
    Creates a high-resolution 5-panel visual diagnostic image.
    """
    target_dim = (400, 400)
    
    # 1. Pre Image
    pre_bgr = cv2.cvtColor(pre_rgb, cv2.COLOR_RGB2BGR)
    pre_res = cv2.resize(pre_bgr, target_dim)
    
    # 2. Post Image
    post_bgr = cv2.cvtColor(post_rgb, cv2.COLOR_RGB2BGR)
    post_res = cv2.resize(post_bgr, target_dim)
    
    # 3. Ground Truth Mask
    gt_rgb = mask_to_rgb(gt_mask)
    gt_bgr = cv2.cvtColor(gt_rgb, cv2.COLOR_RGB2BGR)
    gt_res = cv2.resize(gt_bgr, target_dim, interpolation=cv2.INTER_NEAREST)
    
    # 4. Predicted Mask
    pred_rgb = mask_to_rgb(pred_mask)
    pred_bgr = cv2.cvtColor(pred_rgb, cv2.COLOR_RGB2BGR)
    pred_res = cv2.resize(pred_bgr, target_dim, interpolation=cv2.INTER_NEAREST)
    
    # 5. Overlay on Post Image
    alpha = 0.50
    blended = cv2.addWeighted(post_bgr, 1 - alpha, pred_bgr, alpha, 0)
    overlay = post_bgr.copy()
    overlay[pred_mask > 0] = blended[pred_mask > 0]
    
    # Draw GT contours in thin white and Pred contours in class colors
    for cid in range(1, 5):
        bin_pred = (pred_mask == cid).astype(np.uint8)
        cnts_pred, _ = cv2.findContours(bin_pred, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        bgr_col = (COLOR_PALETTE[cid][2], COLOR_PALETTE[cid][1], COLOR_PALETTE[cid][0])
        cv2.drawContours(overlay, cnts_pred, -1, bgr_col, 2)
        
    overlay_res = cv2.resize(overlay, target_dim)
    
    # Helper to add titles
    def add_title(img, title):
        banner = np.zeros((32, img.shape[1], 3), dtype=np.uint8)
        cv2.putText(banner, title, (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (255, 255, 255), 1, cv2.LINE_AA)
        return np.vstack([banner, img])
        
    p1 = add_title(pre_res, "1. Pre-Disaster (RGB)")
    p2 = add_title(post_res, "2. Post-Disaster (RGB)")
    p3 = add_title(gt_res, "3. Ground Truth Mask")
    p4 = add_title(pred_res, "4. Model Prediction")
    p5 = add_title(overlay_res, "5. Prediction Overlay")
    
    row1 = np.hstack([p1, p2, p3])
    row2 = np.hstack([p4, p5, np.zeros_like(p5)])  # 2x3 grid
    
    # Bottom info banner
    info_banner = np.zeros((40, row1.shape[1], 3), dtype=np.uint8)
    banner_text = f"Sample: {pair_id} | Green: No-Damage | Amber: Minor | Orange: Major | Red: Destroyed | {metrics_info}"
    cv2.putText(info_banner, banner_text, (12, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 240, 200), 1, cv2.LINE_AA)
    
    grid = np.vstack([row1, row2, info_banner])
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    cv2.imwrite(output_path, grid)
    return output_path
