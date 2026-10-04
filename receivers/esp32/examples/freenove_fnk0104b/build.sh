#!/usr/bin/env bash
# Compile only. This script never opens a serial port or uploads firmware.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIBRARY_ROOT="$(cd "$ROOT/../.." && pwd)"
CLI="${ARDUINO_CLI:-arduino-cli}"
BUILD_DIR="${CASTBOARD_BUILD_DIR:-$ROOT/build}"
FQBN='esp32:esp32:esp32s3:CDCOnBoot=cdc,FlashSize=16M,PSRAM=opi,PartitionScheme=app3M_fat9M_16MB,FlashMode=dio'
if [[ ! -f "$ROOT/secrets.h" ]]; then
  echo 'Copy secrets.example.h to secrets.h and supply your display connection details.' >&2
  exit 1
fi
FLAGS="-include \"$ROOT/build_settings.h\""
ARGS=(compile --jobs 2 --fqbn "$FQBN" --build-path "$BUILD_DIR"
  --library "$LIBRARY_ROOT"
  --build-property "compiler.c.extra_flags=$FLAGS"
  --build-property "compiler.cpp.extra_flags=$FLAGS")
# Positional arguments are library directories, not arbitrary compiler options.
# In particular, --upload and --port can never be passed through this script.
for library in "$@"; do
  ARGS+=("--library=$library")
done
exec "$CLI" "${ARGS[@]}" "$ROOT"
