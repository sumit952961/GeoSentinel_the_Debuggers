"""
============================================================
Disaster Management System — U-Net ResNet34 Damage Model
============================================================

Model Architecture:
  U-Net with ResNet34 Encoder (ImageNet Pretrained)
  Classes: 5 (0=Background, 1=No Damage, 2=Minor, 3=Major, 4=Destroyed)

Configurations:
  - Model A (Post-Only): in_channels = 3
  - Model B (Pre + Post): in_channels = 6
"""

import torch
import torch.nn as nn
import segmentation_models_pytorch as smp


class BuildingDamageUNet(nn.Module):
    def __init__(self, mode="pre_post", num_classes=5, encoder_name="resnet34", encoder_weights="imagenet"):
        super().__init__()
        self.mode = mode
        self.num_classes = num_classes
        self.encoder_name = encoder_name
        
        in_channels = 6 if mode == "pre_post" else 3
        
        self.model = smp.Unet(
            encoder_name=encoder_name,
            encoder_weights=encoder_weights,
            in_channels=in_channels,
            classes=num_classes,
            activation=None  # returns raw logits for Cross-Entropy / Dice Loss
        )

    def forward(self, x):
        return self.model(x)

    def count_parameters(self):
        total = sum(p.numel() for p in self.parameters())
        trainable = sum(p.numel() for p in self.parameters() if p.requires_grad)
        return total, trainable

    def predict_mask(self, x):
        self.eval()
        with torch.no_grad():
            logits = self.forward(x)
            probabilities = torch.softmax(logits, dim=1)
            pred_classes = torch.argmax(probabilities, dim=1)
        return pred_classes, probabilities
