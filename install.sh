#!/bin/bash
set -e

echo "=== CityFlow Installer ==="

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

# نصب وابستگی‌ها
apt-get update -qq
apt-get install -y cmake build-essential python3 python3-venv > /dev/null 2>&1

# پیدا کردن Python مناسب
PYTHON=$(which python3)

# ساخت venv (اگه ممکن بود)
if python3 -m venv /opt/venv 2>/dev/null; then
    source /opt/venv/bin/activate
    PYTHON=/opt/venv/bin/python3
    echo "✓ venv created"
else
    echo "✓ Using system python: $PYTHON"
fi

# Build
mkdir -p "$REPO_DIR/build"

cmake -S "$REPO_DIR" -B "$REPO_DIR/build" \
  -DPYTHON_EXECUTABLE="$PYTHON" \
  -DCMAKE_LIBRARY_OUTPUT_DIRECTORY="$REPO_DIR" \
  -DVERSION=0.1 \
  -DCMAKE_BUILD_TYPE=Release

make -C "$REPO_DIR/build" -j$(nproc)

echo ""
echo "✅ CityFlow installed at: $REPO_DIR"
echo "   Python: $PYTHON"
