"""
Sentinel-1 SAR Oil Spill Classifier - GeoTIFF Training Pipeline
================================================================
Trains on authentic 2048x2048 dual-polarization Sentinel-1 GeoTIFF scenes (VV/VH in dB)
from D:\\01_Train_Val_Oil_Spill_images\\Oil\\.

Generates:
1. frontend/public/models/oil_classifier.onnx (In-browser ONNX model)
2. frontend/public/demo-sar/*.jpg (Demo samples for web dashboard)
"""

import os
import sys
import time
import random
import shutil
from pathlib import Path

import numpy as np
import tifffile
from PIL import Image

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler

# ============================================================
# CONFIGURATION
# ============================================================

TIFF_DIR = Path(r"D:\01_Train_Val_Oil_Spill_images\Oil")
PROJECT_ROOT = Path(r"d:\Spill Sense\SIH-26143-OIL-Spill")
OUTPUT_ONNX = PROJECT_ROOT / "frontend" / "public" / "models" / "oil_classifier.onnx"
DEMO_DIR = PROJECT_ROOT / "frontend" / "public" / "demo-sar"
CACHE_DIR = PROJECT_ROOT / "ml" / "cache_patches"

IMG_SIZE = 400
BATCH_SIZE = 64
EPOCHS = 20
LR = 1e-3
SEED = 42

# None means ingest ALL 1,200 GeoTIFF scenes
MAX_SCENES = None  
WORKER_THREADS = 12

random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)


# ============================================================
# MODEL ARCHITECTURE (Matches frontend sarClassifier.ts)
# ============================================================

class OilSpillCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 16, kernel_size=3, padding=1),
            nn.BatchNorm2d(16),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(4),  # 400 -> 100

            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(4),  # 100 -> 25

            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(5),  # 25 -> 5

            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.AdaptiveAvgPool2d(1),  # 5 -> 1
        )

        self.classifier = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(128, 1),
        )

    def forward(self, x):
        x = self.features(x)
        x = x.view(x.size(0), -1)
        x = self.classifier(x)
        return x


# ============================================================
# DATASET EXTRACTION FROM GEOTIFF
# ============================================================

def normalize_sar_db(arr_db):
    """Normalize SAR backscatter in dB [-35 to -10 dB] to [0.05, 0.95]."""
    clipped = np.clip(arr_db, -35.0, -10.0)
    norm = 0.05 + 0.90 * ((clipped + 35.0) / 25.0)
    return norm.astype(np.float32)


def extract_patches_from_tiff(tiff_path, patch_size=400):
    """
    Extracts positive (oil slick) and negative (clean sea) patches from a 2048x2048 GeoTIFF.
    """
    try:
        data = tifffile.imread(str(tiff_path))
    except Exception as e:
        return [], []

    # Handle shape (2048, 2048, 2) or (2, 2048, 2048)
    if data.ndim == 3:
        if data.shape[-1] == 2:
            vv = data[:, :, 1]
        else:
            vv = data[1]
    elif data.ndim == 2:
        vv = data
    else:
        return [], []

    h, w = vv.shape
    if h < patch_size or w < patch_size:
        return [], []

    # Filter out nodata / nan / land / zero-padding
    valid_mask = np.isfinite(vv) & (vv > -60.0) & (vv < 15.0)
    if valid_mask.sum() / (h * w) < 0.6:
        return [], []

    scene_p50 = float(np.percentile(vv[valid_mask], 50))
    oil_patches = []
    clean_patches = []

    # Grid sampling across the scene
    step = 280
    for y in range(0, h - patch_size + 1, step):
        for x in range(0, w - patch_size + 1, step):
            patch = vv[y:y + patch_size, x:x + patch_size]
            p_valid = valid_mask[y:y + patch_size, x:x + patch_size]
            if p_valid.sum() / (patch_size * patch_size) < 0.96:
                continue

            p10 = float(np.percentile(patch, 10))
            p50 = float(np.percentile(patch, 50))
            mean_val = float(np.mean(patch))

            # Damping ratio relative to ambient scene
            damping = scene_p50 - p10

            norm_patch = normalize_sar_db(patch)

            # Class 1: Oil Slick (Substantial damping >= 3.5 dB below scene ambient, and dark core)
            if damping >= 3.5 and p10 < -23.0:
                oil_patches.append((norm_patch * 255.0).astype(np.uint8))
            # Class 0: Clean Sea (Homogeneous ambient sea surface, no significant damping)
            elif damping < 1.8 and p10 > (scene_p50 - 2.0) and mean_val > -22.0:
                clean_patches.append((norm_patch * 255.0).astype(np.uint8))

    return oil_patches, clean_patches


def prepare_dataset():
    from concurrent.futures import ThreadPoolExecutor, as_completed

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = CACHE_DIR / "dataset_full_1200.npz"

    if cache_file.exists():
        print(f"Loading cached full dataset from {cache_file}...")
        data = np.load(cache_file)
        return data["patches"], data["labels"]

    tiff_files = sorted(list(TIFF_DIR.glob("*.tif")))
    if not tiff_files:
        raise FileNotFoundError(f"No .tif files found in {TIFF_DIR}")

    if MAX_SCENES is None:
        selected_tiffs = tiff_files
    else:
        step = max(1, len(tiff_files) // MAX_SCENES)
        selected_tiffs = tiff_files[::step][:MAX_SCENES]

    print(f"Found {len(tiff_files)} GeoTIFF scenes. Extracting ALL {len(selected_tiffs)} scenes with {WORKER_THREADS} threads...")
    t0 = time.time()

    all_oil = []
    all_clean = []
    completed_count = 0

    with ThreadPoolExecutor(max_workers=WORKER_THREADS) as executor:
        futures = {executor.submit(extract_patches_from_tiff, f, IMG_SIZE): f for f in selected_tiffs}
        for fut in as_completed(futures):
            completed_count += 1
            oil, clean = fut.result()
            all_oil.extend(oil)
            all_clean.extend(clean)

            if completed_count % 100 == 0 or completed_count == len(selected_tiffs):
                dt = time.time() - t0
                rate = completed_count / dt
                print(f"  [{completed_count:4d}/{len(selected_tiffs)}] Scenes ({completed_count/len(selected_tiffs):.1%}) | "
                      f"Oil: {len(all_oil):5d} | Clean: {len(all_clean):5d} | "
                      f"{rate:.1f} scenes/s | Elapsed: {dt:.0f}s")

    print(f"\nExtraction complete in {time.time()-t0:.1f}s: Total {len(all_oil)} oil patches, {len(all_clean)} clean patches.")

    min_count = min(len(all_oil), len(all_clean))
    if min_count == 0:
        raise ValueError("Could not extract balanced patches. Check damping thresholds.")

    print(f"Balancing dataset: selecting {min_count} oil patches and {min_count} clean ocean patches")

    random.shuffle(all_oil)
    random.shuffle(all_clean)
    all_oil = all_oil[:min_count]
    all_clean = all_clean[:min_count]

    patches = np.array(all_oil + all_clean, dtype=np.uint8)
    labels = np.array([1.0] * len(all_oil) + [0.0] * len(all_clean), dtype=np.float32)

    perm = np.random.permutation(len(labels))
    patches = patches[perm]
    labels = labels[perm]

    print(f"Total dataset: {len(labels)} patches of shape {patches[0].shape}, RAM footprint: {patches.nbytes / 1e6:.1f} MB")
    np.savez_compressed(cache_file, patches=patches, labels=labels)
    print(f"Cached full dataset to {cache_file}")

    return patches, labels


# ============================================================
# PYTORCH DATASET
# ============================================================

class PatchDataset(Dataset):
    def __init__(self, patches, labels, augment=False):
        self.patches = patches
        self.labels = labels
        self.augment = augment

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        # Convert uint8 [0-255] back to float32 [0.0-1.0]
        arr = self.patches[idx].astype(np.float32) / 255.0
        label = self.labels[idx]

        if self.augment:
            if random.random() > 0.5:
                arr = np.fliplr(arr).copy()
            if random.random() > 0.5:
                arr = np.flipud(arr).copy()
            if random.random() > 0.5:
                arr = np.rot90(arr, k=random.choice([1, 2, 3])).copy()
            jitter = random.uniform(0.92, 1.08)
            arr = np.clip(arr * jitter, 0.0, 1.0)

        tensor = torch.from_numpy(arr).unsqueeze(0)  # (1, 400, 400)
        return tensor, torch.tensor(label, dtype=torch.float32)


# ============================================================
# TRAINING & EVALUATION LOOPS
# ============================================================

def train_one_epoch(model, loader, criterion, optimizer, device):
    model.train()
    total_loss, correct, total = 0.0, 0, 0

    for batch_x, batch_y in loader:
        batch_x, batch_y = batch_x.to(device), batch_y.to(device)
        optimizer.zero_grad()
        logits = model(batch_x).squeeze(1)
        loss = criterion(logits, batch_y)
        loss.backward()
        optimizer.step()

        total_loss += loss.item() * batch_x.size(0)
        preds = (torch.sigmoid(logits) > 0.5).float()
        correct += (preds == batch_y).sum().item()
        total += batch_x.size(0)

    return total_loss / total, correct / total


def evaluate(model, loader, criterion, device):
    model.eval()
    total_loss, correct, total = 0.0, 0, 0
    all_preds, all_labels = [], []

    with torch.no_grad():
        for batch_x, batch_y in loader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            logits = model(batch_x).squeeze(1)
            loss = criterion(logits, batch_y)

            total_loss += loss.item() * batch_x.size(0)
            probs = torch.sigmoid(logits)
            preds = (probs > 0.5).float()
            correct += (preds == batch_y).sum().item()
            total += batch_x.size(0)

            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(batch_y.cpu().numpy())

    acc = correct / total
    all_preds = np.array(all_preds)
    all_labels = np.array(all_labels)
    tp = ((all_preds == 1) & (all_labels == 1)).sum()
    fp = ((all_preds == 1) & (all_labels == 0)).sum()
    fn = ((all_preds == 0) & (all_labels == 1)).sum()
    precision = tp / (tp + fp + 1e-8)
    recall = tp / (tp + fn + 1e-8)
    f1 = 2 * precision * recall / (precision + recall + 1e-8)

    return total_loss / total, acc, precision, recall, f1


def export_onnx(model, device):
    OUTPUT_ONNX.parent.mkdir(parents=True, exist_ok=True)

    model.eval().to("cpu")
    dummy = torch.randn(1, 1, IMG_SIZE, IMG_SIZE)

    torch.onnx.export(
        model, dummy, str(OUTPUT_ONNX),
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
        opset_version=14,
    )

    size_kb = os.path.getsize(OUTPUT_ONNX) / 1024
    print(f"\n[SUCCESS] Exported ONNX model to {OUTPUT_ONNX} ({size_kb:.1f} KB)")


def save_demo_samples(patches, labels):
    DEMO_DIR.mkdir(parents=True, exist_ok=True)

    oil_idx = np.where(labels == 1.0)[0]
    clean_idx = np.where(labels == 0.0)[0]

    for i in range(min(10, len(oil_idx))):
        img_arr = patches[oil_idx[i]]
        if img_arr.dtype != np.uint8:
            img_arr = (img_arr * 255.0).astype(np.uint8)
        img = Image.fromarray(img_arr, mode="L")
        img.save(DEMO_DIR / f"class_1_{i+1:02d}.jpg")
        img.save(DEMO_DIR / f"class_1_{i+1}.jpg")

    for i in range(min(10, len(clean_idx))):
        img_arr = patches[clean_idx[i]]
        if img_arr.dtype != np.uint8:
            img_arr = (img_arr * 255.0).astype(np.uint8)
        img = Image.fromarray(img_arr, mode="L")
        img.save(DEMO_DIR / f"class_0_{i+1:02d}.jpg")
        img.save(DEMO_DIR / f"class_0_{i+1}.jpg")

    print(f"[SUCCESS] Exported 20 demo SAR evaluation images to {DEMO_DIR}")


# ============================================================
# MAIN PIPELINE
# ============================================================

def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    if device.type == "cuda":
        print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"PyTorch Version: {torch.__version__}\n")

    patches, labels = prepare_dataset()

    n = len(labels)
    n_train = int(n * 0.70)
    n_val = int(n * 0.15)

    train_patches, train_labels = patches[:n_train], labels[:n_train]
    val_patches, val_labels = patches[n_train:n_train + n_val], labels[n_train:n_train + n_val]
    test_patches, test_labels = patches[n_train + n_val:], labels[n_train + n_val:]

    print(f"Split: Train={len(train_labels)} | Val={len(val_labels)} | Test={len(test_labels)}\n")

    train_ds = PatchDataset(train_patches, train_labels, augment=True)
    val_ds = PatchDataset(val_patches, val_labels, augment=False)
    test_ds = PatchDataset(test_patches, test_labels, augment=False)

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    model = OilSpillCNN().to(device)
    print(f"Model Parameters: {sum(p.numel() for p in model.parameters()):,}\n")

    criterion = nn.BCEWithLogitsLoss()
    optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="min", patience=3, factor=0.5)

    best_val_f1 = 0.0
    best_state = None

    print(f"{'Ep':>3} | {'TrLoss':>7} | {'TrAcc':>6} | {'VLoss':>7} | {'VAcc':>6} | {'VF1':>5} | {'LR':>8} | {'Time':>5}")
    print("-" * 72)

    for epoch in range(1, EPOCHS + 1):
        t0 = time.time()
        tr_loss, tr_acc = train_one_epoch(model, train_loader, criterion, optimizer, device)
        v_loss, v_acc, v_prec, v_rec, v_f1 = evaluate(model, val_loader, criterion, device)
        scheduler.step(v_loss)

        lr = optimizer.param_groups[0]["lr"]
        dt = time.time() - t0

        print(f"{epoch:3d} | {tr_loss:7.4f} | {tr_acc:5.1%} | {v_loss:7.4f} | {v_acc:5.1%} | {v_f1:5.3f} | {lr:.1e} | {dt:4.1f}s")

        if v_f1 > best_val_f1:
            best_val_f1 = v_f1
            best_state = {k: v.clone() for k, v in model.state_dict().items()}

    if best_state:
        model.load_state_dict(best_state)

    print("\n" + "=" * 50)
    print("HOLDOUT TEST SET EVALUATION")
    print("=" * 50)
    t_loss, t_acc, t_prec, t_rec, t_f1 = evaluate(model, test_loader, criterion, device)
    print(f"Test Accuracy:  {t_acc:.1%}")
    print(f"Test Precision: {t_prec:.3f}")
    print(f"Test Recall:    {t_rec:.3f}")
    print(f"Test F1-Score:  {t_f1:.3f}")

    export_onnx(model, device)
    save_demo_samples(test_patches, test_labels)
    print("\n[COMPLETE] Model training and website export finished successfully!")


if __name__ == "__main__":
    main()
