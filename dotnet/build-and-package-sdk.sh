#!/bin/bash
set -e

# Generates, builds, and packages the C# SDK as a .nupkg - mirrors the shape of the other three SDKs'
# build-and-package-sdk.sh (generate -> build -> package).

SDK_VERSION="${SDK_VERSION:-1.0.0}"
SFVERSION="${SFVERSION:-}"
SDK_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="${SDK_DIR}/generated"
PROJECT_DIR="${OUTPUT_DIR}/src/OrderEazi.Commerce.Sdk"
DIST_DIR="${SDK_DIR}/dist"
PACKAGE_DIR="${DIST_DIR}/package"

echo "=========================================="
echo "Building OrderEazi Commerce Headless API C# SDK"
echo "SDK Version: ${SDK_VERSION}"
echo "Storefront Version: ${SFVERSION}"
echo "=========================================="

# Step 1: Generate from the live OpenAPI spec (see generate.sh - same live-fetch, no committed fallback)
echo ""
echo "Step 1: Generating client from OpenAPI spec..."
SDK_VERSION="$SDK_VERSION" bash "${SDK_DIR}/generate.sh"

# Step 2: Build and pack
echo ""
echo "Step 2: Building and packing..."
cd "${PROJECT_DIR}"
dotnet pack -c Release -p:PackageVersion="${SDK_VERSION}" -o "${DIST_DIR}"

NUPKG=$(ls "${DIST_DIR}"/*.nupkg 2>/dev/null | head -1)
if [ -z "$NUPKG" ]; then
	echo "ERROR: dotnet pack did not produce a .nupkg"
	exit 1
fi
echo "✓ C# build completed: $(basename "$NUPKG")"

# Step 3: Package for upload
echo ""
echo "Step 3: Preparing package..."
mkdir -p "${PACKAGE_DIR}"
cp "${DIST_DIR}"/*.nupkg "${PACKAGE_DIR}/"
LATEST_NUPKG="${PACKAGE_DIR}/OrderEazi.Commerce.Sdk.latest.nupkg"
cp "$NUPKG" "$LATEST_NUPKG"

cat > "${PACKAGE_DIR}/install.json" <<EOF
{
  "name": "OrderEazi.Commerce.Sdk",
  "version": "${SDK_VERSION}",
  "storefrontVersion": "${SFVERSION}",
  "nupkg": "$(basename "$NUPKG")"
}
EOF

echo "✓ Package prepared in ${PACKAGE_DIR}"
