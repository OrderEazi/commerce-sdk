# SDK Deployment and Hosting Guide

This document explains how the OrderEazi Commerce TypeScript, Python, and PHP SDKs are automatically generated,
built, packaged, and deployed to AWS S3.

## Overview

The SDK deployment process is integrated into the Bitbucket CI/CD pipeline (`&BuildAndDeploySDK` in
`bitbucket-pipelines.yml`). When a release branch is pushed (e.g., `release/V1.0.0`), the pipeline will:

1. Build `Storefront.Api` (the headless API itself) and start it in the background just long enough to serve
   its live `store` OpenAPI document - no database or store credentials are needed for this, since `/openapi/*`
   is exempt from every tenant-resolution middleware.
2. Generate all three SDKs from that live spec (TypeScript via `openapi-generator`'s `typescript-axios`
   template, Python via `python`, PHP via `php`).
3. Build/package each one (TypeScript: `tsc` + `npm pack`; Python: `python -m build` for a wheel + sdist; PHP:
   Composer validate/install + a tarball of the generated package).
4. Upload each language's package to its own S3 prefix - `sdk/` (TypeScript), `sdk-python/`, `sdk-php/` -
   under `s3://za.co.storefront7.resources/{VERSION}/...`, plus a flat `latest.*` pointer per language.
5. Make them accessible via CloudFront at `https://content.storefront7.co.za/{VERSION}/...`.

## Architecture

### S3 Structure

Each language gets its own prefix, both a versioned copy and a flat `latest.*` pointer:

```
s3://za.co.storefront7.resources/
├── 1.0.0/
│   ├── scripts/
│   │   └── *.js
│   ├── sdk/                 (TypeScript)
│   │   ├── ordereazi-commerce-sdk-1.0.0.tgz
│   │   ├── ordereazi-commerce-sdk-latest.tgz
│   │   └── install.json
│   ├── sdk-python/
│   │   ├── storefront_headless_api-1.0.0-py3-none-any.whl
│   │   ├── storefront_headless_api-1.0.0.tar.gz
│   │   └── install.json
│   └── sdk-php/
│       ├── storefront-headless-api-sdk-1.0.0.tar.gz
│       └── install.json
├── sdk/latest.tgz            (flat pointer, always the newest release)
├── sdk-python/latest.whl
├── sdk-php/latest.tar.gz
├── 1.1.0/
│   └── ...
└── ...
```

### CloudFront Distribution

The S3 bucket is served via CloudFront:
- **Distribution**: `content.storefront7.co.za`
- **Public Access**: All SDK files are publicly readable
- **Cache**: 7 days (604800 seconds)

## Build Process

### Build Scripts

Two build scripts are provided:

1. **`scripts/build-and-package-sdk.sh`** - Bash script (Linux/macOS)
2. **`scripts/build-and-package-sdk.js`** - Node.js script (cross-platform)

Both scripts perform the same operations:

1. Install npm dependencies
2. Fetch OpenAPI spec from the API
3. Generate TypeScript client (optional, uses existing if generator unavailable)
4. Update package.json version
5. Build TypeScript to JavaScript
6. Create npm package tarball
7. Prepare package directory for S3 upload

### Environment Variables

The build scripts use these environment variables:

- `API_URL` - The Storefront.Api endpoint to fetch the OpenAPI spec from (default: `http://localhost:5135`)
- `SDK_VERSION` or `VERSION` - The SDK version (default: `1.0.0`)
- `SFVERSION` - The Storefront version (used for S3 path)

### Manual Build

To build the SDK manually:

```bash
cd src/Tools/Storefront.Sdk/TypeScript

# Set environment variables
export API_URL=https://api.storefront7.co.za
export SDK_VERSION=1.0.0
export SFVERSION=1.0.0

# Run build script
bash scripts/build-and-package-sdk.sh
# OR
node scripts/build-and-package-sdk.js
```

## CI/CD Integration

### Bitbucket Pipeline

The SDK build and deployment is integrated into the `release/*` branch pipeline, as one step covering all
three languages:

```yaml
- step: &BuildAndDeploySDK
    name: "Build and Deploy SDKs (TypeScript, Python, PHP)"
    image: mcr.microsoft.com/dotnet/sdk:10.0
    script:
      - |
        SFVERSION=$(echo "$BITBUCKET_BRANCH" | sed -E 's|.*/V([0-9.]+)$|\1|')
        dotnet build src/Presentation/Storefront.Api/Storefront.Api.csproj -c Release
        dotnet src/Presentation/Storefront.Api/bin/Release/net10.0/Storefront.Api.dll --urls http://localhost:5135 &
        # ... wait for readiness, then generate/build/package each language and upload it ...
        bash src/Tools/Storefront.Sdk/TypeScript/scripts/build-and-package-sdk.sh
        bash src/Tools/Storefront.Sdk/Python/build-and-package-sdk.sh
        bash src/Tools/Storefront.Sdk/PHP/build-and-package-sdk.sh
```

See the actual step in `bitbucket-pipelines.yml` for the full script - this is a condensed illustration of
the shape, not a copy-pasteable version (env var passing, the readiness poll, and the S3 upload helper are
omitted for brevity).

### Pipeline Flow

1. **Release branch pushed** (e.g., `release/V1.0.0`)
2. **Parallel builds**:
   - Build Docker images (StoreApp, Api, Solr workers, MCP)
   - Deploy S3 resources (scripts)
   - **Build and deploy SDKs** (TypeScript, Python, PHP)
3. **Deploy to Kubernetes**

### API URL Configuration

The pipeline uses the `API_URL` environment variable. If not set, it defaults to `https://api.storefront7.co.za`. You can override this in Bitbucket:

1. Go to Repository Settings → Pipelines → Repository variables
2. Add `API_URL` with your API endpoint

## S3 Upload

### Upload Command

The SDK is uploaded using AWS CLI:

```bash
aws s3 sync "dist/package" \
  "s3://za.co.storefront7.resources/$SFVERSION/sdk/" \
  --acl public-read \
  --content-type 'application/gzip' \
  --cache-control 'public, max-age=604800'
```

### Files Uploaded

- `ordereazi-commerce-sdk-{VERSION}.tgz` - Versioned package
- `ordereazi-commerce-sdk-latest.tgz` - Latest alias for convenience
- `install.json` - Installation metadata

### Access Control

- **ACL**: `public-read` - Files are publicly accessible
- **Content-Type**: `application/gzip` - Correct MIME type for .tgz files
- **Cache-Control**: `public, max-age=604800` - 7-day cache

## Installation

Once deployed, users can install the SDK:

```bash
npm install https://content.storefront7.co.za/1.0.0/sdk/ordereazi-commerce-sdk-1.0.0.tgz
```

See [INSTALLATION.md](./INSTALLATION.md) for detailed installation instructions.

## Versioning

### Version Format

The SDK version matches the Storefront release version:
- Branch: `release/V1.0.0` → Version: `1.0.0`
- Branch: `release/V1.2.3` → Version: `1.2.3`

### Version Extraction

The pipeline extracts the version from the branch name:

```bash
SFVERSION=${BITBUCKET_BRANCH//"release\/V"/}
```

This converts `release/V1.0.0` → `1.0.0`

## Troubleshooting

### Build Fails - API Not Accessible

**Problem**: The build script can't fetch the OpenAPI spec.

**Solution**:
- Verify the API is running and accessible
- Check the `API_URL` environment variable
- Ensure network connectivity in the CI/CD environment

### Build Fails - TypeScript Errors

**Problem**: TypeScript compilation fails.

**Solution**:
- Check for breaking changes in the API
- Verify TypeScript version compatibility
- Review generated types for issues

### Upload Fails - S3 Permissions

**Problem**: AWS CLI can't upload to S3.

**Solution**:
- Verify AWS credentials in Bitbucket variables
- Check S3 bucket permissions
- Ensure IAM user has `s3:PutObject` and `s3:PutObjectAcl` permissions

### SDK Not Accessible After Upload

**Problem**: Files uploaded but can't be accessed via CloudFront.

**Solution**:
- Verify CloudFront distribution is configured correctly
- Check S3 bucket public access settings
- Verify CloudFront origin path mapping
- Clear CloudFront cache if needed

## Monitoring

### Check Deployment Status

1. **Bitbucket Pipeline**: Check pipeline logs for build status
2. **S3 Bucket**: Verify files exist:
   ```bash
   aws s3 ls s3://za.co.storefront7.resources/1.0.0/sdk/
   ```
3. **CloudFront**: Test URL accessibility:
   ```bash
   curl https://content.storefront7.co.za/1.0.0/sdk/install.json
   ```

### Verify Installation

Test that the SDK can be installed:

```bash
npm install https://content.storefront7.co.za/1.0.0/sdk/ordereazi-commerce-sdk-1.0.0.tgz
```

## Future Improvements

Potential enhancements:

1. **Automated Testing**: Run SDK tests before deployment
2. **Version Validation**: Verify SDK version matches API version
3. **Release Notes**: Automatically generate SDK changelog
4. **NPM Registry**: Publish to private npm registry instead of S3
5. **CDN Invalidation**: Automatically invalidate CloudFront cache
6. **Rollback**: Keep previous versions for rollback capability

## Related Documentation

- [INSTALLATION.md](./INSTALLATION.md) - How to install the SDK
- [README.md](./README.md) - SDK usage and API documentation
- [GENERATION.md](./GENERATION.md) - Manual SDK generation guide

