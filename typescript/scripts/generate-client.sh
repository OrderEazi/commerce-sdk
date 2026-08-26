#!/bin/bash

# Script to generate TypeScript client from Storefront.Api's OpenAPI spec
# Requires: openapi-generator-cli or nswag, and a running Storefront.Api instance
# (dotnet run --project src/Presentation/Storefront.Api - dev default is http://localhost:5135)

API_URL=${API_URL:-"http://localhost:5135"}
OPENAPI_DOC=${OPENAPI_DOC:-"store"}
OPENAPI_SPEC_URL="${API_URL}/openapi/${OPENAPI_DOC}.json"
OUTPUT_DIR="./src/generated"

echo "Generating TypeScript SDK from OpenAPI spec..."
echo "API URL: ${API_URL}"
echo "OpenAPI document: ${OPENAPI_DOC}"
echo "Spec URL: ${OPENAPI_SPEC_URL}"

mkdir -p "${OUTPUT_DIR}"

# Check if openapi-generator-cli is available
if command -v openapi-generator-cli &> /dev/null || npx @openapitools/openapi-generator-cli --version &> /dev/null; then
    echo "Using openapi-generator-cli..."

    # First, fetch the spec
    curl -sf -o "${OUTPUT_DIR}/openapi-spec.json" "${OPENAPI_SPEC_URL}" || {
        echo "Error: could not fetch OpenAPI spec from ${OPENAPI_SPEC_URL}"
        echo "Make sure Storefront.Api is running (dotnet run --project src/Presentation/Storefront.Api)"
        exit 1
    }

    # Generate TypeScript client
    npx @openapitools/openapi-generator-cli generate \
        -i "${OUTPUT_DIR}/openapi-spec.json" \
        -g typescript-axios \
        -o "${OUTPUT_DIR}/client" \
        --additional-properties=supportsES6=true,withInterfaces=true,typescriptThreePlus=true,npmName=@ordereazi/commerce-sdk

    echo "✓ TypeScript client generated in ${OUTPUT_DIR}/client"

elif command -v nswag &> /dev/null || npx nswag --version &> /dev/null; then
    echo "Using NSwag..."

    curl -sf -o "${OUTPUT_DIR}/openapi-spec.json" "${OPENAPI_SPEC_URL}" || {
        echo "Error: could not fetch OpenAPI spec from ${OPENAPI_SPEC_URL}"
        echo "Make sure Storefront.Api is running (dotnet run --project src/Presentation/Storefront.Api)"
        exit 1
    }

    npx nswag swagger2tsclient \
        /input:"${OUTPUT_DIR}/openapi-spec.json" \
        /output:"${OUTPUT_DIR}/client.ts" \
        /namespace:StorefrontHeadlessApi \
        /className:StorefrontHeadlessApiClient

    echo "✓ TypeScript client generated in ${OUTPUT_DIR}/client.ts"

else
    echo "Error: Neither openapi-generator-cli nor nswag found."
    echo "Install one of them:"
    echo "  npm install -g @openapitools/openapi-generator-cli"
    echo "  npm install -g nswag"
    exit 1
fi
