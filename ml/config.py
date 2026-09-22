"""
SpillSense (SIH-26143) — ML Pipeline Configuration v3
======================================================
Centralized configuration for dual-polarization Sentinel-1 SAR pipeline
using the official Zenodo ground-truth oil spill dataset.

Dataset: Trujillo-Acatitla et al. (2024) — Zenodo 10.5281/zenodo.8346860
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Tuple, List, Optional, Dict
import os
import torch


@dataclass
class ZenodoDataPaths:
    """Paths to all Zenodo dataset components (Parts I, II, III)."""
    # ----- Part I: Oil Spill (Train/Val) -----
    oil_images_dir: Path = Path(r"D:\01_Train_Val_Oil_Spill_images\Oil")
    oil_masks_dir: Path = Path(r"D:\01_Train_Val_Oil_Spill_mask\Mask_oil")

    # Fallback paths
    _alt_oil_masks: List[Path] = field(default_factory=lambda: [
        Path(r"D:\01_Train_Val_Oil_Spill_mask\Mask_oil"),
        Path(r"D:\01_Train_Val_Oil_Spill_mask\Oil"),
        Path(r"D:\01_Train_Val_Oil_Spill_mask"),
    ])

    def find_oil_masks(self) -> Path:
        """Auto-discover oil masks directory."""
        for p in self._alt_oil_masks:
            if p.exists() and any(p.glob("*.tif")):
                return p
        return self.oil_masks_dir

    # ----- Part II: No-Oil & Look-alike (Train/Val) -----
    nooil_images_dir: Path = Path(r"D:\01_Train_Val_No_Oil_Images")
    nooil_masks_dir: Path = Path(r"D:\01_Train_Val_No_Oil_mask")
    lookalike_images_dir: Path = Path(r"D:\01_Train_Val_Lookalike_images")
    lookalike_masks_dir: Path = Path(r"D:\01_Train_Val_Lookalike_mask")

    # ----- Part III: Test Set (completely held out) -----
    test_oil_images_dir: Path = Path(r"D:\Test\Images\Oil")
    test_oil_masks_dir: Path = Path(r"D:\Test\Mask\Oil")
    test_nooil_images_dir: Path = Path(r"D:\Test\Images\No_oil")
    test_nooil_masks_dir: Path = Path(r"D:\Test\Mask\No_oil")
    test_lookalike_images_dir: Path = Path(r"D:\Test\Images\Lookalike")
    test_lookalike_masks_dir: Path = Path(r"D:\Test\Mask\Lookalike")

    # Fallback alternative paths (in case of different extraction structure)
    _alt_oil_images: Path = Path(r"D:\SIH 26143-Oil_Spill\01_Train_Val_Oil_Spill_images\Oil")

    def find_oil_images(self) -> Path:
        """Auto-discover oil images directory."""
        for p in [self.oil_images_dir, self._alt_oil_images]:
            if p.exists() and any(p.glob("*.tif")):
                return p
        return self.oil_images_dir

    def status(self) -> Dict[str, bool]:
        """Report availability of each dataset component."""
        return {
            "oil_images": self.find_oil_images().exists(),
            "oil_masks": self.find_oil_masks().exists(),
            "nooil_images": self.nooil_images_dir.exists(),
            "nooil_masks": self.nooil_masks_dir.exists(),
            "lookalike_images": self.lookalike_images_dir.exists(),
            "lookalike_masks": self.lookalike_masks_dir.exists(),
            "test_oil_images": self.test_oil_images_dir.exists(),
            "test_oil_masks": self.test_oil_masks_dir.exists(),
            "test_nooil_images": self.test_nooil_images_dir.exists(),
            "test_nooil_masks": self.test_nooil_masks_dir.exists(),
            "test_lookalike_images": self.test_lookalike_images_dir.exists(),
            "test_lookalike_masks": self.test_lookalike_masks_dir.exists(),
        }

    def print_status(self):
        """Print a human-readable status of dataset availability."""
        s = self.status()
        print("=" * 60)
        print("Zenodo Dataset Availability")
        print("=" * 60)
        for k, v in s.items():
            icon = "[OK]" if v else "[--]"
            print(f"  {icon}  {k}")
        available = sum(1 for v in s.values() if v)
        print(f"\n  {available}/{len(s)} components available")
        print("=" * 60)


@dataclass
class SpillSenseConfig:
    # ---------------------------------------------------------
    # Directories & Paths
    # ---------------------------------------------------------
    project_root: Path = Path(__file__).resolve().parent.parent
    data: ZenodoDataPaths = field(default_factory=ZenodoDataPaths)

    cache_dir: Path = field(default_factory=lambda: Path(__file__).resolve().parent / "cache_patches")
    checkpoint_dir: Path = field(default_factory=lambda: Path(__file__).resolve().parent / "checkpoints")

    # ONNX export paths
    output_classifier_onnx: Path = field(
        default_factory=lambda: Path(__file__).resolve().parent.parent / "frontend" / "public" / "models" / "oil_classifier.onnx"
    )
    output_segmenter_onnx: Path = field(
        default_factory=lambda: Path(__file__).resolve().parent.parent / "frontend" / "public" / "models" / "oil_segmenter.onnx"
    )
    model_metadata_path: Path = field(
        default_factory=lambda: Path(__file__).resolve().parent.parent / "frontend" / "public" / "models" / "model_metadata.json"
    )
    demo_dir: Path = field(
        default_factory=lambda: Path(__file__).resolve().parent.parent / "frontend" / "public" / "demo-sar"
    )
    benchmark_dir: Path = field(
        default_factory=lambda: Path(__file__).resolve().parent / "benchmark_gallery"
    )

    # ---------------------------------------------------------
    # Ingestion Band Mapping
    # Verified: TIFF band 0 is VH (cross-pol), band 1 is VV (co-pol)
    # Model Input: Channel 0 = VV, Channel 1 = VH
    # ---------------------------------------------------------
    in_channels: int = 2
    channel_names: Tuple[str, str] = ("VV", "VH")

    # Physical dB Normalization Bounds (Sigma0 dB)
    # Calibrated to real Sentinel-1 IW GRD ocean returns
    vv_min_db: float = -32.0
    vv_max_db: float = -10.0
    vh_min_db: float = -42.0
    vh_max_db: float = -20.0

    # ---------------------------------------------------------
    # Classification Patch Extraction
    # ---------------------------------------------------------
    cls_patch_size: int = 400
    cls_stride: int = 320

    # Oil-positive patch criteria (mask-based):
    # Patches with >= small_spill_min_ratio mask coverage are "small-spill" positives
    # Patches with >= strong_spill_min_ratio mask coverage are "strong" positives
    small_spill_min_ratio: float = 0.01   # 1% mask pixels
    strong_spill_min_ratio: float = 0.05  # 5% mask pixels

    # Small-spill oversampling factor (repeat small-spill patches N times)
    small_spill_oversample: int = 3

    # Ship/wake detection criteria for hard-negative mining
    ship_bright_threshold_db: float = -8.0  # VV > -8 dB indicates bright vessel
    ship_wake_darkness_db: float = -25.0    # Adjacent dark wake

    # Max clean ocean patches per scene (prevent dataset bloat)
    max_clean_per_scene: int = 4

    # ---------------------------------------------------------
    # Segmentation Patch Config
    # ---------------------------------------------------------
    seg_patch_size: int = 512
    seg_stride: int = 384

    # Segmentation oversampling: oil-containing crops get N× weight
    seg_oil_oversample: int = 4

    # ---------------------------------------------------------
    # Dataset Splitting
    # ---------------------------------------------------------
    # Part I + Part II: Split by scene into Train / Val
    # Part III: Completely held out for final test
    train_split_ratio: float = 0.82  # ~82% train, 18% val (within Part I+II)
    val_split_ratio: float = 0.18
    random_seed: int = 42

    cache_version: str = "v3_zenodo_gt_dualpol"

    # Minimum valid (finite) pixel ratio to accept a patch
    min_valid_ratio: float = 0.95

    # ---------------------------------------------------------
    # Training Hyperparameters — Classifier
    # ---------------------------------------------------------
    cls_batch_size: int = 32
    cls_epochs: int = 35
    cls_learning_rate: float = 1e-3
    cls_min_lr: float = 1e-5
    cls_weight_decay: float = 1e-4
    cls_early_stopping_patience: int = 7

    # Focal Loss parameters (γ=2, α=0.25)
    focal_gamma: float = 2.0
    focal_alpha: float = 0.25

    # Class-aware sampling weights per batch
    # 40% oil, 30% look-alike, 20% clean, 10% ship/wake
    sample_weight_oil: float = 0.40
    sample_weight_lookalike: float = 0.30
    sample_weight_clean: float = 0.20
    sample_weight_ship_wake: float = 0.10

    # Look-alike loss multiplier (higher = more penalty for FP on look-alikes)
    lookalike_loss_weight: float = 2.0

    # Threshold search
    default_threshold: float = 0.50
    threshold_search_steps: int = 46  # 0.05 to 0.95 step ~0.02

    # ---------------------------------------------------------
    # Training Hyperparameters — Segmentation
    # ---------------------------------------------------------
    seg_batch_size: int = 8
    seg_epochs: int = 30
    seg_learning_rate: float = 5e-4
    seg_min_lr: float = 1e-5
    seg_weight_decay: float = 1e-4
    seg_early_stopping_patience: int = 6

    # Dice + BCE loss weighting
    seg_dice_weight: float = 0.6
    seg_bce_weight: float = 0.4

    # ---------------------------------------------------------
    # General
    # ---------------------------------------------------------
    num_workers: int = 0
    use_amp: bool = True

    def get_device(self) -> torch.device:
        if torch.cuda.is_available():
            return torch.device("cuda")
        return torch.device("cpu")


# Singleton instance
CONFIG = SpillSenseConfig()
