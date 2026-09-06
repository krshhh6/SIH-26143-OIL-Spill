from pathlib import Path
import tifffile
import numpy as np

sample_files = [
    r"D:\01_Train_Val_Oil_Spill_images\Oil\00000.tif",
    r"D:\01_Train_Val_Oil_Spill_images\Oil\00005.tif",
    r"D:\01_Train_Val_Oil_Spill_images\Oil\00010.tif",
    r"D:\01_Train_Val_Oil_Spill_images\Oil\00020.tif",
    r"D:\01_Train_Val_Oil_Spill_images\Oil\00050.tif",
]

for f in sample_files:
    arr = tifffile.imread(f)
    if arr.ndim == 3:
        vv = arr[:, :, 1] if arr.shape[-1] == 2 else arr[1]
    else:
        vv = arr
    p5 = np.percentile(vv, 5)
    p25 = np.percentile(vv, 25)
    p50 = np.percentile(vv, 50)
    p75 = np.percentile(vv, 75)
    p95 = np.percentile(vv, 95)
    print(f"{Path(f).name} shape={vv.shape} p5={p5:.1f} p25={p25:.1f} p50={p50:.1f} p75={p75:.1f} p95={p95:.1f} min={np.min(vv):.1f} max={np.max(vv):.1f}")
