#!/bin/bash
set -e

# Generates the Python SDK from Storefront.Api's live OpenAPI document.
# Requires: Storefront.Api running (dotnet run --project src/Presentation/Storefront.Api),
# Node.js/npx (to run openapi-generator-cli - the generator itself is Java-based, npx just fetches/runs the jar).

API_URL="${API_URL:-http://localhost:5135}"
# SDK_SURFACE picks which API the client is generated for: store (the default) or admin. They are
# separate packages with separate credentials, so nothing about one leaks into the other's names.
SDK_SURFACE="${SDK_SURFACE:-store}"
OPENAPI_DOC="${OPENAPI_DOC:-${SDK_SURFACE}}"
case "${SDK_SURFACE}" in
    store) OUTPUT_NAME="generated"; SPEC_NAME="openapi-spec.json"
           PY_MODULE="ordereazi_commerce_api"; PY_PROJECT="ordereazi-commerce-sdk"; SDK_LABEL="Commerce API" ;;
    admin) OUTPUT_NAME="generated-admin"; SPEC_NAME="openapi-spec-admin.json"
           PY_MODULE="ordereazi_commerce_admin_api"; PY_PROJECT="ordereazi-commerce-admin-sdk"; SDK_LABEL="Commerce Admin API" ;;
    *) echo "Unknown SDK_SURFACE '${SDK_SURFACE}' - expected store or admin"; exit 1 ;;
esac
OPENAPI_SPEC_URL="${API_URL}/openapi/${OPENAPI_DOC}.json"
SDK_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="${SDK_DIR}/${OUTPUT_NAME}"
PACKAGE_VERSION="${SDK_VERSION:-1.0.0}"

echo "=========================================="
echo "Generating OrderEazi ${SDK_LABEL} Python SDK"
echo "=========================================="
echo "Spec URL: ${OPENAPI_SPEC_URL}"
echo "Output: ${OUTPUT_DIR}"
echo "=========================================="

mkdir -p "${OUTPUT_DIR}"
SPEC_FILE="${SDK_DIR}/${SPEC_NAME}"

curl -sf -o "${SPEC_FILE}" "${OPENAPI_SPEC_URL}" || {
    echo "Error: could not fetch OpenAPI spec from ${OPENAPI_SPEC_URL}"
    echo "Make sure Storefront.Api is running (dotnet run --project src/Presentation/Storefront.Api)"
    exit 1
}

npx --yes @openapitools/openapi-generator-cli generate \
    -i "${SPEC_FILE}" \
    -g python \
    -o "${OUTPUT_DIR}" \
    --additional-properties=packageName=${PY_MODULE},projectName=${PY_PROJECT},packageVersion="${PACKAGE_VERSION}"

echo ""
# Licence, author and repository metadata. openapi-generator does not expose the same set of these
# for every language, and a property it silently ignores would publish an unlicensed package to a
# public registry - so they are written into the generated manifest here instead, where the result
# is asserted rather than assumed. See scripts/apply-package-metadata.test.js.
SDK_PYPI_NAME="${PY_PROJECT}" node "${SDK_DIR}/../scripts/apply-package-metadata.js" python "${OUTPUT_DIR}"

echo "✓ Python SDK generated in ${OUTPUT_DIR}"
echo ""
echo "To build/install locally:"
echo "  cd ${OUTPUT_DIR}"
echo "  pip install ."
