"""
SpillSense (SIH-26143) — Ground-Truth Dataset Module v3
========================================================
Uses official Zenodo ground-truth masks for labeling.
Enforces strict scene-level partitioning.

Classification labels:
    1.0 = Oil spill (real mask-positive patches)
    0.0 = Non-oil (clean ocean, look-alike, ship/wake)

Scene categories tracked for evaluation:
    "oil"        — Oil spill scenes with real GT masks
    "clean"      — No-oil clean ocean scenes
    "lookalike"  — Dark SAR look-alike scenes (biogenic, low-wind, etc.)
    "ship_wake"  — Mined from no-oil/look-alike scenes with bright targets + dark wakes
"""

import json
import time
import random
import hashlib
from pathlib import Path
from typing import Tuple, List, Dict, Optional, Any
from concurrent.futures import ThreadPoolExecutor, as_completed

import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler

from ml.config import CONFIG, SpillSenseConfig
from ml.preprocess import load_sentinel1_scene, load_mask, normalize_sar_dualpol


# ═══════════════════════════════════════════════════════
# Classification Dataset
# ═══════════════════════════════════════════════════════

class SARClassificationDataset(Dataset):
    """
    PyTorch Dataset for 2-channel Sentinel-1 SAR classification patches.
    Input: (2, 400, 400) — Channel 0 = VV, Channel 1 = VH
    """
    def __init__(self, patches: np.ndarray, labels: np.ndarray,
                 categories: np.ndarray, augment: bool = False):
        self.patches = patches       # (N, 2, 400, 400) uint8 [0, 255]
        self.labels = labels.astype(np.float32)  # (N,) — 0.0 or 1.0
        self.categories = categories  # (N,) — string category for evaluation
        self.augment = augment

    def __len__(self) -> int:
        return len(self.labels)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        patch = self.patches[idx].astype(np.float32) / 255.0
        label = self.labels[idx]

        if self.augment:
            if random.random() > 0.5:
                patch = np.flip(patch, axis=2).copy()
            if random.random() > 0.5:
                patch = np.flip(patch, axis=1).copy()
            if random.random() > 0.5:
                k = random.choice([1, 2, 3])
                patch = np.rot90(patch, k=k, axes=(1, 2)).copy()
            if random.random() > 0.5:
                jitter = random.uniform(0.95, 1.05)
                patch = np.clip(patch * jitter, 0.0, 1.0)

        return torch.from_numpy(patch).float(), torch.tensor(label, dtype=torch.float32)


# ═══════════════════════════════════════════════════════
# Segmentation Dataset
# ═══════════════════════════════════════════════════════

class SARSegmentationDataset(Dataset):
    """
    PyTorch Dataset for oil spill segmentation.
    Input: (2, 512, 512) — VV + VH
    Target: (1, 512, 512) — binary oil mask
    """
    def __init__(self, scenes: List[Dict], config: SpillSenseConfig = CONFIG,
                 augment: bool = False):
        """
        scenes: list of dicts with keys:
            - image_path: Path to SAR scene TIFF
            - mask_path: Path to ground-truth mask TIFF
            - category: "oil", "clean", "lookalike"
            - repeat: int, how many random crops per epoch
        """
        self.scenes = scenes
        self.config = config
        self.augment = augment
        self.patch_size = config.seg_patch_size

        # Build index: (scene_idx, crop_idx)
        self.index = []
        for i, s in enumerate(scenes):
            for j in range(s.get("repeat", 1)):
                self.index.append((i, j))

    def __len__(self) -> int:
        return len(self.index)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        scene_idx, _ = self.index[idx]
        scene = self.scenes[scene_idx]

        vv, vh, _ = load_sentinel1_scene(Path(scene["image_path"]))
        mask = load_mask(Path(scene["mask_path"]))
        if mask is None:
            mask = np.zeros_like(vv, dtype=np.uint8)

        h, w = vv.shape
        ps = self.patch_size

        # Target crop around oil pixels with 75% probability if scene has oil
        has_oil = np.any(mask > 0)
        if has_oil and random.random() < 0.75 and h > ps and w > ps:
            oil_ys, oil_xs = np.where(mask > 0)
            pick = random.randint(0, len(oil_ys) - 1)
            oy, ox = int(oil_ys[pick]), int(oil_xs[pick])
            offset_y = random.randint(ps // 4, 3 * ps // 4)
            offset_x = random.randint(ps // 4, 3 * ps // 4)
            y = int(np.clip(oy - offset_y, 0, h - ps))
            x = int(np.clip(ox - offset_x, 0, w - ps))
        elif h > ps and w > ps:
            y = random.randint(0, h - ps)
            x = random.randint(0, w - ps)
        else:
            y, x = 0, 0

        crop_vv = vv[y:y+ps, x:x+ps]
        crop_vh = vh[y:y+ps, x:x+ps]
        crop_mask = mask[y:y+ps, x:x+ps]

        # Normalize
        norm = normalize_sar_dualpol(crop_vv, crop_vh, self.config)  # (2, ps, ps)
        mask_tensor = crop_mask.astype(np.float32)[np.newaxis, :, :]  # (1, ps, ps)

        if self.augment:
            if random.random() > 0.5:
                norm = np.flip(norm, axis=2).copy()
                mask_tensor = np.flip(mask_tensor, axis=2).copy()
            if random.random() > 0.5:
                norm = np.flip(norm, axis=1).copy()
                mask_tensor = np.flip(mask_tensor, axis=1).copy()
            if random.random() > 0.5:
                k = random.choice([1, 2, 3])
                norm = np.rot90(norm, k=k, axes=(1, 2)).copy()
                mask_tensor = np.rot90(mask_tensor, k=k, axes=(1, 2)).copy()

        return torch.from_numpy(norm).float(), torch.from_numpy(mask_tensor).float()


class CachedSARSegmentationDataset(Dataset):
    """
    In-memory pre-cropped dataset for oil spill segmentation.
    Fast: sub-millisecond batch loading from RAM.
    """
    def __init__(self, crops: np.ndarray, masks: np.ndarray, augment: bool = False):
        self.crops = crops    # (N, 2, 512, 512) uint8
        self.masks = masks    # (N, 1, 512, 512) uint8
        self.augment = augment

    def __len__(self) -> int:
        return len(self.crops)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        crop = self.crops[idx].astype(np.float32) / 255.0
        mask = self.masks[idx].astype(np.float32)

        if self.augment:
            if random.random() > 0.5:
                crop = np.flip(crop, axis=2).copy()
                mask = np.flip(mask, axis=2).copy()
            if random.random() > 0.5:
                crop = np.flip(crop, axis=1).copy()
                mask = np.flip(mask, axis=1).copy()
            if random.random() > 0.5:
                k = random.choice([1, 2, 3])
                crop = np.rot90(crop, k=k, axes=(1, 2)).copy()
                mask = np.rot90(mask, k=k, axes=(1, 2)).copy()

        return torch.from_numpy(crop).float(), torch.from_numpy(mask).float()


def build_cached_seg_split(
    scene_list: List[Dict],
    split_name: str,
    config: SpillSenseConfig = CONFIG,
    oil_crops_per_scene: int = 2,
    neg_crops_per_scene: int = 1,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Extracts high-priority 512x512 segmentation crops from scenes in parallel.
    Returns: (crops_uint8, masks_uint8)
    """
    print(f"[{split_name.upper()}] Extracting segmentation crops from {len(scene_list)} scenes...")
    t0 = time.time()
    ps = config.seg_patch_size

    all_crops = []
    all_masks = []

    def _process_one(scene):
        out = []
        try:
            vv, vh, _ = load_sentinel1_scene(Path(scene["image_path"]))
            mask = load_mask(Path(scene["mask_path"]))
            if mask is None:
                mask = np.zeros_like(vv, dtype=np.uint8)
            h, w = vv.shape
            if h < ps or w < ps:
                return out

            has_oil = np.any(mask > 0)
            rng = random.Random(int(hashlib.md5(scene["scene_id"].encode()).hexdigest()[:8], 16))

            # 1. Oil crops
            if has_oil:
                ys, xs = np.where(mask > 0)
                for _ in range(oil_crops_per_scene):
                    pick = rng.randint(0, len(ys) - 1)
                    oy, ox = int(ys[pick]), int(xs[pick])
                    y = int(np.clip(oy - rng.randint(ps // 4, 3 * ps // 4), 0, h - ps))
                    x = int(np.clip(ox - rng.randint(ps // 4, 3 * ps // 4), 0, w - ps))
                    c = normalize_sar_dualpol(vv[y:y+ps, x:x+ps], vh[y:y+ps, x:x+ps], config)
                    m = mask[y:y+ps, x:x+ps][np.newaxis, :, :]
                    out.append(((c * 255.0).astype(np.uint8), m.astype(np.uint8)))

            # 2. Non-oil background crop
            for _ in range(neg_crops_per_scene):
                for _try in range(5):
                    y = rng.randint(0, h - ps)
                    x = rng.randint(0, w - ps)
                    m = mask[y:y+ps, x:x+ps]
                    if not np.any(m > 0) or not has_oil:
                        c = normalize_sar_dualpol(vv[y:y+ps, x:x+ps], vh[y:y+ps, x:x+ps], config)
                        out.append(((c * 255.0).astype(np.uint8), m[np.newaxis, :, :].astype(np.uint8)))
                        break
        except Exception:
            pass
        return out

    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = [ex.submit(_process_one, s) for s in scene_list]
        for fut in as_completed(futures):
            for c, m in fut.result():
                all_crops.append(c)
                all_masks.append(m)

    crops_arr = np.stack(all_crops, axis=0)
    masks_arr = np.stack(all_masks, axis=0)

    # Shuffle
    perm = np.random.RandomState(config.random_seed).permutation(len(crops_arr))
    crops_arr = crops_arr[perm]
    masks_arr = masks_arr[perm]

    dt = time.time() - t0
    oil_crops = sum(1 for m in masks_arr if np.any(m > 0))
    print(f"[{split_name.upper()}] Done: {len(crops_arr)} crops ({oil_crops} with oil) in {dt:.1f}s")
    return crops_arr, masks_arr


# ═══════════════════════════════════════════════════════
# Scene Discovery & Partitioning
# ═══════════════════════════════════════════════════════

def discover_scenes(config: SpillSenseConfig = CONFIG) -> Dict[str, List[Dict]]:
    """
    Discovers all available scenes across the Zenodo dataset.
    Returns dict keyed by category with lists of scene info dicts.
    """
    scenes = {"oil": [], "clean": [], "lookalike": []}

    # Oil spill scenes (Part I)
    oil_img_dir = config.data.find_oil_images()
    oil_mask_dir = config.data.oil_masks_dir

    if oil_img_dir.exists():
        for tif in sorted(oil_img_dir.glob("*.tif")):
            mask_path = oil_mask_dir / tif.name
            scenes["oil"].append({
                "image_path": str(tif),
                "mask_path": str(mask_path),
                "scene_id": f"oil_{tif.stem}",
                "category": "oil",
                "has_mask": mask_path.exists(),
            })

    # No-Oil scenes (Part II)
    nooil_dir = config.data.nooil_images_dir
    nooil_mask_dir = config.data.nooil_masks_dir

    if nooil_dir.exists():
        for tif in sorted(nooil_dir.glob("*.tif")):
            mask_path = nooil_mask_dir / tif.name
            scenes["clean"].append({
                "image_path": str(tif),
                "mask_path": str(mask_path),
                "scene_id": f"clean_{tif.stem}",
                "category": "clean",
                "has_mask": mask_path.exists(),
            })

    # Look-alike scenes (Part II)
    look_dir = config.data.lookalike_images_dir
    look_mask_dir = config.data.lookalike_masks_dir

    if look_dir.exists():
        for tif in sorted(look_dir.glob("*.tif")):
            mask_path = look_mask_dir / tif.name
            scenes["lookalike"].append({
                "image_path": str(tif),
                "mask_path": str(mask_path),
                "scene_id": f"lookalike_{tif.stem}",
                "category": "lookalike",
                "has_mask": mask_path.exists(),
            })

    for cat, sc_list in scenes.items():
        masks_avail = sum(1 for s in sc_list if s["has_mask"])
        print(f"  [{cat.upper():12s}] {len(sc_list):4d} scenes ({masks_avail} with GT masks)")

    return scenes


def partition_scenes_by_category(
    scenes: Dict[str, List[Dict]],
    config: SpillSenseConfig = CONFIG
) -> Tuple[List[Dict], List[Dict]]:
    """
    Partition each category's scenes into train / val splits.
    Part III test scenes are handled separately.
    """
    rng = random.Random(config.random_seed)
    train_scenes = []
    val_scenes = []

    for cat, scene_list in scenes.items():
        shuffled = list(scene_list)
        rng.shuffle(shuffled)

        n_train = int(len(shuffled) * config.train_split_ratio)
        cat_train = shuffled[:n_train]
        cat_val = shuffled[n_train:]

        train_scenes.extend(cat_train)
        val_scenes.extend(cat_val)

        print(f"  [{cat.upper():12s}] Train: {len(cat_train):4d}  Val: {len(cat_val):4d}")

    # Verify no leakage
    train_ids = set(s["scene_id"] for s in train_scenes)
    val_ids = set(s["scene_id"] for s in val_scenes)
    assert len(train_ids & val_ids) == 0, "CRITICAL: Scene leakage detected between train and val!"

    return train_scenes, val_scenes


# ═══════════════════════════════════════════════════════
# Classification Patch Extraction (with Real Masks)
# ═══════════════════════════════════════════════════════

def extract_classification_patches(
    scene: Dict,
    config: SpillSenseConfig = CONFIG
) -> List[Dict]:
    """
    Extract classification patches from a single scene using real GT masks.
    
    Returns list of dicts with: patch, label, category, is_small_spill, scene_id, coords
    """
    try:
        vv, vh, valid_mask = load_sentinel1_scene(Path(scene["image_path"]))
    except Exception as e:
        return []

    mask = load_mask(Path(scene["mask_path"])) if scene.get("has_mask") else None
    if mask is None:
        mask = np.zeros_like(vv, dtype=np.uint8)

    h, w = vv.shape
    ps = config.cls_patch_size
    stride = config.cls_stride

    if h < ps or w < ps:
        return []

    category = scene["category"]
    extracted = []
    neg_pool = {"ship_wake": [], "lookalike": [], "clean": []}

    for y in range(0, h - ps + 1, stride):
        for x in range(0, w - ps + 1, stride):
            # Check validity
            p_valid = valid_mask[y:y+ps, x:x+ps]
            if float(np.sum(p_valid)) / (ps * ps) < config.min_valid_ratio:
                continue

            patch_vv = vv[y:y+ps, x:x+ps]
            patch_vh = vh[y:y+ps, x:x+ps]
            patch_mask = mask[y:y+ps, x:x+ps]

            # Normalize to (2, ps, ps) float32, then quantize to uint8
            norm = normalize_sar_dualpol(patch_vv, patch_vh, config)
            norm_uint8 = (norm * 255.0).astype(np.uint8)

            mask_ratio = float(np.sum(patch_mask > 0)) / (ps * ps)

            if category == "oil":
                if mask_ratio >= config.strong_spill_min_ratio:
                    # Strong oil positive
                    extracted.append({
                        "patch": norm_uint8, "label": 1.0,
                        "category": "oil", "subcategory": "strong_spill",
                        "is_small_spill": False,
                        "scene_id": scene["scene_id"],
                        "coords": (y, x), "mask_ratio": mask_ratio,
                    })
                elif mask_ratio >= config.small_spill_min_ratio:
                    # Small spill positive — will be oversampled
                    extracted.append({
                        "patch": norm_uint8, "label": 1.0,
                        "category": "oil", "subcategory": "small_spill",
                        "is_small_spill": True,
                        "scene_id": scene["scene_id"],
                        "coords": (y, x), "mask_ratio": mask_ratio,
                    })
                elif mask_ratio == 0.0:
                    # Non-oil region of oil scene — true negative from authentic GT mask
                    if _check_ship_wake(patch_vv, config):
                        sub = "ship_wake"
                    elif _check_lookalike(patch_vv, config):
                        sub = "lookalike"
                    else:
                        sub = "clean"
                    neg_pool[sub].append({
                        "patch": norm_uint8, "label": 0.0,
                        "category": sub, "subcategory": sub,
                        "is_small_spill": False,
                        "scene_id": scene["scene_id"],
                        "coords": (y, x), "mask_ratio": 0.0,
                    })

            elif category in ("clean", "lookalike"):
                # Dedicated no-oil or look-alike scenes
                if _check_ship_wake(patch_vv, config):
                    sub = "ship_wake"
                elif category == "lookalike" or _check_lookalike(patch_vv, config):
                    sub = "lookalike"
                else:
                    sub = "clean"
                neg_pool[sub].append({
                    "patch": norm_uint8, "label": 0.0,
                    "category": sub, "subcategory": sub,
                    "is_small_spill": False,
                    "scene_id": scene["scene_id"],
                    "coords": (y, x), "mask_ratio": 0.0,
                })

    # Sample balanced negatives using deterministic seed per scene
    seed_val = int(hashlib.md5(scene["scene_id"].encode()).hexdigest()[:8], 16)
    rng = random.Random(seed_val)

    if category == "oil":
        for sub_name, max_k in [("ship_wake", 6), ("lookalike", 6), ("clean", 6)]:
            pool = neg_pool[sub_name]
            if pool:
                chosen = rng.sample(pool, min(max_k, len(pool)))
                extracted.extend(chosen)
    else:
        for sub_name in ["ship_wake", "lookalike", "clean"]:
            pool = neg_pool[sub_name]
            if pool:
                k = min(config.max_clean_per_scene, len(pool))
                chosen = rng.sample(pool, k)
                extracted.extend(chosen)

    return extracted


def _check_ship_wake(patch_vv: np.ndarray, config: SpillSenseConfig) -> bool:
    """
    Detect ship + wake pattern: bright target (VV > -8 dB) adjacent to dark wake.
    """
    bright_pixels = np.sum(patch_vv > config.ship_bright_threshold_db)
    dark_pixels = np.sum(patch_vv < config.ship_wake_darkness_db)
    total = patch_vv.size
    has_bright = bright_pixels > (0.0005 * total)  # At least 0.05% bright
    has_dark = dark_pixels > (0.05 * total)        # At least 5% dark
    return bool(has_bright and has_dark)


def _check_lookalike(patch_vv: np.ndarray, config: SpillSenseConfig) -> bool:
    """
    Detect dark look-alike formations (low-wind, biogenic slicks, grease ice).
    Characterized by depressed backscatter without bright vessel targets.
    """
    med = float(np.median(patch_vv))
    dark_ratio = float(np.mean(patch_vv < config.ship_wake_darkness_db))
    return bool(med < -22.0 or dark_ratio > 0.10)


# ═══════════════════════════════════════════════════════
# Dataset Building & Caching
# ═══════════════════════════════════════════════════════

def build_classification_split(
    scene_list: List[Dict],
    split_name: str,
    config: SpillSenseConfig = CONFIG,
    max_workers: int = 8
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, List[Dict]]:
    """
    Extract patches from a scene split in parallel.
    Returns: patches, labels, categories, metadata
    """
    print(f"\n[{split_name.upper()}] Extracting patches from {len(scene_list)} scenes...")
    t0 = time.time()

    all_patches = []
    all_labels = []
    all_cats = []
    all_meta = []
    completed = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(extract_classification_patches, s, config): s
                   for s in scene_list}

        for fut in as_completed(futures):
            completed += 1
            items = fut.result()
            for item in items:
                all_patches.append(item["patch"])
                all_labels.append(item["label"])
                all_cats.append(item["category"])
                all_meta.append({
                    "scene_id": item["scene_id"],
                    "coords": item["coords"],
                    "category": item["category"],
                    "subcategory": item["subcategory"],
                    "mask_ratio": item["mask_ratio"],
                    "is_small_spill": item["is_small_spill"],
                })

            if completed % 100 == 0 or completed == len(scene_list):
                dt = time.time() - t0
                n_oil = sum(1 for l in all_labels if l == 1.0)
                print(f"  [{completed:4d}/{len(scene_list)}] Patches: {len(all_patches)} "
                      f"(Oil: {n_oil}) | {completed/max(0.1, dt):.1f} sc/s")

    if not all_patches:
        raise ValueError(f"No patches extracted from {split_name}!")

    # Oversample small-spill positives
    small_spill_indices = [i for i, m in enumerate(all_meta) if m["is_small_spill"]]
    if small_spill_indices and config.small_spill_oversample > 1:
        print(f"  Oversampling {len(small_spill_indices)} small-spill patches {config.small_spill_oversample}x")
        for _ in range(config.small_spill_oversample - 1):
            for idx in small_spill_indices:
                all_patches.append(all_patches[idx])
                all_labels.append(all_labels[idx])
                all_cats.append(all_cats[idx])
                all_meta.append(all_meta[idx])

    patches = np.stack(all_patches, axis=0)  # (N, 2, 400, 400) uint8
    labels = np.array(all_labels, dtype=np.float32)
    categories = np.array(all_cats, dtype=object)

    # Deterministic shuffle
    perm = np.random.RandomState(config.random_seed).permutation(len(labels))
    patches = patches[perm]
    labels = labels[perm]
    categories = categories[perm]
    all_meta = [all_meta[i] for i in perm]

    dt = time.time() - t0
    _print_split_stats(split_name, labels, categories, dt)

    return patches, labels, categories, all_meta


def _print_split_stats(name: str, labels: np.ndarray, categories: np.ndarray, dt: float):
    """Print detailed split statistics."""
    n_total = len(labels)
    n_oil = int(np.sum(labels == 1.0))
    n_neg = int(np.sum(labels == 0.0))

    cat_counts = {}
    for c in categories:
        cat_counts[c] = cat_counts.get(c, 0) + 1

    print(f"\n[{name.upper()} COMPLETE] {n_total} patches in {dt:.1f}s")
    print(f"  Oil (positive): {n_oil} ({100*n_oil/max(1,n_total):.1f}%)")
    print(f"  Non-oil (neg):  {n_neg} ({100*n_neg/max(1,n_total):.1f}%)")
    print(f"  Category breakdown:")
    for cat, cnt in sorted(cat_counts.items()):
        print(f"    {cat:15s}: {cnt:5d} ({100*cnt/max(1,n_total):.1f}%)")


def get_or_create_cls_dataset(
    config: SpillSenseConfig = CONFIG,
    force_rebuild: bool = False,
    max_scenes: Optional[int] = None
) -> Dict[str, Any]:
    """
    Loads cached classification dataset or builds from Zenodo scenes.
    """
    config.cache_dir.mkdir(parents=True, exist_ok=True)

    manifest_path = config.cache_dir / f"manifest_{config.cache_version}.json"
    train_cache = config.cache_dir / f"cls_train_{config.cache_version}.npz"
    val_cache = config.cache_dir / f"cls_val_{config.cache_version}.npz"

    if train_cache.exists() and val_cache.exists() and manifest_path.exists() and not force_rebuild:
        try:
            with open(manifest_path) as f:
                manifest = json.load(f)
            if manifest.get("cache_version") == config.cache_version:
                print(f"[CACHE HIT] Loading classification dataset ({config.cache_version})...")
                tr = np.load(train_cache, allow_pickle=True)
                va = np.load(val_cache, allow_pickle=True)

                pos_count = int(np.sum(tr["labels"] == 1.0))
                neg_count = int(np.sum(tr["labels"] == 0.0))

                return {
                    "train_patches": tr["patches"],
                    "train_labels": tr["labels"],
                    "train_categories": tr["categories"],
                    "val_patches": va["patches"],
                    "val_labels": va["labels"],
                    "val_categories": va["categories"],
                    "manifest": manifest,
                    "pos_weight": float(neg_count / max(1, pos_count)),
                }
        except Exception as e:
            print(f"[CACHE WARN] Cache load failed ({e}). Rebuilding...")

    print(f"\n[CACHE MISS] Building classification dataset ({config.cache_version})...")

    # Discover scenes
    print("\nDiscovering Zenodo scenes:")
    scenes = discover_scenes(config)

    # Partition
    print("\nPartitioning scenes (train/val):")
    train_scenes, val_scenes = partition_scenes_by_category(scenes, config)

    if max_scenes:
        train_scenes = train_scenes[:int(max_scenes * 0.82)]
        val_scenes = val_scenes[:int(max_scenes * 0.18)]

    # Extract patches
    tr_patches, tr_labels, tr_cats, tr_meta = build_classification_split(
        train_scenes, "Train", config)
    va_patches, va_labels, va_cats, va_meta = build_classification_split(
        val_scenes, "Val", config)

    # Save
    print("\nSaving classification dataset caches...")
    np.savez_compressed(train_cache, patches=tr_patches, labels=tr_labels, categories=tr_cats)
    np.savez_compressed(val_cache, patches=va_patches, labels=va_labels, categories=va_cats)

    pos_count = int(np.sum(tr_labels == 1.0))
    neg_count = int(np.sum(tr_labels == 0.0))

    manifest = {
        "cache_version": config.cache_version,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "dataset_source": "Zenodo Sentinel-1 SAR Oil Spill Dataset (Parts I+II)",
        "train_scenes": len(train_scenes),
        "val_scenes": len(val_scenes),
        "train_patches": len(tr_labels),
        "val_patches": len(va_labels),
        "train_pos": pos_count,
        "train_neg": neg_count,
        "pos_weight": float(neg_count / max(1, pos_count)),
        "train_scene_ids": [s["scene_id"] for s in train_scenes],
        "val_scene_ids": [s["scene_id"] for s in val_scenes],
    }
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\n[SUCCESS] Saved classification dataset manifest")

    return {
        "train_patches": tr_patches,
        "train_labels": tr_labels,
        "train_categories": tr_cats,
        "val_patches": va_patches,
        "val_labels": va_labels,
        "val_categories": va_cats,
        "manifest": manifest,
        "pos_weight": float(neg_count / max(1, pos_count)),
    }


def build_segmentation_scenes(
    config: SpillSenseConfig = CONFIG,
    max_scenes: Optional[int] = None
) -> Tuple[List[Dict], List[Dict]]:
    """
    Build scene lists for segmentation training.
    Oil scenes are oversampled. Returns (train_scenes, val_scenes).
    """
    scenes = discover_scenes(config)
    train_scenes, val_scenes = partition_scenes_by_category(scenes, config)

    if max_scenes:
        train_scenes = train_scenes[:int(max_scenes * 0.82)]
        val_scenes = val_scenes[:int(max_scenes * 0.18)]

    # Oversample oil scenes for segmentation
    train_seg = []
    for s in train_scenes:
        if s["category"] == "oil" and s.get("has_mask"):
            train_seg.append({**s, "repeat": config.seg_oil_oversample})
        else:
            train_seg.append({**s, "repeat": 1})

    val_seg = [{**s, "repeat": 1} for s in val_scenes]

    oil_count = sum(1 for s in train_seg if s["category"] == "oil")
    other_count = len(train_seg) - oil_count
    print(f"\n[SEG DATASET] Train: {len(train_seg)} scenes "
          f"(Oil: {oil_count} x{config.seg_oil_oversample}, Other: {other_count})")
    print(f"[SEG DATASET] Val: {len(val_seg)} scenes")

    return train_seg, val_seg
