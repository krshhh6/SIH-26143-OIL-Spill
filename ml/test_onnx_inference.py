import json
from pathlib import Path
import numpy as np
from PIL import Image
import onnxruntime as ort

model_path = Path(r"d:\Spill Sense\SIH-26143-OIL-Spill\frontend\public\models\oil_classifier.onnx")
meta_path = Path(r"d:\Spill Sense\SIH-26143-OIL-Spill\frontend\public\models\model_metadata.json")
demo_dir = Path(r"d:\Spill Sense\SIH-26143-OIL-Spill\frontend\public\demo-sar")

session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])

threshold = 0.50
if meta_path.exists():
    with open(meta_path, "r") as f:
        meta = json.load(f)
        threshold = float(meta.get("optimal_threshold", 0.50))

print("ONNX Model Input: ", session.get_inputs()[0].name, session.get_inputs()[0].shape)
print("ONNX Model Output:", session.get_outputs()[0].name, session.get_outputs()[0].shape)
print(f"Optimal Threshold: {threshold:.2f}")

test_samples = [
    demo_dir / "class_1_01.jpg",
    demo_dir / "class_1_02.jpg",
    demo_dir / "class_0_01.jpg",
    demo_dir / "class_0_02.jpg",
]

def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))

print("\nRunning test inference on exported demo samples:")
for p in test_samples:
    if not p.exists():
        continue
    img = Image.open(p).convert("L").resize((400, 400))
    arr = np.array(img, dtype=np.float32) / 255.0
    # Channel 0 = VV, Channel 1 = synthesized calibrated VH
    patch_2ch = np.stack([arr, np.clip(arr - 0.22, 0.0, 1.0)], axis=0)
    tensor = patch_2ch[np.newaxis, :, :, :] # (1, 2, 400, 400)
    
    outputs = session.run(["output"], {"input": tensor})
    logit = outputs[0][0][0]
    prob = sigmoid(logit)
    is_oil = prob >= threshold
    pred = "Oil Spill" if is_oil else "Clean Sea"
    conf = prob if is_oil else (1.0 - prob)
    print(f"  {p.name}: Predicted='{pred}' | Conf={conf:.1%} | Logit={logit:.3f} | Prob={prob:.4f}")
