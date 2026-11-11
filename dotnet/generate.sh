#!/bin/bash
set -e

# Generates the C# SDK from Storefront.Api's live OpenAPI document.
# Requires: Storefront.Api running (dotnet run --project src/Presentation/Storefront.Api),
# Node.js/npx (to run openapi-generator-cli - the generator itself is Java-based, npx just fetches/runs the jar),
# and a JRE on PATH for that jar to execute.
#
# Note: pinned to generator 7.24.0 in openapitools.json (not 7.17.0 like the other SDKs) - 7.17.0's csharp
# template has a bug generating free-form dictionary properties (e.g. ProductModel.KeyValues) combined with
# nullable wrapping, emitting an invalid `Null<K,V>` type that doesn't compile. 7.24.0 fixes it.

API_URL="${API_URL:-http://localhost:5135}"
# SDK_SURFACE picks which API the client is generated for: store (the default) or admin. They are
# separate packages with separate credentials, so nothing about one leaks into the other's names.
SDK_SURFACE="${SDK_SURFACE:-store}"
OPENAPI_DOC="${OPENAPI_DOC:-${SDK_SURFACE}}"
case "${SDK_SURFACE}" in
    store) OUTPUT_NAME="generated"; SPEC_NAME="openapi-spec.json"
           CS_PACKAGE="OrderEazi.Commerce.Sdk"; SDK_LABEL="Commerce Headless API" ;;
    admin) OUTPUT_NAME="generated-admin"; SPEC_NAME="openapi-spec-admin.json"
           CS_PACKAGE="OrderEazi.Commerce.Admin.Sdk"; SDK_LABEL="Commerce Admin API" ;;
    *) echo "Unknown SDK_SURFACE '${SDK_SURFACE}' - expected store or admin"; exit 1 ;;
esac
OPENAPI_SPEC_URL="${API_URL}/openapi/${OPENAPI_DOC}.json"
SDK_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="${SDK_DIR}/${OUTPUT_NAME}"
PACKAGE_VERSION="${SDK_VERSION:-1.0.0}"

echo "=========================================="
echo "Generating OrderEazi ${SDK_LABEL} C# SDK"
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

# Deliberately no clientPackage/nullableReferenceTypes properties - clientPackage set to anything sharing a
# path segment with packageName produces a self-referencing namespace that doesn't compile, and
# nullableReferenceTypes doesn't affect the Null<K,V> bug above either way.
npx --yes @openapitools/openapi-generator-cli generate \
    -i "${SPEC_FILE}" \
    -g csharp \
    -o "${OUTPUT_DIR}" \
    --additional-properties=packageName="${CS_PACKAGE}",packageVersion="${PACKAGE_VERSION}",targetFramework=net8.0

echo ""
# Licence, author and repository metadata. openapi-generator does not expose the same set of these
# for every language, and a property it silently ignores would publish an unlicensed package to a
# public registry - so they are written into the generated manifest here instead, where the result
# is asserted rather than assumed. See scripts/apply-package-metadata.test.js.
node "${SDK_DIR}/../scripts/apply-package-metadata.js" csharp "${OUTPUT_DIR}"

echo "✓ C# SDK generated in ${OUTPUT_DIR}"
echo ""
echo "To build/pack locally:"
echo "  cd ${OUTPUT_DIR}/src/${CS_PACKAGE}"
echo "  dotnet pack -c Release"
