#!/usr/bin/env python3
"""Verify real LVGL image descriptors/byte order after the PlatformIO builds."""
from pathlib import Path
import os
import subprocess
import tempfile

root = Path(__file__).resolve().parent
for env in ("esp32-s3-compile", "esp32-s3-lvgl8", "esp32-s3-lvgl8-swapped"):
    lvgl = root / "compile/.pio/libdeps" / env / "lvgl"
    if not (lvgl / "lvgl.h").exists():
        raise SystemExit(f"Run the PlatformIO compile harness first: missing {lvgl}")
    with tempfile.TemporaryDirectory(prefix="castboard-pixels-") as temp:
        binary = str(Path(temp) / "image-format")
        args = [os.environ.get("CXX", "c++"), "-std=c++17", "-DLV_CONF_SKIP", "-DLV_COLOR_DEPTH=16", "-I", str(lvgl)]
        if env.endswith("-swapped"):
            args.append("-DLV_COLOR_16_SWAP=1")
        subprocess.run(args + [str(root / "image_format.cpp"), "-o", binary], check=True)
        subprocess.run([binary], check=True)
    print(f"{env}: RGB565 descriptor and colour order passed", flush=True)
