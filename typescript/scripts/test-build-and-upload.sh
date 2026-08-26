#!/bin/bash
# Quick test script to build, package, and upload SDK to S3
# Usage: ./scripts/test-build-and-upload.sh [version] [s3-path] [aws-profile]

set -e

VERSION="${1:-1.0.0}"
S3_PATH="${2:-test/sdk}"  # Use test path to avoid overwriting production
AWS_PROFILE="${3:-default}"  # AWS CLI profile to use (defaults to "default")

echo "=========================================="
echo "Testing SDK Build and S3 Upload"
echo "=========================================="
echo "Version: $VERSION"
echo "S3 Path: s3://za.co.storefront7.resources/$S3_PATH/"
echo "AWS Profile: $AWS_PROFILE"
echo "=========================================="
echo ""

# Step 1: Build and package
echo "Step 1: Building and packaging SDK..."
export SDK_VERSION=$VERSION
export SFVERSION=$VERSION

cd "$(dirname "$0")/.."

npm run build:package

if [ $? -ne 0 ]; then
    echo "✗ SDK build failed"
    exit 1
fi

echo "✓ SDK built and packaged successfully"
echo ""

# Step 2: Check if package was created
PACKAGE_DIR="dist/package"
if [ ! -d "$PACKAGE_DIR" ]; then
    echo "✗ Package directory not found: $PACKAGE_DIR"
    exit 1
fi

TARBALL=$(ls -t "$PACKAGE_DIR"/*.tgz 2>/dev/null | head -1)
if [ -z "$TARBALL" ]; then
    echo "✗ No tarball found in $PACKAGE_DIR"
    exit 1
fi

TARBALL_NAME=$(basename "$TARBALL")
echo "✓ Package tarball found: $TARBALL_NAME"
echo ""

# Step 3: Upload to S3 (optional - only if AWS CLI is configured)
echo "Step 2: Uploading to S3..."
echo ""

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    echo "⚠ AWS CLI not found. Skipping S3 upload."
    echo ""
    echo "To upload manually, run:"
    echo "  aws s3 sync \"$PACKAGE_DIR\" \"s3://za.co.storefront7.resources/$S3_PATH/\" --acl public-read"
    echo ""
    exit 0
fi

# Upload to S3
echo "Uploading to s3://za.co.storefront7.resources/$S3_PATH/..."
echo "Using AWS profile: $AWS_PROFILE"

if [ "$AWS_PROFILE" != "default" ]; then
    aws s3 sync "$PACKAGE_DIR" "s3://za.co.storefront7.resources/$S3_PATH/" \
        --profile "$AWS_PROFILE" \
        --acl public-read \
        --content-type 'application/gzip' \
        --cache-control 'public, max-age=604800'
else
    aws s3 sync "$PACKAGE_DIR" "s3://za.co.storefront7.resources/$S3_PATH/" \
        --acl public-read \
        --content-type 'application/gzip' \
        --cache-control 'public, max-age=604800'
fi

if [ $? -ne 0 ]; then
    echo "✗ S3 upload failed"
    echo ""
    echo "Make sure:"
    echo "  1. AWS CLI is configured (aws configure --profile $AWS_PROFILE)"
    echo "  2. You have permissions to write to the S3 bucket"
    echo "  3. The bucket exists: za.co.storefront7.resources"
    echo "  4. Use a different profile: ./scripts/test-build-and-upload.sh $VERSION $S3_PATH your-profile-name"
    echo ""
    exit 1
fi

echo ""
echo "✓ SDK uploaded to S3 successfully!"
echo ""
echo "Install via:"
echo "  npm install https://content.storefront7.co.za/$S3_PATH/$TARBALL_NAME"
echo ""

echo "=========================================="
echo "Test completed successfully!"
echo "=========================================="

