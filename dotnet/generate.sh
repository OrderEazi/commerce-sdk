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
OPENAPI_DOC="${OPENAPI_DOC:-store}"
OPENAPI_SPEC_URL="${API_URL}/openapi/${OPENAPI_DOC}.json"
SDK_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="${SDK_DIR}/generated"
PACKAGE_VERSION="${SDK_VERSION:-1.0.0}"

echo "=========================================="
echo "Generating OrderEazi Commerce Headless API C# SDK"
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

# Deliberately no clientPackage/nullableReferenceTypes properties - clientPackage set to anything sharing a
# path segment with packageName produces a self-referencing namespace that doesn't compile, and
# nullableReferenceTypes doesn't affect the Null<K,V> bug above either way.
npx --yes @openapitools/openapi-generator-cli generate \
    -i "${SPEC_FILE}" \
    -g csharp \
    -o "${OUTPUT_DIR}" \
    --additional-properties=packageName=OrderEazi.Commerce.Sdk,packageVersion="${PACKAGE_VERSION}",targetFramework=net8.0

echo ""
# Licence, author and repository metadata. openapi-generator does not expose the same set of these
# for every language, and a property it silently ignores would publish an unlicensed package to a
# public registry - so they are written into the generated manifest here instead, where the result
# is asserted rather than assumed. See scripts/apply-package-metadata.test.js.
node "${SDK_DIR}/../scripts/apply-package-metadata.js" csharp "${OUTPUT_DIR}"

echo "✓ C# SDK generated in ${OUTPUT_DIR}"
echo ""
echo "To build/pack locally:"
echo "  cd ${OUTPUT_DIR}/src/OrderEazi.Commerce.Sdk"
echo "  dotnet pack -c Release"
