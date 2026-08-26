#!/bin/bash
set -e

# Generates, builds (sdist + wheel), and packages the Python SDK for upload - mirrors the TypeScript SDK's
# scripts/build-and-package-sdk.sh shape (generate -> build -> package), so both languages plug into the
# same CI step the same way.

SDK_VERSION="${SDK_VERSION:-1.0.0}"
SFVERSION="${SFVERSION:-}"
SDK_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="${SDK_DIR}/generated"
DIST_DIR="${SDK_DIR}/dist"
PACKAGE_DIR="${DIST_DIR}/package"

echo "=========================================="
echo "Building OrderEazi Commerce API Python SDK"
echo "SDK Version: ${SDK_VERSION}"
echo "Storefront Version: ${SFVERSION}"
echo "=========================================="

# Step 1: Generate from the live OpenAPI spec (see generate.sh - same live-fetch, no committed fallback)
echo ""
echo "Step 1: Generating client from OpenAPI spec..."
SDK_VERSION="$SDK_VERSION" bash "${SDK_DIR}/generate.sh"

# Step 2: Build sdist + wheel
echo ""
echo "Step 2: Building sdist + wheel..."
cd "${OUTPUT_DIR}"
python3 -m pip install --quiet --upgrade build
rm -rf dist
python3 -m build --outdir "${DIST_DIR}"

if [ ! -d "${DIST_DIR}" ] || [ -z "$(ls -A "${DIST_DIR}" 2>/dev/null)" ]; then
	echo "ERROR: Build failed - dist directory is empty or doesn't exist"
	exit 1
fi
echo "✓ Python build completed"

# Step 3: Package for upload
echo ""
echo "Step 3: Preparing package..."
mkdir -p "${PACKAGE_DIR}"
cp "${DIST_DIR}"/*.whl "${PACKAGE_DIR}/" 2>/dev/null || true
cp "${DIST_DIR}"/*.tar.gz "${PACKAGE_DIR}/" 2>/dev/null || true

WHEEL=$(ls "${PACKAGE_DIR}"/*.whl 2>/dev/null | head -1)
SDIST=$(ls "${PACKAGE_DIR}"/*.tar.gz 2>/dev/null | head -1)
if [ -z "$WHEEL" ] && [ -z "$SDIST" ]; then
	echo "ERROR: No wheel or sdist produced"
	exit 1
fi

cat > "${PACKAGE_DIR}/install.json" <<EOF
{
  "name": "ordereazi-commerce-sdk",
  "version": "${SDK_VERSION}",
  "storefrontVersion": "${SFVERSION}",
  "wheel": "$(basename "${WHEEL:-}")",
  "sdist": "$(basename "${SDIST:-}")"
}
EOF

echo "✓ Package prepared in ${PACKAGE_DIR}"
