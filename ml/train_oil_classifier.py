"""
SAR Oil Spill Classifier - Training Script
===========================================
Dataset: CSIRO Sentinel-1 SAR Oil/Non-Oil (5,538 images, 400x400)
Architecture: Compact 5-layer ConvNet (~500KB ONNX)
Output: frontend/public/models/oil_classifier.onnx
"""

import os
import sys
import random
import shutil
import time
import numpy as np
from pathlib import Path
from PIL import Image

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler

# ============================================================
# CONFIGURATION
# ============================================================

DATASET_DIR = Path(r"C:\Users\krish\Downloads\archive\kaggle\data")
OUTPUT_DIR = Path(r"d:\SIH 26143\frontend\public\models")
DEMO_DIR = Path(r"d:\SIH 26143\frontend\public\demo-sar")

IMG_SIZE = 400
BATCH_SIZE = 32
EPOCHS = 30
LR = 1e-3
SEED = 42

random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)


# ============================================================
# DATASET
# ============================================================

class SARDataset(Dataset):
    def __init__(self, file_list, labels, augment=False):
        self.file_list = file_list
        self.labels = labels
        self.augment = augment

    def __len__(self):
        return len(self.file_list)

    def __getitem__(self, idx):
        img_path = self.file_list[idx]
        label = self.labels[idx]

        img = Image.open(img_path).convert("L")
        img = img.resize((IMG_SIZE, IMG_SIZE), Image.BILINEAR)

        arr = np.array(img, dtype=np.float32) / 255.0

        if self.augment:
            if random.random() > 0.5:
                arr = np.fliplr(arr).copy()
            if random.random() > 0.5:
                arr = np.flipud(arr).copy()
            jitter = random.uniform(0.85, 1.15)
            arr = np.clip(arr * jitter, 0, 1)

        tensor = torch.from_numpy(arr).unsqueeze(0)
        return tensor, torch.tensor(label, dtype=torch.float32)


# ============================================================
# MODEL
# ============================================================

class OilSpillCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 16, kernel_size=3, padding=1),
            nn.BatchNorm2d(16),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(4),

            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(4),

            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(5),

            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.AdaptiveAvgPool2d(1),
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
# TRAINING FUNCTIONS
# ============================================================

def load_dataset():
    files_0 = sorted((DATASET_DIR / "Class_0").glob("*.jpg"))
    files_1 = sorted((DATASET_DIR / "Class_1").glob("*.jpg"))
    print(f"Class 0 (No Oil): {len(files_0)} images")
    print(f"Class 1 (Oil):    {len(files_1)} images")

    all_files = [(f, 0) for f in files_0] + [(f, 1) for f in files_1]
    random.shuffle(all_files)
    files = [f for f, _ in all_files]
    labels = [l for _, l in all_files]
    return files, labels


def split_dataset(files, labels):
    n = len(files)
    n_train = int(n * 0.70)
    n_val = int(n * 0.15)

    train_f, train_l = files[:n_train], labels[:n_train]
    val_f, val_l = files[n_train:n_train + n_val], labels[n_train:n_train + n_val]
    test_f, test_l = files[n_train + n_val:], labels[n_train + n_val:]

    print(f"Split: Train={len(train_f)} Val={len(val_f)} Test={len(test_f)}")
    return (train_f, train_l), (val_f, val_l), (test_f, test_l)


def train_one_epoch(model, loader, criterion, optimizer, device):
    model.train()
    total_loss, correct, total = 0, 0, 0

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
    total_loss, correct, total = 0, 0, 0
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
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    onnx_path = OUTPUT_DIR / "oil_classifier.onnx"

    model.eval()
    dummy = torch.randn(1, 1, IMG_SIZE, IMG_SIZE).to(device)

    torch.onnx.export(
        model, dummy, str(onnx_path),
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
        opset_version=13,
    )

    size_kb = os.path.getsize(onnx_path) / 1024
    print(f"\nONNX exported: {onnx_path} ({size_kb:.0f} KB)")


def copy_demo_samples():
    DEMO_DIR.mkdir(parents=True, exist_ok=True)

    for cls, label in [("Class_0", "class_0"), ("Class_1", "class_1")]:
        files = sorted((DATASET_DIR / cls).glob("*.jpg"))
        step = max(1, len(files) // 10)
        selected = [files[i * step] for i in range(10) if i * step < len(files)]

        for i, f in enumerate(selected):
            dest = DEMO_DIR / f"{label}_{i+1:02d}.jpg"
            shutil.copy2(f, dest)

    print(f"Demo samples copied to {DEMO_DIR}")


# ============================================================
# MAIN
# ============================================================

def main():
    device = torch.device("cpu")
    print(f"Device: {device} | PyTorch: {torch.__version__}\n")

    files, labels = load_dataset()
    (train_f, train_l), (val_f, val_l), (test_f, test_l) = split_dataset(files, labels)

    train_ds = SARDataset(train_f, train_l, augment=True)
    val_ds = SARDataset(val_f, val_l)
    test_ds = SARDataset(test_f, test_l)

    class_counts = np.bincount(train_l)
    sample_weights = [1.0 / class_counts[l] for l in train_l]
    sampler = WeightedRandomSampler(sample_weights, len(sample_weights))

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, sampler=sampler, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, num_workers=0)
    test_loader = DataLoader(test_ds, batch_size=BATCH_SIZE, num_workers=0)

    model = OilSpillCNN().to(device)
    print(f"Parameters: {sum(p.numel() for p in model.parameters()):,}\n")

    criterion = nn.BCEWithLogitsLoss(pos_weight=torch.tensor([2.0]).to(device))
    optimizer = optim.Adam(model.parameters(), lr=LR)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)

    best_val_acc = 0
    best_state = None

    print(f"{'Ep':>3} | {'TrLoss':>7} | {'TrAcc':>6} | {'VLoss':>7} | {'VAcc':>6} | {'VF1':>5} | {'LR':>8} | {'Time':>5}")
    print("-" * 70)

    for epoch in range(1, EPOCHS + 1):
        t0 = time.time()
        tr_loss, tr_acc = train_one_epoch(model, train_loader, criterion, optimizer, device)
        v_loss, v_acc, v_prec, v_rec, v_f1 = evaluate(model, val_loader, criterion, device)
        scheduler.step(v_loss)

        lr = optimizer.param_groups[0]['lr']
        dt = time.time() - t0

        print(f"{epoch:3d} | {tr_loss:7.4f} | {tr_acc:5.1%} | {v_loss:7.4f} | {v_acc:5.1%} | {v_f1:5.3f} | {lr:.1e} | {dt:4.1f}s")

        if v_acc > best_val_acc:
            best_val_acc = v_acc
            best_state = {k: v.clone() for k, v in model.state_dict().items()}

    if best_state:
        model.load_state_dict(best_state)

    print("\n" + "=" * 50)
    print("TEST SET EVALUATION")
    print("=" * 50)
    _, t_acc, t_prec, t_rec, t_f1 = evaluate(model, test_loader, criterion, device)
    print(f"Accuracy:  {t_acc:.1%}")
    print(f"Precision: {t_prec:.3f}")
    print(f"Recall:    {t_rec:.3f}")
    print(f"F1 Score:  {t_f1:.3f}")

    export_onnx(model, device)
    copy_demo_samples()
    print("\nDone!")


if __name__ == "__main__":
    main()
