#!/bin/bash
set -e

# Generates the PHP SDK from Storefront.Api's live OpenAPI document.
# Requires: Storefront.Api running (dotnet run --project src/Presentation/Storefront.Api),
# Node.js/npx (to run openapi-generator-cli - the generator itself is Java-based, npx just fetches/runs the jar),
# and a JRE on PATH for that jar to execute.

API_URL="${API_URL:-http://localhost:5135}"
OPENAPI_DOC="${OPENAPI_DOC:-store}"
OPENAPI_SPEC_URL="${API_URL}/openapi/${OPENAPI_DOC}.json"
SDK_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="${SDK_DIR}/generated"
PACKAGE_VERSION="${SDK_VERSION:-1.0.0}"

echo "=========================================="
echo "Generating OrderEazi Commerce API PHP SDK"
echo "=========================================="
echo "Spec URL: ${OPENAPI_SPEC_URL}"
echo "Output: ${OUTPUT_DIR}"
echo "=========================================="

mkdir -p "${OUTPUT_DIR}"
SPEC_FILE="${SDK_DIR}/openapi-spec.json"

curl -sf -o "${SPEC_FILE}" "${OPENAPI_SPEC_URL}" || {
    echo "Error: could not fetch OpenAPI spec from ${OPENAPI_SPEC_URL}"
    echo "Make sure Storefront.Api is running (dotnet run --project src/Presentation/Storefront.Api)"
    exit 1
}

npx --yes @openapitools/openapi-generator-cli generate \
    -i "${SPEC_FILE}" \
    -g php \
    -o "${OUTPUT_DIR}" \
    --additional-properties=invokerPackage=OrderEazi\\Commerce\\Api,packageName=ordereazi-commerce-sdk,composerPackageName=ordereazi/commerce-sdk,artifactVersion="${PACKAGE_VERSION}"

echo ""
# Licence, author and repository metadata. openapi-generator does not expose the same set of these
# for every language, and a property it silently ignores would publish an unlicensed package to a
# public registry - so they are written into the generated manifest here instead, where the result
# is asserted rather than assumed. See scripts/apply-package-metadata.test.js.
node "${SDK_DIR}/../scripts/apply-package-metadata.js" php "${OUTPUT_DIR}"

echo "✓ PHP SDK generated in ${OUTPUT_DIR}"
echo ""
echo "To install locally:"
echo "  cd ${OUTPUT_DIR}"
echo "  composer install"
