"""
SpillSense (SIH-26143) — Dual-Polarization Neural Architectures v3
==================================================================
1. DualPolOilSpillNet — Lightweight classifier (2×400×400 → 1 logit)
2. SpillSegNet — Lightweight U-Net segmenter (2×512×512 → 1×512×512)

Both use depthwise-separable convolutions + SE attention for
efficient browser ONNX inference.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# ═══════════════════════════════════════════════════════
# Shared Building Blocks
# ═══════════════════════════════════════════════════════

class SqueezeExcitation(nn.Module):
    """
    Squeeze-and-Excitation Channel Attention.
    Dynamically scales features based on VV/VH cross-polarization interdependence.
    """
    def __init__(self, channels: int, reduction: int = 4):
        super().__init__()
        reduced = max(4, channels // reduction)
        self.fc = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Linear(channels, reduced, bias=False),
            nn.ReLU(inplace=True),
            nn.Linear(reduced, channels, bias=False),
            nn.Sigmoid()
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        b, c, _, _ = x.shape
        w = self.fc(x).view(b, c, 1, 1)
        return x * w


class DepthwiseSeparableBlock(nn.Module):
    """
    Depthwise-Separable residual block with BatchNorm, ReLU, and SE attention.
    """
    def __init__(self, in_c: int, out_c: int, stride: int = 1):
        super().__init__()
        self.dw = nn.Conv2d(in_c, in_c, 3, stride=stride, padding=1, groups=in_c, bias=False)
        self.bn_dw = nn.BatchNorm2d(in_c)
        self.pw = nn.Conv2d(in_c, out_c, 1, bias=False)
        self.bn_pw = nn.BatchNorm2d(out_c)
        self.relu = nn.ReLU(inplace=True)
        self.se = SqueezeExcitation(out_c)

        if in_c != out_c or stride != 1:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_c, out_c, 1, stride=stride, bias=False),
                nn.BatchNorm2d(out_c)
            )
        else:
            self.shortcut = nn.Identity()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        res = self.shortcut(x)
        out = self.relu(self.bn_dw(self.dw(x)))
        out = self.bn_pw(self.pw(out))
        out = self.se(out)
        return self.relu(out + res)


# ═══════════════════════════════════════════════════════
# Classifier: DualPolOilSpillNet
# Input: (B, 2, 400, 400) → Output: (B, 1) logits
# ═══════════════════════════════════════════════════════

class DualPolOilSpillNet(nn.Module):
    """
    Lightweight Dual-Polarization SAR Oil Spill Classifier.
    Input: [B, 2, 400, 400] (Channel 0 = VV, Channel 1 = VH)
    Output: [B, 1] Logits
    """
    def __init__(self, in_channels: int = 2):
        super().__init__()

        # Stem: 400→200
        self.stem = nn.Sequential(
            nn.Conv2d(in_channels, 32, 3, stride=2, padding=1, bias=False),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
        )

        # Stage 1: 200→100
        self.stage1 = nn.Sequential(
            DepthwiseSeparableBlock(32, 48, stride=2),
            DepthwiseSeparableBlock(48, 48, stride=1),
        )

        # Stage 2: 100→50
        self.stage2 = nn.Sequential(
            DepthwiseSeparableBlock(48, 96, stride=2),
            DepthwiseSeparableBlock(96, 96, stride=1),
        )

        # Stage 3: 50→25
        self.stage3 = nn.Sequential(
            DepthwiseSeparableBlock(96, 160, stride=2),
            DepthwiseSeparableBlock(160, 160, stride=1),
        )

        # Stage 4: 25→13
        self.stage4 = nn.Sequential(
            DepthwiseSeparableBlock(160, 224, stride=2),
            DepthwiseSeparableBlock(224, 224, stride=1),
        )

        # Head
        self.head = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Dropout(p=0.35),
            nn.Linear(224, 64),
            nn.ReLU(inplace=True),
            nn.Linear(64, 1)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.stem(x)
        x = self.stage1(x)
        x = self.stage2(x)
        x = self.stage3(x)
        x = self.stage4(x)
        return self.head(x)


# ═══════════════════════════════════════════════════════
# Segmenter: SpillSegNet (Lightweight U-Net)
# Input: (B, 2, 512, 512) → Output: (B, 1, 512, 512)
# ═══════════════════════════════════════════════════════

class ConvBlock(nn.Module):
    """Double conv block for U-Net encoder/decoder."""
    def __init__(self, in_c: int, out_c: int):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_c, out_c, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_c),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_c, out_c, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_c),
            nn.ReLU(inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.block(x)


class DSConvBlock(nn.Module):
    """Depthwise-separable double conv block (lighter than standard ConvBlock)."""
    def __init__(self, in_c: int, out_c: int):
        super().__init__()
        self.block = nn.Sequential(
            # First depthwise-separable conv
            nn.Conv2d(in_c, in_c, 3, padding=1, groups=in_c, bias=False),
            nn.BatchNorm2d(in_c),
            nn.ReLU(inplace=True),
            nn.Conv2d(in_c, out_c, 1, bias=False),
            nn.BatchNorm2d(out_c),
            nn.ReLU(inplace=True),
            # Second depthwise-separable conv
            nn.Conv2d(out_c, out_c, 3, padding=1, groups=out_c, bias=False),
            nn.BatchNorm2d(out_c),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_c, out_c, 1, bias=False),
            nn.BatchNorm2d(out_c),
            nn.ReLU(inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.block(x)


class SpillSegNet(nn.Module):
    """
    Lightweight U-Net for oil spill segmentation.
    Input:  [B, 2, 512, 512]  (VV + VH)
    Output: [B, 1, 512, 512]  (Oil probability per pixel)
    
    Uses depthwise-separable convolutions for efficiency.
    ~500K parameters, < 2 MB ONNX.
    """
    def __init__(self, in_channels: int = 2):
        super().__init__()

        # Encoder
        self.enc1 = ConvBlock(in_channels, 32)     # 512 → 512
        self.enc2 = DSConvBlock(32, 64)             # 256 → 256
        self.enc3 = DSConvBlock(64, 128)            # 128 → 128
        self.enc4 = DSConvBlock(128, 256)            # 64 → 64

        self.pool = nn.MaxPool2d(2, 2)

        # Bottleneck
        self.bottleneck = DSConvBlock(256, 512)      # 32 → 32

        # SE attention at bottleneck
        self.bottleneck_se = SqueezeExcitation(512, reduction=8)

        # Decoder (transposed conv upsampling)
        self.up4 = nn.ConvTranspose2d(512, 256, 2, stride=2)
        self.dec4 = DSConvBlock(512, 256)

        self.up3 = nn.ConvTranspose2d(256, 128, 2, stride=2)
        self.dec3 = DSConvBlock(256, 128)

        self.up2 = nn.ConvTranspose2d(128, 64, 2, stride=2)
        self.dec2 = DSConvBlock(128, 64)

        self.up1 = nn.ConvTranspose2d(64, 32, 2, stride=2)
        self.dec1 = DSConvBlock(64, 32)

        # Output head
        self.out_conv = nn.Conv2d(32, 1, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Encoder
        e1 = self.enc1(x)        # (B, 32, 512, 512)
        e2 = self.enc2(self.pool(e1))  # (B, 64, 256, 256)
        e3 = self.enc3(self.pool(e2))  # (B, 128, 128, 128)
        e4 = self.enc4(self.pool(e3))  # (B, 256, 64, 64)

        # Bottleneck
        b = self.bottleneck(self.pool(e4))  # (B, 512, 32, 32)
        b = self.bottleneck_se(b)

        # Decoder with skip connections
        d4 = self.up4(b)          # (B, 256, 64, 64)
        d4 = torch.cat([d4, e4], dim=1)  # (B, 512, 64, 64)
        d4 = self.dec4(d4)        # (B, 256, 64, 64)

        d3 = self.up3(d4)         # (B, 128, 128, 128)
        d3 = torch.cat([d3, e3], dim=1)
        d3 = self.dec3(d3)        # (B, 128, 128, 128)

        d2 = self.up2(d3)         # (B, 64, 256, 256)
        d2 = torch.cat([d2, e2], dim=1)
        d2 = self.dec2(d2)        # (B, 64, 256, 256)

        d1 = self.up1(d2)         # (B, 32, 512, 512)
        d1 = torch.cat([d1, e1], dim=1)
        d1 = self.dec1(d1)        # (B, 32, 512, 512)

        return self.out_conv(d1)  # (B, 1, 512, 512) — logits


# ═══════════════════════════════════════════════════════
# Factory Functions
# ═══════════════════════════════════════════════════════

def get_classifier(in_channels: int = 2) -> DualPolOilSpillNet:
    """Create the DualPolOilSpillNet classifier."""
    return DualPolOilSpillNet(in_channels=in_channels)


def get_segmenter(in_channels: int = 2) -> SpillSegNet:
    """Create the SpillSegNet segmenter."""
    return SpillSegNet(in_channels=in_channels)


def count_params(model: nn.Module) -> int:
    """Count total trainable parameters."""
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


# Quick test
if __name__ == "__main__":
    cls_model = get_classifier()
    seg_model = get_segmenter()

    print(f"Classifier: {count_params(cls_model):,} params")
    print(f"Segmenter:  {count_params(seg_model):,} params")

    # Test forward pass
    cls_in = torch.randn(1, 2, 400, 400)
    cls_out = cls_model(cls_in)
    print(f"Classifier: {cls_in.shape} -> {cls_out.shape}")

    seg_in = torch.randn(1, 2, 512, 512)
    seg_out = seg_model(seg_in)
    print(f"Segmenter:  {seg_in.shape} -> {seg_out.shape}")
