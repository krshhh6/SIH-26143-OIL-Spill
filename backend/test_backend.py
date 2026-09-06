import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    import app.main
    print("[SUCCESS] Backend FastAPI app loaded without errors!")
except Exception as e:
    print(f"[ERROR] Failed to load backend app: {e}")
    import traceback
    traceback.print_exc()
