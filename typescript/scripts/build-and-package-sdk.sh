#!/bin/bash
set -e

# Configuration
# Primary source is Storefront.Api's live OpenAPI document (API_URL + /openapi/{OPENAPI_DOC}.json) - always
# current, no stale committed file to fall out of sync. LOCAL_SPEC_PATH is an escape hatch for environments
# where the API genuinely can't be reached (falls back to a pre-fetched file if one exists there).
# The SDK itself is generic and works with any store URL (baseUrl is configurable when creating the client).
API_URL="${API_URL:-http://localhost:5135}"
OPENAPI_DOC="${OPENAPI_DOC:-store}"
OPENAPI_SPEC_URL="${API_URL}/openapi/${OPENAPI_DOC}.json"
LOCAL_SPEC_PATH="${LOCAL_SPEC_PATH:-src/generated/openapi-spec.json}"
SDK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${SDK_VERSION:-1.0.0}"
SFVERSION="${SFVERSION:-}"
NPM_PACKAGE_NAME="@ordereazi/commerce-sdk"

echo "=========================================="
echo "Building OrderEazi Commerce Headless API TypeScript SDK"
echo "=========================================="
echo "OpenAPI spec URL: $OPENAPI_SPEC_URL"
echo "SDK Version: $VERSION"
echo "Storefront Version: $SFVERSION"
echo "SDK Directory: $SDK_DIR"
echo "=========================================="

cd "$SDK_DIR"

# Step 1: Install dependencies
echo ""
echo "Step 1: Installing dependencies..."
npm ci

# Step 2: Fetch the OpenAPI spec from the running API (falls back to a local file if unreachable)
echo ""
echo "Step 2: Loading OpenAPI specification..."

mkdir -p src/generated
SPEC_FILE="src/generated/openapi-spec.json"

if curl -sf -o "$SPEC_FILE" "$OPENAPI_SPEC_URL"; then
  echo "✓ Fetched OpenAPI spec live from: $OPENAPI_SPEC_URL"
elif [ -f "$LOCAL_SPEC_PATH" ]; then
  echo "⚠ Could not reach $OPENAPI_SPEC_URL - falling back to local file: $LOCAL_SPEC_PATH"
  [ "$LOCAL_SPEC_PATH" != "$SPEC_FILE" ] && cp "$LOCAL_SPEC_PATH" "$SPEC_FILE"
elif [ -f "$SPEC_FILE" ]; then
  echo "⚠ Could not reach $OPENAPI_SPEC_URL - using existing file: $SPEC_FILE"
else
  echo "ERROR: Could not reach Storefront.Api at $API_URL and no fallback spec file found."
  echo "Either start Storefront.Api (dotnet run --project src/Presentation/Storefront.Api)"
  echo "or set LOCAL_SPEC_PATH to a pre-fetched openapi-spec.json."
  exit 1
fi

# Step 3: Generate TypeScript client (if using openapi-generator)
echo ""
echo "Step 3: Generating TypeScript client code..."

if [ ! -s "$SPEC_FILE" ]; then
  echo "WARNING: OpenAPI spec file is empty, skipping client generation"
  echo "Using existing client code in src/"
elif ! node -e "JSON.parse(require('fs').readFileSync('$SPEC_FILE', 'utf8'))" 2>/dev/null; then
  echo "WARNING: OpenAPI spec file is not valid JSON, skipping client generation"
  echo "Using existing client code in src/"
elif ! node -e "const spec = JSON.parse(require('fs').readFileSync('$SPEC_FILE', 'utf8')); if (!spec.openapi && !spec.swagger) { throw new Error('Invalid spec'); }" 2>/dev/null; then
  echo "WARNING: OpenAPI spec file is missing required fields (openapi/swagger), skipping client generation"
  echo "Using existing client code in src/"
else
  # Spec file is valid, try to generate client
  if command -v npx &> /dev/null; then
    echo "Using @openapitools/openapi-generator-cli to generate client..."
    npx --yes @openapitools/openapi-generator-cli generate \
      -i "$SPEC_FILE" \
      -g typescript-axios \
      -o src/generated/client \
      --additional-properties=supportsES6=true,withInterfaces=true,typescriptThreePlus=true,npmName=$NPM_PACKAGE_NAME,npmVersion=$VERSION \
      --skip-validate-spec || {
      echo "WARNING: OpenAPI generator failed, continuing with existing client code..."
    }
  else
    echo "WARNING: npx not available, skipping client generation"
    echo "Using existing client code in src/"
  fi
fi

# Step 4: Update package.json version
echo ""
echo "Step 4: Updating package.json version..."
if [ -n "$VERSION" ]; then
  npm version "$VERSION" --no-git-tag-version || {
    # If version format is invalid for npm, try to set it manually
    node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json')); pkg.version = '$VERSION'; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');"
  }
  echo "✓ Package version set to $VERSION"
fi

# Step 5: Build TypeScript
echo ""
echo "Step 5: Building TypeScript..."
npm run build

if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
  echo "ERROR: Build failed - dist directory is empty or doesn't exist"
  exit 1
fi

echo "✓ TypeScript build completed"

# Step 6: Create npm package tarball
echo ""
echo "Step 6: Creating npm package tarball..."
npm pack --pack-destination ./dist

# Find the generated tarball
TARBALL=$(ls -t dist/*.tgz 2>/dev/null | head -1)
if [ -z "$TARBALL" ]; then
  echo "ERROR: Failed to create npm package tarball"
  exit 1
fi

echo "✓ Package tarball created: $TARBALL"

# Step 7: Prepare for S3 upload
echo ""
echo "Step 7: Preparing package for S3 upload..."

# Get the tarball filename
TARBALL_NAME=$(basename "$TARBALL")
LATEST_TARBALL_NAME="ordereazi-commerce-sdk-latest.tgz"

# Create a versioned directory structure
PACKAGE_DIR="dist/package"
mkdir -p "$PACKAGE_DIR"

# Copy the tarball to the package directory
cp "$TARBALL" "$PACKAGE_DIR/"

# Also create a latest copy for easier access
cp "$TARBALL" "$PACKAGE_DIR/$LATEST_TARBALL_NAME"

# Create a package.json for installation instructions
S3_REGION="${AWS_DEFAULT_REGION:-eu-west-1}"
cat > "$PACKAGE_DIR/install.json" <<EOF
{
  "name": "$NPM_PACKAGE_NAME",
  "version": "$VERSION",
  "installation": {
    "fromS3": "npm install https://content.storefront7.co.za/$SFVERSION/sdk/$TARBALL_NAME",
    "fromS3Latest": "npm install https://content.storefront7.co.za/$SFVERSION/sdk/$LATEST_TARBALL_NAME",
    "version": "$VERSION",
    "storefrontVersion": "$SFVERSION"
  }
}
EOF

# Create a package.json for npm to install from URL (points to latest version)
cat > "$PACKAGE_DIR/package.json" <<EOF
{
  "name": "$NPM_PACKAGE_NAME",
  "version": "$VERSION",
  "description": "TypeScript SDK for the OrderEazi Commerce Headless API",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "dist": {
    "tarball": "https://content.storefront7.co.za/$SFVERSION/sdk/$TARBALL_NAME",
    "shasum": ""
  }
}
EOF

# Create latest.json with current version info (will be uploaded to stable path)
cat > "$PACKAGE_DIR/latest.json" <<EOF
{
  "version": "$VERSION",
  "storefrontVersion": "$SFVERSION",
  "releaseDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "tarball": "https://content.storefront7.co.za/$SFVERSION/sdk/$TARBALL_NAME",
  "installCommand": "npm install https://content.storefront7.co.za/sdk/latest.tgz",
  "latestUrl": "https://content.storefront7.co.za/sdk/latest.tgz"
}
EOF

echo "✓ Package prepared for S3 upload"
echo ""
echo "=========================================="
echo "Build completed successfully!"
echo "=========================================="
echo "Package tarball: $TARBALL"
echo "Package directory: $PACKAGE_DIR"
echo ""
echo "To upload to S3, run:"
echo "  aws s3 sync $PACKAGE_DIR s3://za.co.storefront7.resources/$SFVERSION/sdk/ --acl public-read"
echo "=========================================="
