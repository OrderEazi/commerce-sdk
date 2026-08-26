#!/bin/bash
set -e

# Generates the TypeScript client from the Commerce API's OpenAPI document.
#
# Requires Node (for npx) and a JRE - openapi-generator-cli is a Java tool that npx only fetches and
# runs. Point API_URL at any deployment serving /openapi/*.json; the default is a local Storefront.Api
# (dotnet run --project src/Presentation/Storefront.Api).
#
# This used to probe for the generator with `npx openapi-generator-cli --version` and fall back to
# nswag. The probe was wrong twice over: npx without --yes prompts before fetching a package, which is
# an immediate non-zero exit on CI, and the CLI spells it `version` rather than `--version` - so the
# probe failed on a runner that had the tool perfectly available, and the script reported it missing.
# The other three languages never probed; they just call the generator, and that is what this does now.

API_URL=${API_URL:-"http://localhost:5135"}
OPENAPI_DOC=${OPENAPI_DOC:-"store"}
OPENAPI_SPEC_URL="${API_URL}/openapi/${OPENAPI_DOC}.json"
OUTPUT_DIR="./src/generated"

echo "Generating TypeScript SDK from OpenAPI spec..."
echo "API URL: ${API_URL}"
echo "OpenAPI document: ${OPENAPI_DOC}"
echo "Spec URL: ${OPENAPI_SPEC_URL}"

mkdir -p "${OUTPUT_DIR}"

curl -sf -o "${OUTPUT_DIR}/openapi-spec.json" "${OPENAPI_SPEC_URL}" || {
    echo "Error: could not fetch OpenAPI spec from ${OPENAPI_SPEC_URL}"
    echo "If this is a local run, make sure Storefront.Api is running."
    exit 1
}

# An empty-but-valid document generates an empty-but-valid client, which then publishes and looks fine
# until someone tries to call something.
PATHS=$(node -e "console.log(Object.keys(require('./${OUTPUT_DIR}/openapi-spec.json').paths || {}).length)")
echo "Spec contains ${PATHS} paths"

if [ "${PATHS}" -lt 1 ]; then
    echo "Error: the spec has no paths - refusing to generate"
    exit 1
fi

npx --yes @openapitools/openapi-generator-cli generate \
    -i "${OUTPUT_DIR}/openapi-spec.json" \
    -g typescript-axios \
    -o "${OUTPUT_DIR}/client" \
    --additional-properties=supportsES6=true,withInterfaces=true,typescriptThreePlus=true,npmName=@ordereazi/commerce-sdk

# src/index.ts re-exports ./generated/client, so tsc fails with TS2307 if generation quietly produced
# nothing. Better to say so here than to have the build fail one step later with a confusing error.
if [ ! -f "${OUTPUT_DIR}/client/index.ts" ]; then
    echo "Error: the generator ran but produced no client at ${OUTPUT_DIR}/client"
    exit 1
fi

echo "✓ TypeScript client generated in ${OUTPUT_DIR}/client"
