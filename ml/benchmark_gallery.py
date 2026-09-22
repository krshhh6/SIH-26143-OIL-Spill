"""
SpillSense (SIH-26143) — Benchmark Gallery Generator
=====================================================
Generates a visual benchmark with 40 curated evaluation scenes:
- 10 oil spill
- 10 clean ocean
- 10 look-alike
- 10 ship/wake (mined from look-alike + no-oil)

For each shows: VV, VH, GT mask, predicted mask, classification probability,
segmentation probability, and final decision.
"""

import json
import random
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
from PIL import Image
import torch

from ml.config import CONFIG, SpillSenseConfig
from ml.models import get_classifier, get_segmenter
from ml.preprocess import load_sentinel1_scene, load_mask, normalize_sar_dualpol
from ml.train_segmentation import tiled_inference


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -20, 20)))


def save_grayscale(arr: np.ndarray, path: Path, colormap: str = "gray"):
    """Save a 2D float array as a grayscale PNG."""
    arr_norm = np.clip(arr, 0, 1)
    img = Image.fromarray((arr_norm * 255).astype(np.uint8), mode="L")
    img.save(str(path))


def save_mask_overlay(vv_norm: np.ndarray, mask: np.ndarray, path: Path,
                      color=(255, 0, 0), alpha=0.4):
    """Save VV image with colored mask overlay."""
    h, w = vv_norm.shape
    rgb = np.stack([(vv_norm * 255).astype(np.uint8)] * 3, axis=-1)

    if mask is not None and mask.shape == (h, w):
        mask_bool = mask > 0
        for c in range(3):
            rgb[:, :, c] = np.where(
                mask_bool,
                np.clip(rgb[:, :, c] * (1 - alpha) + color[c] * alpha, 0, 255).astype(np.uint8),
                rgb[:, :, c]
            )

    img = Image.fromarray(rgb, mode="RGB")
    img.save(str(path))


def generate_benchmark_gallery(
    config: SpillSenseConfig = CONFIG,
    max_per_category: int = 10,
    output_size: int = 512
):
    """Generate the 40-image benchmark gallery."""
    print("=" * 60)
    print("SpillSense v3 -- Benchmark Gallery Generator")
    print("=" * 60)

    gallery_dir = config.benchmark_dir
    gallery_dir.mkdir(parents=True, exist_ok=True)

    device = config.get_device()

    # Load models
    cls_ckpt = config.checkpoint_dir / "best_classifier_v3.pt"
    seg_ckpt = config.checkpoint_dir / "best_segmenter_v3.pt"

    cls_model = None
    seg_model = None
    threshold = 0.50

    if cls_ckpt.exists():
        ckpt = torch.load(cls_ckpt, map_location="cpu", weights_only=False)
        cls_model = get_classifier(config.in_channels)
        cls_model.load_state_dict(ckpt["model_state"])
        cls_model.eval().to(device)
        threshold = ckpt.get("best_threshold", 0.50)
        print(f"Classifier loaded (threshold={threshold:.2f})")
    else:
        print("[WARN] No classifier checkpoint found")

    if seg_ckpt.exists():
        seg_data = torch.load(seg_ckpt, map_location="cpu", weights_only=False)
        seg_model = get_segmenter(config.in_channels)
        seg_model.load_state_dict(seg_data["model_state"])
        seg_model.eval().to(device)
        print("Segmenter loaded")
    else:
        print("[WARN] No segmenter checkpoint found")

    # Collect scenes from test set (Part III) or training set
    scene_sources = {
        "oil": [], "clean": [], "lookalike": [], "ship_wake": []
    }

    # Try Part III first
    test_dirs = [
        ("oil", config.data.test_oil_images_dir, config.data.test_oil_masks_dir),
        ("clean", config.data.test_nooil_images_dir, config.data.test_nooil_masks_dir),
        ("lookalike", config.data.test_lookalike_images_dir, config.data.test_lookalike_masks_dir),
    ]

    for cat, img_dir, mask_dir in test_dirs:
        if img_dir.exists():
            for tif in sorted(img_dir.glob("*.tif"))[:max_per_category * 3]:
                mask_path = mask_dir / tif.name
                scene_sources[cat].append({
                    "image_path": str(tif), "mask_path": str(mask_path),
                    "scene_id": f"{cat}_{tif.stem}", "category": cat,
                })

    # Fallback to authentic GT dataset if separate test dirs not available
    if any(len(scene_sources[c]) < max_per_category for c in ["oil", "clean", "lookalike", "ship_wake"]):
        oil_dir = config.data.find_oil_images()
        mask_dir = config.data.find_oil_masks()
        if oil_dir.exists():
            tifs = sorted(list(oil_dir.glob("*.tif")))
            for tif in tifs:
                if all(len(scene_sources[c]) >= max_per_category for c in ["oil", "clean", "lookalike", "ship_wake"]):
                    break
                mpath = mask_dir / tif.name
                if not mpath.exists():
                    continue
                try:
                    vv, vh, _ = load_sentinel1_scene(tif)
                    mask = load_mask(mpath)
                except Exception:
                    continue

                h, w = vv.shape
                ps = output_size  # 512

                # 1. Oil
                if len(scene_sources["oil"]) < max_per_category and np.sum(mask > 0) > 2000:
                    ys, xs = np.where(mask > 0)
                    cy, cx = int(np.median(ys)), int(np.median(xs))
                    y = int(np.clip(cy - ps // 2, 0, h - ps))
                    x = int(np.clip(cx - ps // 2, 0, w - ps))
                    scene_sources["oil"].append({
                        "image_path": str(tif), "mask_path": str(mpath),
                        "scene_id": f"oil_{tif.stem}", "category": "oil",
                        "crop_box": (y, x, ps, ps)
                    })

                # 2. Non-oil negatives from zero-mask regions
                for y in range(0, h - ps + 1, 384):
                    for x in range(0, w - ps + 1, 384):
                        sub_m = mask[y:y+ps, x:x+ps]
                        if np.any(sub_m > 0):
                            continue
                        sub_vv = vv[y:y+ps, x:x+ps]
                        bright = np.sum(sub_vv > config.ship_bright_threshold_db)
                        dark = np.sum(sub_vv < config.ship_wake_darkness_db)
                        med = float(np.median(sub_vv))

                        # Ship/wake
                        if bright > 10 and dark > ps * ps * 0.05 and len(scene_sources["ship_wake"]) < max_per_category:
                            scene_sources["ship_wake"].append({
                                "image_path": str(tif), "mask_path": str(mpath),
                                "scene_id": f"ship_wake_{tif.stem}_{y}_{x}", "category": "ship_wake",
                                "crop_box": (y, x, ps, ps)
                            })
                        # Look-alike
                        elif (med < -22.0 or dark > ps * ps * 0.10) and len(scene_sources["lookalike"]) < max_per_category:
                            scene_sources["lookalike"].append({
                                "image_path": str(tif), "mask_path": str(mpath),
                                "scene_id": f"lookalike_{tif.stem}_{y}_{x}", "category": "lookalike",
                                "crop_box": (y, x, ps, ps)
                            })
                        # Clean ocean
                        elif med > -21.0 and dark < ps * ps * 0.05 and len(scene_sources["clean"]) < max_per_category:
                            scene_sources["clean"].append({
                                "image_path": str(tif), "mask_path": str(mpath),
                                "scene_id": f"clean_{tif.stem}_{y}_{x}", "category": "clean",
                                "crop_box": (y, x, ps, ps)
                            })

    # Select samples
    gallery_scenes = []
    for cat in ["oil", "clean", "lookalike", "ship_wake"]:
        available = scene_sources[cat]
        selected = available[:max_per_category]
        gallery_scenes.extend(selected)
        print(f"  [{cat:12s}] {len(selected)} scenes selected")

    # Generate gallery
    report = []
    for idx, scene in enumerate(gallery_scenes):
        try:
            vv, vh, valid_mask = load_sentinel1_scene(Path(scene["image_path"]))
            mask = load_mask(Path(scene["mask_path"]))
            if mask is None:
                mask = np.zeros_like(vv, dtype=np.uint8)

            # Apply crop_box if defined
            if "crop_box" in scene:
                cy, cx, ch, cw = scene["crop_box"]
                vv = vv[cy:cy+ch, cx:cx+cw]
                vh = vh[cy:cy+ch, cx:cx+cw]
                mask = mask[cy:cy+ch, cx:cx+cw]

            norm = normalize_sar_dualpol(vv, vh, config)
            vv_norm = norm[0]  # (H, W)
            vh_norm = norm[1]

            # Resize if needed
            from PIL import Image as PILImage
            if vv_norm.shape != (output_size, output_size):
                vv_img = PILImage.fromarray((vv_norm * 255).astype(np.uint8), "L").resize((output_size, output_size))
                vh_img = PILImage.fromarray((vh_norm * 255).astype(np.uint8), "L").resize((output_size, output_size))
                mask_img = PILImage.fromarray((mask * 255).astype(np.uint8), "L").resize((output_size, output_size), PILImage.NEAREST)
            else:
                vv_img = PILImage.fromarray((vv_norm * 255).astype(np.uint8), "L")
                vh_img = PILImage.fromarray((vh_norm * 255).astype(np.uint8), "L")
                mask_img = PILImage.fromarray((mask * 255).astype(np.uint8), "L")

            prefix = f"{idx:02d}_{scene['category']}"
            cat_dir = gallery_dir / scene["category"]
            cat_dir.mkdir(parents=True, exist_ok=True)

            vv_img.save(str(cat_dir / f"{prefix}_vv.png"))
            vh_img.save(str(cat_dir / f"{prefix}_vh.png"))
            mask_img.save(str(cat_dir / f"{prefix}_gt_mask.png"))

            # GT overlay
            vv_arr = np.array(vv_img).astype(np.float32) / 255.0
            mask_arr = np.array(mask_img).astype(np.float32) / 255.0
            save_mask_overlay(vv_arr, (mask_arr > 0.5).astype(np.uint8),
                              cat_dir / f"{prefix}_gt_overlay.png", color=(0, 255, 0))

            # Classification
            cls_prob = 0.5
            cls_decision = "unknown"
            if cls_model is not None:
                # Use center 400x400 crop
                h, w = vv.shape
                cy, cx = h // 2 - 200, w // 2 - 200
                crop_norm = normalize_sar_dualpol(
                    vv[cy:cy+400, cx:cx+400], vh[cy:cy+400, cx:cx+400], config)
                inp = torch.from_numpy(crop_norm).unsqueeze(0).float().to(device)
                with torch.no_grad():
                    logit = cls_model(inp).squeeze().cpu().item()
                cls_prob = float(sigmoid(logit))
                cls_decision = "OIL" if cls_prob >= threshold else "NON-OIL"

            # Segmentation
            seg_prob_map = None
            if seg_model is not None:
                seg_prob_map = tiled_inference(seg_model, vv, vh, config, device)
                seg_resized = PILImage.fromarray(
                    (np.clip(seg_prob_map, 0, 1) * 255).astype(np.uint8), "L"
                ).resize((output_size, output_size))
                seg_resized.save(str(cat_dir / f"{prefix}_pred_mask.png"))

                save_mask_overlay(vv_arr, (np.array(seg_resized) > 127).astype(np.uint8),
                                  cat_dir / f"{prefix}_pred_overlay.png", color=(255, 0, 0))

            entry = {
                "index": idx,
                "scene_id": scene["scene_id"],
                "category": scene["category"],
                "cls_probability": round(cls_prob, 4),
                "cls_decision": cls_decision,
                "threshold": threshold,
                "gt_mask_coverage": round(float(np.sum(mask > 0)) / mask.size, 4),
            }
            if seg_prob_map is not None:
                entry["seg_mean_prob"] = round(float(np.mean(seg_prob_map)), 4)
            report.append(entry)

            print(f"  [{idx+1:2d}/{len(gallery_scenes)}] {scene['category']:12s} | "
                  f"P={cls_prob:.3f} | Decision={cls_decision} | "
                  f"GT coverage={entry['gt_mask_coverage']:.3f}")

        except Exception as e:
            print(f"  [{idx+1}] ERROR: {e}")

    # Save report
    with open(gallery_dir / "benchmark_report.json", "w") as f:
        json.dump(report, f, indent=2)

    # Generate markdown summary
    md = "# SpillSense v3 -- Benchmark Gallery\n\n"
    md += f"Generated: {__import__('time').strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    md += f"| # | Category | Cls Prob | Decision | GT Coverage | Seg Prob |\n"
    md += f"|---|----------|----------|----------|-------------|----------|\n"
    for r in report:
        seg = r.get("seg_mean_prob", "N/A")
        md += f"| {r['index']} | {r['category']} | {r['cls_probability']:.3f} | "
        md += f"{r['cls_decision']} | {r['gt_mask_coverage']:.3f} | {seg} |\n"

    with open(gallery_dir / "benchmark_report.md", "w") as f:
        f.write(md)

    print(f"\n[GALLERY] Saved {len(report)} benchmark examples to {gallery_dir}")
    return report


if __name__ == "__main__":
    generate_benchmark_gallery()
