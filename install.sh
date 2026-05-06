#!/bin/bash
set -e

echo "=== CityFlow Installer ==="

# نصب وابستگی‌ها
apt-get update -qq
apt-get install -y cmake build-essential python3 python3-venv > /dev/null

# ساخت venv
python3 -m venv /opt/venv
source /opt/venv/bin/activate

# Build
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$REPO_DIR/build"

cmake -S "$REPO_DIR" -B "$REPO_DIR/build" \
  -DPYTHON_EXECUTABLE=/opt/venv/bin/python3 \
  -DCMAKE_LIBRARY_OUTPUT_DIRECTORY="$REPO_DIR" \
  -DVERSION=0.1 \
  -DCMAKE_BUILD_TYPE=Release

make -C "$REPO_DIR/build" -j$(nproc)

echo ""
echo "✓ CityFlow installed!"
echo ""
echo "Test:"
echo "  source /opt/venv/bin/activate"
echo "  cd $REPO_DIR && python3 -c \"import sys; sys.path.insert(0,'.')); import cityflow; print('OK')\""
