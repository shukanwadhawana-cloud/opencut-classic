#!/usr/bin/env python3
"""Regenerate apps/web/public/icons/android-icon-512x512.png from 192x192."""
from pathlib import Path
try:
    from PIL import Image
except ImportError:
    raise SystemExit("pip install pillow")
root = Path(__file__).resolve().parents[1]
src = root / "public/icons/android-icon-192x192.png"
dest = root / "public/icons/android-icon-512x512.png"
im = Image.open(src).convert("RGBA").resize((512, 512), Image.Resampling.LANCZOS)
im.save(dest, format="PNG", optimize=True)
print(f"wrote {dest} ({dest.stat().st_size} bytes)")
