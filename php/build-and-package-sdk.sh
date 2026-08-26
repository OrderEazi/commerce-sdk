#!/bin/bash
set -e

# Generates and packages the PHP SDK for upload. PHP has no compile step - "packaging" means validating
# the generated Composer package and archiving it as a tarball, mirroring the shape of the TypeScript/
# Python SDKs' own build-and-package-sdk.sh (generate -> validate/build -> package).

SDK_VERSION="${SDK_VERSION:-1.0.0}"
SFVERSION="${SFVERSION:-}"
SDK_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="${SDK_DIR}/generated"
DIST_DIR="${SDK_DIR}/dist"
PACKAGE_DIR="${DIST_DIR}/package"

echo "=========================================="
echo "Building OrderEazi Commerce API PHP SDK"
echo "SDK Version: ${SDK_VERSION}"
echo "Storefront Version: ${SFVERSION}"
echo "=========================================="

# Step 1: Generate from the live OpenAPI spec (see generate.sh - same live-fetch, no committed fallback)
echo ""
echo "Step 1: Generating client from OpenAPI spec..."
SDK_VERSION="$SDK_VERSION" bash "${SDK_DIR}/generate.sh"

# Step 2: Validate/install via Composer if available (best-effort - a CI image without PHP/Composer
# still produces a valid package, just without this extra verification)
echo ""
echo "Step 2: Validating Composer package..."
cd "${OUTPUT_DIR}"
if command -v composer >/dev/null 2>&1; then
	composer validate --no-check-all --no-check-publish || echo "⚠ composer validate reported issues - continuing"
	composer install --no-interaction --prefer-dist --no-progress || echo "⚠ composer install failed - continuing, package still archived as-is"
else
	echo "⚠ composer not available - skipping validate/install"
fi

# Step 3: Package for upload
echo ""
echo "Step 3: Preparing package..."
mkdir -p "${PACKAGE_DIR}"
TARBALL="ordereazi-commerce-sdk-${SDK_VERSION}.tar.gz"
tar --exclude='./vendor' -czf "${PACKAGE_DIR}/${TARBALL}" -C "${OUTPUT_DIR}" .
cp "${PACKAGE_DIR}/${TARBALL}" "${PACKAGE_DIR}/ordereazi-commerce-sdk-latest.tar.gz"

cat > "${PACKAGE_DIR}/install.json" <<EOF
{
  "name": "ordereazi/commerce-sdk",
  "version": "${SDK_VERSION}",
  "storefrontVersion": "${SFVERSION}",
  "tarball": "${TARBALL}"
}
EOF

echo "✓ Package prepared in ${PACKAGE_DIR}"
