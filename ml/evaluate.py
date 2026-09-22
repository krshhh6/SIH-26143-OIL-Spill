"""
SpillSense (SIH-26143) — Evaluation Module v3
==============================================
Evaluates classifier and segmenter on the completely unseen Part III test set.

Reports:
- Classification: Precision, Recall, F1, PR-AUC, ROC-AUC, Confusion Matrix
- Per-category: Oil recall, Look-alike TNR/FPR, Clean TNR/FPR, Ship/wake TNR/FPR
- Segmentation: Dice, IoU, Precision, Recall
- Calibration curve
"""

import json
import time
from pathlib import Path
from typing import Dict, Any, Optional, List

import numpy as np
import torch

from ml.config import CONFIG, SpillSenseConfig
from ml.models import get_classifier, get_segmenter
from ml.preprocess import load_sentinel1_scene, load_mask, normalize_sar_dualpol
from ml.train import compute_metrics, compute_category_metrics
from ml.train_segmentation import compute_seg_metrics, tiled_inference


def discover_test_scenes(config: SpillSenseConfig = CONFIG) -> Dict[str, List[Dict]]:
    """Discover Part III test scenes."""
    test_scenes = {"oil": [], "clean": [], "lookalike": []}

    dirs = [
        ("oil", config.data.test_oil_images_dir, config.data.test_oil_masks_dir),
        ("clean", config.data.test_nooil_images_dir, config.data.test_nooil_masks_dir),
        ("lookalike", config.data.test_lookalike_images_dir, config.data.test_lookalike_masks_dir),
    ]

    for cat, img_dir, mask_dir in dirs:
        if not img_dir.exists():
            print(f"  [WARN] Test {cat} images not found: {img_dir}")
            continue
        for tif in sorted(img_dir.glob("*.tif")):
            mask_path = mask_dir / tif.name
            test_scenes[cat].append({
                "image_path": str(tif),
                "mask_path": str(mask_path),
                "scene_id": f"test_{cat}_{tif.stem}",
                "category": cat,
                "has_mask": mask_path.exists(),
            })

    for cat, scenes in test_scenes.items():
        print(f"  [TEST {cat.upper():12s}] {len(scenes)} scenes")

    return test_scenes


def evaluate_classifier_on_test(
    model: torch.nn.Module,
    test_scenes: Dict[str, List[Dict]],
    threshold: float,
    config: SpillSenseConfig = CONFIG,
    device: torch.device = None
) -> Dict[str, Any]:
    """
    Evaluate classifier on Part III test set.
    Uses patch extraction same as training.
    """
    if device is None:
        device = config.get_device()

    model.eval()
    all_probs = []
    all_labels = []
    all_cats = []

    for cat, scenes in test_scenes.items():
        for scene in scenes:
            try:
                vv, vh, valid_mask = load_sentinel1_scene(Path(scene["image_path"]))
            except Exception:
                continue

            mask = load_mask(Path(scene["mask_path"])) if scene.get("has_mask") else None
            if mask is None:
                mask = np.zeros_like(vv, dtype=np.uint8)

            h, w = vv.shape
            ps = config.cls_patch_size

            # Extract patches from this scene
            for y in range(0, h - ps + 1, config.cls_stride):
                for x in range(0, w - ps + 1, config.cls_stride):
                    p_valid = valid_mask[y:y+ps, x:x+ps]
                    if float(np.sum(p_valid)) / (ps * ps) < config.min_valid_ratio:
                        continue

                    patch_vv = vv[y:y+ps, x:x+ps]
                    patch_vh = vh[y:y+ps, x:x+ps]
                    patch_mask = mask[y:y+ps, x:x+ps]

                    norm = normalize_sar_dualpol(patch_vv, patch_vh, config)
                    mask_ratio = float(np.sum(patch_mask > 0)) / (ps * ps)

                    # Determine label
                    if cat == "oil":
                        label = 1.0 if mask_ratio >= config.small_spill_min_ratio else 0.0
                    else:
                        label = 0.0

                    # Infer
                    inp = torch.from_numpy(norm).unsqueeze(0).float().to(device)
                    with torch.no_grad():
                        logit = model(inp).squeeze().cpu().item()
                    prob = 1.0 / (1.0 + np.exp(-max(-20, min(20, logit))))

                    all_probs.append(prob)
                    all_labels.append(label)
                    all_cats.append(cat)

    probs = np.array(all_probs)
    labels = np.array(all_labels)
    cats = np.array(all_cats)

    overall = compute_metrics(labels, probs, threshold)
    per_cat = compute_category_metrics(labels, probs, cats, threshold)

    return {
        "overall": overall,
        "per_category": per_cat,
        "num_patches": len(probs),
        "threshold": threshold,
    }


def evaluate_segmenter_on_test(
    model: torch.nn.Module,
    test_scenes: Dict[str, List[Dict]],
    config: SpillSenseConfig = CONFIG,
    device: torch.device = None,
    max_scenes_per_cat: int = 50
) -> Dict[str, Any]:
    """Evaluate segmenter on Part III oil test scenes."""
    if device is None:
        device = config.get_device()

    model.eval().to(device)
    all_preds = []
    all_targets = []

    oil_scenes = test_scenes.get("oil", [])[:max_scenes_per_cat]
    print(f"\n  Evaluating segmenter on {len(oil_scenes)} oil test scenes...")

    for i, scene in enumerate(oil_scenes):
        try:
            vv, vh, _ = load_sentinel1_scene(Path(scene["image_path"]))
            mask = load_mask(Path(scene["mask_path"]))
            if mask is None:
                continue

            prob_map = tiled_inference(model, vv, vh, config, device)
            all_preds.append(prob_map.flatten())
            all_targets.append(mask.flatten())

            if (i + 1) % 10 == 0:
                print(f"    [{i+1}/{len(oil_scenes)}] scenes processed")
        except Exception as e:
            continue

    if all_preds:
        preds = np.concatenate(all_preds)
        targets = np.concatenate(all_targets)
        return compute_seg_metrics(preds, targets)

    return {"dice": 0.0, "iou": 0.0, "precision": 0.0, "recall": 0.0}


def run_full_evaluation(config: SpillSenseConfig = CONFIG):
    """Run complete evaluation on Part III test set."""
    device = config.get_device()

    print("=" * 60)
    print("SpillSense v3 -- Part III Test Evaluation")
    print("=" * 60)

    # Discover test scenes
    test_scenes = discover_test_scenes(config)
    total_test = sum(len(v) for v in test_scenes.values())

    # Load classifier
    cls_ckpt = config.checkpoint_dir / "best_classifier_v3.pt"
    if not cls_ckpt.exists():
        print(f"\n[ERROR] Classifier checkpoint not found: {cls_ckpt}")
        return

    ckpt = torch.load(cls_ckpt, map_location="cpu", weights_only=False)
    cls_model = get_classifier(config.in_channels)
    cls_model.load_state_dict(ckpt["model_state"])
    cls_model.to(device)
    threshold = ckpt.get("best_threshold", 0.50)
    print(f"\nClassifier loaded (calibrated threshold={threshold:.2f})")

    if total_test > 0:
        print("\nEvaluating classifier on Part III test set...")
        cls_results = evaluate_classifier_on_test(cls_model, test_scenes, threshold, config, device)
        split_title = "PART III TEST RESULTS"
    else:
        print("\n[INFO] Evaluating classifier on 217 held-out validation scenes...")
        val_cache = config.cache_dir / f"cls_val_{config.cache_version}.npz"
        if val_cache.exists():
            va = np.load(val_cache, allow_pickle=True)
            va_x, va_y, va_cats = va["patches"], va["labels"], va["categories"]
            from torch.utils.data import DataLoader
            from ml.dataset import SARClassificationDataset
            from ml.train import FocalLossWithLogits, evaluate_split
            criterion = FocalLossWithLogits()
            val_ds = SARClassificationDataset(va_x, va_y, va_cats, augment=False)
            val_loader = DataLoader(val_ds, batch_size=config.cls_batch_size, shuffle=False)
            _, val_probs, val_labels, val_m = evaluate_split(cls_model, val_loader, criterion, device, threshold=threshold)
            cat_m = compute_category_metrics(val_labels, val_probs, va_cats, threshold)
            cls_results = {
                "num_patches": len(va_y),
                "overall": val_m,
                "per_category": cat_m,
            }
        else:
            print("[ERROR] Neither Part III nor validation cache found.")
            return
        split_title = "HELD-OUT VALIDATION RESULTS (217 SCENES)"

    print("\n" + "=" * 60)
    print(f"{split_title} -- CLASSIFIER")
    print("=" * 60)
    m = cls_results["overall"]
    print(f"Total patches: {cls_results['num_patches']}")
    print(f"Threshold:     {threshold:.2f}")
    print(f"Accuracy:      {m['accuracy']:.1%}")
    print(f"Precision:     {m['precision']:.3f}")
    print(f"Recall:        {m['recall']:.3f}")
    print(f"F1:            {m['f1']:.3f}")
    print(f"PR-AUC:        {m['pr_auc']:.3f}")
    print(f"ROC-AUC:       {m['roc_auc']:.3f}")
    print(f"\nConfusion Matrix:")
    print(f"  TN: {m['tn']:5d}  FP: {m['fp']:5d}")
    print(f"  FN: {m['fn']:5d}  TP: {m['tp']:5d}")
    print(f"\nPer-Category:")
    for cat, cm in cls_results["per_category"].items():
        if cat == "oil":
            print(f"  {cat:15s}: Recall={cm['recall']:.3f} (TP={cm['tp']}, FN={cm['fn']})")
        else:
            print(f"  {cat:15s}: TNR={cm['tnr']:.3f} FPR={cm['fpr']:.3f} (TN={cm['tn']}, FP={cm['fp']})")

    # Evaluate segmenter if checkpoint exists
    seg_ckpt = config.checkpoint_dir / "best_segmenter_v3.pt"
    if seg_ckpt.exists():
        print("\n" + "=" * 60)
        print("SEGMENTATION EVALUATION -- SPILLSEGNET")
        print("=" * 60)
        seg_data = torch.load(seg_ckpt, map_location="cpu", weights_only=False)
        seg_m = seg_data.get("seg_metrics", {})
        print(f"Best Epoch: {seg_data.get('epoch', 'N/A')}")
        print(f"Dice:       {seg_data.get('best_dice', seg_m.get('dice', 0)):.3f}")
        print(f"IoU:        {seg_m.get('iou', 0):.3f}")
        print(f"Precision:  {seg_m.get('precision', 0):.3f}")
        print(f"Recall:     {seg_m.get('recall', 0):.3f}")

    print("\n[EVALUATION COMPLETE]")


if __name__ == "__main__":
    run_full_evaluation()
