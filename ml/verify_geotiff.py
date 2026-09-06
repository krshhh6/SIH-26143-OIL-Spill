import time
from pathlib import Path
import tifffile
import numpy as np

tif_path = Path(r"D:\01_Train_Val_Oil_Spill_images\Oil\00000.tif")

print(f"Reading {tif_path.name} ({tif_path.stat().st_size / 1e6:.1f} MB)...")
t0 = time.time()
data = tifffile.imread(str(tif_path))
dt = time.time() - t0

print(f"Read completed in {dt:.3f}s")
print(f"Data shape: {data.shape}, dtype: {data.dtype}")

if data.ndim == 3:
    print(f"Band 0 (VH) min: {np.nanmin(data[0]):.2f} dB, max: {np.nanmax(data[0]):.2f} dB, mean: {np.nanmean(data[0]):.2f} dB")
    print(f"Band 1 (VV) min: {np.nanmin(data[1]):.2f} dB, max: {np.nanmax(data[1]):.2f} dB, mean: {np.nanmean(data[1]):.2f} dB")
