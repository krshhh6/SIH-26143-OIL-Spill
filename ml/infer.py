"""
SpillSense (SIH-26143) — Standalone SAR Inference Engine
========================================================
Runs oil spill inference on raw Sentinel-1 GeoTIFF scenes or image patches.
Generates:
- Oil probability & binary class prediction
- Classification confidence score
- Visual high-contrast preview
- Sliding-window spatial spill probability heatmap overlay
"""

import argparse
import json
import time
from pathlib import Path
from typing import Dict, Any, Tuple, Optional

import numpy as np
from PIL import Image
import onnxruntime as ort

from ml.config import CONFIG, SpillSenseConfig
from ml.preprocess import load_sentinel1_scene, normalize_sar_dualpol


def sigmoid(x: float) -> float:
    return float(1.0 / (1.0 + np.exp(-x)))


class SARInferenceEngine:
    def __init__(
        self, 
        onnx_model_path: Path = None, 
        metadata_path: Path = None,
        config: SpillSenseConfig = CONFIG
    ):
        self.config = config
        self.model_path = onnx_model_path or config.output_onnx_path
        self.metadata_path = metadata_path or config.model_metadata_path

        if not self.model_path.exists():
            raise FileNotFoundError(f"ONNX model not found at {self.model_path}. Train/export first.")

        self.session = ort.InferenceSession(str(self.model_path), providers=["CPUExecutionProvider"])
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name

        # Load optimal decision threshold from metadata if available
        self.threshold = config.default_threshold
        if self.metadata_path.exists():
            try:
                with open(self.metadata_path, "r") as f:
                    meta = json.load(f)
                    self.threshold = float(meta.get("optimal_threshold", config.default_threshold))
            except Exception:
                pass

        print(f"[INFER ENGINE] Loaded ONNX model from {self.model_path.name} (Threshold: {self.threshold:.2f})")

    def infer_patch(self, patch_dualpol: np.ndarray) -> Dict[str, Any]:
        """
        Runs inference on a single 2-channel patch (2, 400, 400).
        """
        t0 = time.time()
        tensor = patch_dualpol[np.newaxis, :, :, :] # (1, 2, 400, 400)
        
        out = self.session.run([self.output_name], {self.input_name: tensor})[0]
        logit = float(out[0][0])
        prob = sigmoid(logit)

        is_oil = prob >= self.threshold
        confidence = prob if is_oil else (1.0 - prob)
        dt_ms = (time.time() - t0) * 1000.0

        return {
            "prediction": "oil_spill" if is_oil else "clean_sea",
            "oil_probability": prob,
            "confidence": confidence,
            "logit": logit,
            "threshold": self.threshold,
            "latency_ms": round(dt_ms, 2)
        }

    def infer_scene(
        self, 
        tiff_path: Path, 
        stride: int = 200, 
        output_heatmap_path: Optional[Path] = None
    ) -> Dict[str, Any]:
        """
        Performs sliding-window inference across an entire Sentinel-1 GeoTIFF scene.
        Generates a 2D probability map and marks suspected slick coordinates.
        """
        t0 = time.time()
        print(f"Ingesting scene {tiff_path.name} for sliding-window inference...")
        vv, vh, valid_mask = load_sentinel1_scene(tiff_path)
        norm_scene = normalize_sar_dualpol(vv, vh, self.config) # (2, H, W)

        h, w = vv.shape
        p_sz = self.config.patch_size
        
        # Heatmap grid
        y_steps = list(range(0, h - p_sz + 1, stride))
        x_steps = list(range(0, w - p_sz + 1, stride))
        
        heatmap = np.zeros((len(y_steps), len(x_steps)), dtype=np.float32)
        batch_patches = []
        batch_coords = []
        
        print(f"Scanning {len(y_steps) * len(x_steps)} patches across {w}x{h} scene...")
        for yi, y in enumerate(y_steps):
            for xi, x in enumerate(x_steps):
                p_valid = valid_mask[y:y + p_sz, x:x + p_sz]
                if np.sum(p_valid) / (p_sz * p_sz) < 0.80:
                    continue

                patch = norm_scene[:, y:y + p_sz, x:x + p_sz]
                batch_patches.append(patch)
                batch_coords.append((yi, xi))

        # Batch run through ONNX
        batch_size = 32
        for b_start in range(0, len(batch_patches), batch_size):
            b_patches = np.stack(batch_patches[b_start:b_start + batch_size], axis=0)
            outputs = self.session.run([self.output_name], {self.input_name: b_patches})[0]
            logits = outputs.squeeze(-1)
            for i, logit in enumerate(logits):
                prob = sigmoid(float(logit))
                yi, xi = batch_coords[b_start + i]
                heatmap[yi, xi] = prob

        max_prob = float(np.max(heatmap))
        mean_prob = float(np.mean(heatmap[heatmap > 0])) if np.any(heatmap > 0) else 0.0
        oil_detected = max_prob >= self.threshold

        dt_s = time.time() - t0
        print(f"Inference completed in {dt_s:.2f}s: Max Spill Prob = {max_prob:.1%}")

        # Render visual heatmap overlay if path provided
        if output_heatmap_path:
            output_heatmap_path.parent.mkdir(parents=True, exist_ok=True)
            # Create base VV grayscale image
            vv_uint8 = (norm_scene[0] * 255.0).astype(np.uint8)
            base_img = Image.fromarray(vv_uint8, mode="L").convert("RGB")
            
            # Upsample heatmap to full scene dimension
            heat_img = Image.fromarray((heatmap * 255.0).astype(np.uint8), mode="L")
            heat_resized = heat_img.resize((w, h), Image.Resampling.BILINEAR)
            heat_np = np.array(heat_resized, dtype=np.float32) / 255.0

            # Red overlay for oil spill probability
            base_np = np.array(base_img)
            overlay = base_np.copy()
            red_mask = heat_np > self.threshold
            overlay[red_mask, 0] = np.clip(overlay[red_mask, 0] * 0.4 + 255 * 0.6, 0, 255).astype(np.uint8)
            overlay[red_mask, 1] = (overlay[red_mask, 1] * 0.4).astype(np.uint8)
            overlay[red_mask, 2] = (overlay[red_mask, 2] * 0.4).astype(np.uint8)

            result_img = Image.fromarray(overlay)
            result_img.save(str(output_heatmap_path))
            print(f"[OVERLAY SAVED] Saved visual spill heatmap to {output_heatmap_path}")

        return {
            "scene": tiff_path.name,
            "max_oil_probability": max_prob,
            "mean_oil_probability": mean_prob,
            "oil_detected": oil_detected,
            "threshold": self.threshold,
            "latency_seconds": round(dt_s, 2)
        }


def main():
    parser = argparse.ArgumentParser(description="SpillSense SAR Inference")
    parser.add_argument("--scene", type=str, default=None, help="Path to input Sentinel-1 GeoTIFF")
    parser.add_argument("--patch", type=str, default=None, help="Path to input image patch")
    parser.add_argument("--output", type=str, default="ml/inference_output.png", help="Path to output visual heatmap")
    args = parser.parse_args()

    engine = SARInferenceEngine()

    if args.scene:
        scene_path = Path(args.scene)
        out_path = Path(args.output)
        res = engine.infer_scene(scene_path, output_heatmap_path=out_path)
        print("\nResult Summary:", json.dumps(res, indent=2))
    elif args.patch:
        img = Image.open(args.patch).convert("L").resize((400, 400))
        arr = np.array(img, dtype=np.float32) / 255.0
        # Synthesize 2-channel input (VV, VH)
        patch = np.stack([arr, np.clip(arr - 0.20, 0.0, 1.0)], axis=0)
        res = engine.infer_patch(patch)
        print("\nPatch Result:", json.dumps(res, indent=2))
    else:
        # Run demo on first scene found in dataset
        scenes = sorted(list(CONFIG.data_dir.glob("*.tif")))
        if scenes:
            scene_path = scenes[0]
            out_path = Path("ml/demo_inference_overlay.png")
            res = engine.infer_scene(scene_path, output_heatmap_path=out_path)
            print("\nDemo Result Summary:", json.dumps(res, indent=2))


if __name__ == "__main__":
    main()
