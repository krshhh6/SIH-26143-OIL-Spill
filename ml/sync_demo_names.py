import shutil
from pathlib import Path

demo_dir = Path(r"d:\Spill Sense\SIH-26143-OIL-Spill\frontend\public\demo-sar")

for cls in [0, 1]:
    for i in range(1, 11):
        f_padded = demo_dir / f"class_{cls}_{i:02d}.jpg"
        f_unpadded = demo_dir / f"class_{cls}_{i}.jpg"
        if f_padded != f_unpadded and f_padded.exists():
            shutil.copy2(f_padded, f_unpadded)
            print(f"Synced {f_padded.name} -> {f_unpadded.name}")

print("Demo files synced successfully!")
