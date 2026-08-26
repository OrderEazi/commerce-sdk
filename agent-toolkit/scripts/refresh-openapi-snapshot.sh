#!/bin/bash
set -e

# Refreshes the bundled OpenAPI snapshot(s) the MCP tools serve offline - same curl-the-live-spec
# pattern as the sibling SDKs' generate.sh (API_URL/OPENAPI_DOC env overrides included). Bundled, not
# fetched live at tool-call time, so a developer asking "what does the cart endpoint look like" doesn't
# need Storefront.Api running locally or a JRE (openapi-generator-cli needs one, this doesn't).

API_URL="${API_URL:-http://localhost:5135}"
SDK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${SDK_DIR}/src/mcp/data/openapi"

mkdir -p "${OUT_DIR}"

for doc in store admin; do
  echo "Fetching ${API_URL}/openapi/${doc}.json..."
  curl -sf -o "${OUT_DIR}/${doc}.json" "${API_URL}/openapi/${doc}.json" || {
    echo "Error: could not fetch ${doc}.json from ${API_URL} - make sure Storefront.Api is running"
    exit 1
  }
done

echo "✓ Snapshots refreshed in ${OUT_DIR}"
echo "Run 'npm run manifest:build' next to regenerate the per-language SDK method manifest from these."
