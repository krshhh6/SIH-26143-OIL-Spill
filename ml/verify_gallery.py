"""Quick verification of fine-tuned model on gallery demo images."""
import torch
import numpy as np
from pathlib import Path
from PIL import Image
from ml.config import CONFIG
from ml.models import get_classifier

# Load fine-tuned model
ckpt = torch.load(CONFIG.checkpoint_dir / 'best_classifier_v3.pt', map_location='cpu', weights_only=False)
model = get_classifier(2)
model.load_state_dict(ckpt['model_state'])
model.eval()
threshold = ckpt.get('best_threshold', 0.45)
print(f'Threshold: {threshold:.2f}')

demo_dir = CONFIG.demo_dir

print('\n=== CLASS 1 (Oil Spill) Gallery Images ===')
for n in [3, 5, 6, 7, 9]:
    p = demo_dir / f'class_1_{n}.jpg'
    if not p.exists():
        print(f'  class_1_{n}.jpg: MISSING')
        continue
    img = Image.open(p).convert('L').resize((400, 400))
    arr = np.array(img, dtype=np.float32) / 255.0
    # Create 2-channel input (VV + VH approximation from grayscale)
    inp = torch.from_numpy(np.stack([arr, arr * 0.85], axis=0)).unsqueeze(0).float()
    with torch.no_grad():
        logit = model(inp).squeeze().item()
    prob = 1.0 / (1.0 + np.exp(-max(-20, min(20, logit))))
    decision = 'OIL' if prob >= threshold else 'CLEAN'
    ok = 'OK' if decision == 'OIL' else 'WRONG'
    print(f'  class_1_{n}.jpg: P={prob:.4f} -> {decision} [{ok}]')

print('\n=== CLASS 0 (Clean) Gallery Images ===')
for n in [1, 2, 3, 6, 7]:
    p = demo_dir / f'class_0_{n}.jpg'
    if not p.exists():
        print(f'  class_0_{n}.jpg: MISSING')
        continue
    img = Image.open(p).convert('L').resize((400, 400))
    arr = np.array(img, dtype=np.float32) / 255.0
    inp = torch.from_numpy(np.stack([arr, arr * 0.85], axis=0)).unsqueeze(0).float()
    with torch.no_grad():
        logit = model(inp).squeeze().item()
    prob = 1.0 / (1.0 + np.exp(-max(-20, min(20, logit))))
    decision = 'OIL' if prob >= threshold else 'CLEAN'
    ok = 'OK' if decision == 'CLEAN' else 'WRONG'
    print(f'  class_0_{n}.jpg: P={prob:.4f} -> {decision} [{ok}]')

print('\nVerification complete.')
