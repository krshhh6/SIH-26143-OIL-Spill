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

def convert_single_tiff(tiff_path: Path, output_path: Path, target_size: int = None, extract_patch: bool = False):
    """Reads a Sentinel-1 SAR GeoTIFF and writes a high-contrast PNG."""
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

    # Normalize VV polarization
    vv_img = normalize_sar_vv(vv)
    pil_img = Image.fromarray(vv_img, mode='L')

    if target_size:
        pil_img = pil_img.resize((target_size, target_size), Image.Resampling.BILINEAR)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    pil_img.save(str(output_path), quality=95)
    print(f" Saved: {output_path} ({pil_img.size[0]}x{pil_img.size[1]})")

def main():
    parser = argparse.ArgumentParser(description="Convert SAR GeoTIFF (.tif) to web-standard PNG/JPG")
    parser.add_argument("--input", type=str, default=r"D:\01_Train_Val_Oil_Spill_images\Oil\00000.tif", help="Path to input .tif")
    parser.add_argument("--output", type=str, default="frontend/public/imagery/custom_sar.png", help="Path to output PNG")
    parser.add_argument("--size", type=int, default=800, help="Resize dimension (default 800px)")
    parser.add_argument("--batch", type=int, default=0, help="Batch convert N scenes from dataset")
    parser.add_argument("--dest", type=str, default="frontend/public/demo-sar/", help="Destination for batch")
    args = parser.parse_args()

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
            convert_single_tiff(tiff_path, out_file, target_size=args.size)
        print("Batch conversion completed!")
    else:
        in_path = Path(args.input)
        if not in_path.exists():
            print(f"Error: input file {in_path} not found.")
            sys.exit(1)
        out_path = Path(args.output)
        convert_single_tiff(in_path, out_path, target_size=args.size)

if __name__ == "__main__":
    main()
