"""
Test model generalization on random UNSEEN Zenodo scenes.
Picks scenes the model was NOT trained on (from later indices)
and verifies correct classification.
"""
import torch
import numpy as np
from pathlib import Path
from ml.config import CONFIG
from ml.models import get_classifier
from ml.preprocess import load_sentinel1_scene, load_mask, normalize_sar_dualpol

# Load model
ckpt = torch.load(CONFIG.checkpoint_dir / 'best_classifier_v3.pt', map_location='cpu', weights_only=False)
model = get_classifier(2)
model.load_state_dict(ckpt['model_state'])
model.eval()
threshold = ckpt.get('best_threshold', 0.27)

def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -20, 20)))

oil_dir = CONFIG.data.find_oil_images()
mask_dir = CONFIG.data.find_oil_masks()
all_tifs = sorted(oil_dir.glob('*.tif'))

print(f'Model threshold: {threshold:.2f}')
print(f'Total scenes available: {len(all_tifs)}')
print('=' * 70)

# Test on scenes from different parts of the dataset
test_indices = [200, 350, 500, 650, 800, 950, 1050, 1100, 1150, 1199]
ps = CONFIG.cls_patch_size  # 400

correct_oil = 0
correct_clean = 0
total_oil = 0
total_clean = 0

for idx in test_indices:
    if idx >= len(all_tifs):
        continue
    tif = all_tifs[idx]
    mask_path = mask_dir / tif.name

    try:
        vv, vh, valid = load_sentinel1_scene(tif)
        mask = load_mask(mask_path)
        if mask is None:
            mask = np.zeros_like(vv, dtype=np.uint8)
    except Exception as e:
        print(f'  [SKIP] {tif.name}: {e}')
        continue

    h, w = vv.shape
    if h < ps or w < ps:
        continue

    has_oil = np.sum(mask > 0) > 500

    # Test oil-centered patch
    if has_oil:
        ys, xs = np.where(mask > 0)
        cy, cx = int(np.median(ys)), int(np.median(xs))
        y = int(np.clip(cy - ps // 2, 0, h - ps))
        x = int(np.clip(cx - ps // 2, 0, w - ps))
        norm = normalize_sar_dualpol(vv[y:y+ps, x:x+ps], vh[y:y+ps, x:x+ps], CONFIG)
        inp = torch.from_numpy(norm).unsqueeze(0).float()
        with torch.no_grad():
            logit = model(inp).squeeze().item()
        prob = float(sigmoid(logit))
        decision = 'OIL' if prob >= threshold else 'CLEAN'
        ok = decision == 'OIL'
        correct_oil += int(ok)
        total_oil += 1
        status = 'OK' if ok else 'MISS'
        print(f'  [{idx:4d}] {tif.name} OIL  patch: P={prob:.4f} -> {decision} [{status}]')

    # Test clean patch (no-oil region)
    for ty in range(0, h - ps + 1, ps):
        for tx in range(0, w - ps + 1, ps):
            if np.any(mask[ty:ty+ps, tx:tx+ps] > 0):
                continue
            # Found a clean region
            norm = normalize_sar_dualpol(vv[ty:ty+ps, tx:tx+ps], vh[ty:ty+ps, tx:tx+ps], CONFIG)
            inp = torch.from_numpy(norm).unsqueeze(0).float()
            with torch.no_grad():
                logit = model(inp).squeeze().item()
            prob = float(sigmoid(logit))
            decision = 'OIL' if prob >= threshold else 'CLEAN'
            ok = decision == 'CLEAN'
            correct_clean += int(ok)
            total_clean += 1
            status = 'OK' if ok else 'FP'
            print(f'  [{idx:4d}] {tif.name} CLEAN patch: P={prob:.4f} -> {decision} [{status}]')
            break
        else:
            continue
        break

print(f'\n{"="*70}')
print(f'GENERALIZATION TEST RESULTS')
print(f'{"="*70}')
print(f'Oil patches:   {correct_oil}/{total_oil} correct ({100*correct_oil/max(1,total_oil):.0f}%)')
print(f'Clean patches: {correct_clean}/{total_clean} correct ({100*correct_clean/max(1,total_clean):.0f}%)')
print(f'Overall:       {correct_oil+correct_clean}/{total_oil+total_clean} correct ({100*(correct_oil+correct_clean)/max(1,total_oil+total_clean):.0f}%)')
