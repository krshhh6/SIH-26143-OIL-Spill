"""
SpillSense (SIH-26143) — Standalone ONNX Exporter & Verification
================================================================
Exports the trained dual-polarization PyTorch model to browser-compatible ONNX,
verifies numerical equivalence, and produces frontend metadata.
"""

import json
from pathlib import Path
import numpy as np
import torch
import onnxruntime as ort

from ml.config import CONFIG, SpillSenseConfig
from ml.models import get_model
from ml.train import export_onnx_model


def export_and_verify(
    checkpoint_path: Path = None,
    output_onnx: Path = None,
    config: SpillSenseConfig = CONFIG
):
    if checkpoint_path is None:
        checkpoint_path = config.checkpoint_dir / "best_dualpol_classifier.pt"
    if output_onnx is None:
        output_onnx = config.output_onnx_path

    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Checkpoint not found at {checkpoint_path}")

    print(f"Loading checkpoint from {checkpoint_path}...")
    ckpt = torch.load(checkpoint_path, map_location="cpu", weights_only=False)

    model = get_model(in_channels=config.in_channels)
    model.load_state_dict(ckpt["model_state"])
    model.eval()

    # Export to ONNX
    size_kb = export_onnx_model(model, output_onnx, config.patch_size)

    # Verification with ONNX Runtime
    print("\nVerifying ONNX Runtime numerical equivalence...")
    session = ort.InferenceSession(str(output_onnx), providers=["CPUExecutionProvider"])
    
    dummy_np = np.random.randn(2, 2, config.patch_size, config.patch_size).astype(np.float32)
    dummy_torch = torch.from_numpy(dummy_np)

    with torch.no_grad():
        torch_out = model(dummy_torch).numpy()

    onnx_out = session.run(["output"], {"input": dummy_np})[0]

    max_diff = np.max(np.abs(torch_out - onnx_out))
    print(f"PyTorch vs ONNX Max Absolute Difference: {max_diff:.2e}")
    assert max_diff < 1e-4, f"Discrepancy too high ({max_diff}) between PyTorch and ONNX!"

    print("[SUCCESS] ONNX model successfully verified and ready for browser deployment.")
    return size_kb


if __name__ == "__main__":
    export_and_verify()
