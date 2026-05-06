#!/bin/bash
set -e

echo "=== CityFlow Installer ==="

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

# نصب وابستگی‌ها
apt-get update -qq
apt-get install -y cmake build-essential python3 > /dev/null 2>&1
echo "✓ Dependencies installed"

# clone pybind11 و rapidjson
echo "⏳ Cloning pybind11..."
rm -rf "$REPO_DIR/extern/pybind11"
git clone --branch v2.11.1 https://github.com/pybind/pybind11.git \
    "$REPO_DIR/extern/pybind11" --quiet 2>/dev/null
echo "✓ pybind11 ready"

echo "⏳ Cloning rapidjson..."
rm -rf "$REPO_DIR/extern/rapidjson"
git clone https://github.com/Tencent/rapidjson.git \
    "$REPO_DIR/extern/rapidjson" --quiet 2>/dev/null
echo "✓ rapidjson ready"

# پیدا کردن Python
PYTHON=$(which python3)
echo "✓ Python: $PYTHON"

# Build
mkdir -p "$REPO_DIR/build"
echo "⏳ Building (~2 min)..."

cmake -S "$REPO_DIR" -B "$REPO_DIR/build" \
  -DPYTHON_EXECUTABLE="$PYTHON" \
  -DCMAKE_LIBRARY_OUTPUT_DIRECTORY="$REPO_DIR" \
  -DVERSION=0.1 \
  -DCMAKE_BUILD_TYPE=Release > /dev/null

make -C "$REPO_DIR/build" -j$(nproc)

echo ""
echo "✅ CityFlow installed successfully!"
