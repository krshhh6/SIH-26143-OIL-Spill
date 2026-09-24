"""
Spill Sense (SIH26143) — GeoTIFF to Web-Friendly Image Converter
==============================================================
Converts 32-bit floating-point Sentinel-1 SAR GeoTIFF (.tif) scenes
(VV/VH polarization in dB) into web-standard PNG/JPEG images.

Usage:
  python ml/convert_geotiff_to_png.py --input "D:\\01_Train_Val_Oil_Spill_images\\Oil\\00000.tif" --output "frontend/public/imagery/sar_00000.png"
  python ml/convert_geotiff_to_png.py --batch 10 --dest "frontend/public/demo-sar/"
"""

import sys
import argparse
from pathlib import Path
import numpy as np
import tifffile
from PIL import Image

def normalize_sar_vv(vv_db: np.ndarray, clip_min: float = -35.0, clip_max: float = -10.0) -> np.ndarray:
    """Normalizes SAR radar backscatter (in dB) to 0-255 grayscale."""
    clipped = np.clip(vv_db, clip_min, clip_max)
    normalized = (clipped - clip_min) / (clip_max - clip_min)
    return (normalized * 255.0).astype(np.uint8)

def auto_detect_slick_roi_db(vv_db: np.ndarray, patch_size: int = 400) -> tuple:
    """Finds the 1:1 patch with the highest capillary wave damping depression."""
    h, w = vv_db.shape
    if h <= patch_size or w <= patch_size:
        min_dim = min(h, w)
        return (0, 0, min_dim, min_dim)
    
    # Valid marine radar range: [-35, -5] dB
    valid_mask = (vv_db > -38.0) & (vv_db < 0.0)
    # Capillary wave damping in oil slicks: typically -32 to -22 dB (depression of 4-12 dB below ocean)
    slick_damped = (vv_db < -22.0) & valid_mask

    best_score = -1
    best_x, best_y = (w - patch_size) // 2, (h - patch_size) // 2
    step = max(32, patch_size // 8)

    for y in range(0, h - patch_size, step):
        for x in range(0, w - patch_size, step):
            win_valid = valid_mask[y:y + patch_size, x:x + patch_size]
            if win_valid.sum() < (patch_size * patch_size) * 0.3:
                continue
            win_damped = slick_damped[y:y + patch_size, x:x + patch_size]
            score = win_damped.sum() / max(1, win_valid.sum())
            if score > best_score:
                best_score = score
                best_x, best_y = x, y

    return (best_x, best_y, patch_size, patch_size)


def convert_single_tiff(
    tiff_path: Path, 
    output_path: Path, 
    target_size: int = None, 
    extract_patch: bool = False,
    patch_size: int = 400,
    crop_roi: tuple = None,
    auto_crop: bool = False
):
    """Reads a Sentinel-1 SAR GeoTIFF and writes a high-contrast PNG or model-compatible crop."""
    print(f"Reading {tiff_path.name}...")
    data = tifffile.imread(str(tiff_path))

    # Sentinel-1 dual-pol: shape (2048, 2048, 2) or (2, 2048, 2048)
    if data.ndim == 3:
        if data.shape[-1] == 2:
            vv = data[:, :, 1]
            vh = data[:, :, 0]
        else:
            vv = data[1]
            vh = data[0]
    elif data.ndim == 2:
        vv = data
        vh = None
    else:
        raise ValueError(f"Unsupported dimensions: {data.shape}")

    # Crop if requested
    if auto_crop:
        x, y, w, h = auto_detect_slick_roi_db(vv, patch_size)
        vv = vv[y:y + h, x:x + w]
        print(f" 🎯 Auto-cropped 1:1 ROI hotspot at ({x}, {y}) size {w}x{h}")
    elif crop_roi:
        x, y, w, h = crop_roi
        vv = vv[y:y + h, x:x + w]
        print(f" ✂️ Cropped ROI at ({x}, {y}) size {w}x{h}")
    elif extract_patch:
        # Center square patch
        h, w = vv.shape
        sz = min(h, w, patch_size)
        sy = (h - sz) // 2
        sx = (w - sz) // 2
        vv = vv[sy:sy + sz, sx:sx + sz]
        print(f" ✂️ Extracted centered {sz}x{sz} patch")

    # Normalize VV polarization
    vv_img = normalize_sar_vv(vv)
    pil_img = Image.fromarray(vv_img, mode='L')

    if target_size:
        pil_img = pil_img.resize((target_size, target_size), Image.Resampling.BILINEAR)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    pil_img.save(str(output_path), quality=95)
    print(f" Saved: {output_path} ({pil_img.size[0]}x{pil_img.size[1]})")

def main():
    parser = argparse.ArgumentParser(description="Convert SAR GeoTIFF (.tif) to web-standard PNG/JPG or model-compatible 1:1 crop")
    parser.add_argument("--input", type=str, default=r"D:\01_Train_Val_Oil_Spill_images\Oil\00000.tif", help="Path to input .tif")
    parser.add_argument("--output", type=str, default="frontend/public/imagery/custom_sar.png", help="Path to output PNG")
    parser.add_argument("--size", type=int, default=800, help="Resize dimension (default 800px)")
    parser.add_argument("--patch-size", type=int, default=400, help="Model patch size (default 400 for DualPolOilSpillNet)")
    parser.add_argument("--auto-crop", action="store_true", help="Auto-detect candidate oil slick ROI and crop 1:1 patch")
    parser.add_argument("--crop", nargs=4, type=int, metavar=('X', 'Y', 'W', 'H'), help="Crop specific ROI (X Y W H)")
    parser.add_argument("--batch", type=int, default=0, help="Batch convert N scenes from dataset")
    parser.add_argument("--dest", type=str, default="frontend/public/demo-sar/", help="Destination for batch")
    args = parser.parse_args()

    crop_roi = tuple(args.crop) if args.crop else None

    if args.batch > 0:
        source_dir = Path(r"D:\01_Train_Val_Oil_Spill_images\Oil")
        if not source_dir.exists():
            print(f"Dataset directory not found: {source_dir}")
            return
        tiffs = sorted(list(source_dir.glob("*.tif")))[:args.batch]
        dest_dir = Path(args.dest)
        dest_dir.mkdir(parents=True, exist_ok=True)
        print(f"Batch converting {len(tiffs)} GeoTIFFs to {dest_dir}...")
        for i, tiff_path in enumerate(tiffs):
            out_file = dest_dir / f"scene_{tiff_path.stem}.jpg"
            convert_single_tiff(
                tiff_path, 
                out_file, 
                target_size=args.size,
                patch_size=args.patch_size,
                auto_crop=args.auto_crop,
                crop_roi=crop_roi
            )
        print("Batch conversion completed!")
    else:
        in_path = Path(args.input)
        if not in_path.exists():
            print(f"Error: input file {in_path} not found.")
            sys.exit(1)
        out_path = Path(args.output)
        convert_single_tiff(
            in_path, 
            out_path, 
            target_size=args.size,
            patch_size=args.patch_size,
            auto_crop=args.auto_crop,
            crop_roi=crop_roi
        )

if __name__ == "__main__":
    main()

