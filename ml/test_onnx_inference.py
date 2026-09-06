import onnxruntime as ort
import numpy as np
from PIL import Image
from pathlib import Path

model_path = r"d:\Spill Sense\SIH-26143-OIL-Spill\frontend\public\models\oil_classifier.onnx"
session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])

demo_dir = Path(r"d:\Spill Sense\SIH-26143-OIL-Spill\frontend\public\demo-sar")

print("ONNX Model Input:", session.get_inputs()[0].name, session.get_inputs()[0].shape)
print("ONNX Model Output:", session.get_outputs()[0].name, session.get_outputs()[0].shape)

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
    tensor = arr[np.newaxis, np.newaxis, :, :] # (1, 1, 400, 400)
    
    outputs = session.run(["output"], {"input": tensor})
    logit = outputs[0][0][0]
    prob = sigmoid(logit)
    pred = "Oil Spill" if prob > 0.5 else "Clean Sea"
    conf = prob if prob > 0.5 else (1 - prob)
    print(f"  {p.name}: Predicted='{pred}' | Conf={conf:.1%} | Logit={logit:.3f} | Prob={prob:.4f}")
