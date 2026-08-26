# Quick test script to build, package, and upload SDK to S3
# Usage: .\scripts\test-build-and-upload.ps1 [version] [s3-path] [aws-profile]

param(
    [string]$Version = "1.0.0",
    [string]$S3Path = "test/sdk",  # Use test path to avoid overwriting production
    [string]$AwsProfile = "default"  # AWS CLI profile to use (defaults to "default")
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Testing SDK Build and S3 Upload" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Version: $Version" -ForegroundColor Yellow
Write-Host "S3 Path: s3://za.co.storefront7.resources/$S3Path/" -ForegroundColor Yellow
Write-Host "AWS Profile: $AwsProfile" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build and package
Write-Host "Step 1: Building and packaging SDK..." -ForegroundColor Green
$env:SDK_VERSION = $Version
$env:SFVERSION = $Version

cd $PSScriptRoot\..

try {
    npm run build:package
    
    if ($LASTEXITCODE -ne 0) {
        throw "SDK build failed"
    }
    
    Write-Host "✓ SDK built and packaged successfully" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "✗ SDK build failed: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Check if package was created
$packageDir = "dist\package"
if (-not (Test-Path $packageDir)) {
    Write-Host "✗ Package directory not found: $packageDir" -ForegroundColor Red
    exit 1
}

$tarball = Get-ChildItem -Path $packageDir -Filter "*.tgz" | Select-Object -First 1
if (-not $tarball) {
    Write-Host "✗ No tarball found in $packageDir" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Package tarball found: $($tarball.Name)" -ForegroundColor Green
Write-Host ""

# Step 3: Upload to S3 (optional - only if AWS CLI is configured)
Write-Host "Step 2: Uploading to S3..." -ForegroundColor Green
Write-Host ""

# Check if AWS CLI is available
$awsCli = Get-Command aws -ErrorAction SilentlyContinue
if (-not $awsCli) {
    Write-Host "⚠ AWS CLI not found. Skipping S3 upload." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To upload manually, run:" -ForegroundColor Yellow
    Write-Host "  aws s3 sync `"$packageDir`" `"s3://za.co.storefront7.resources/$S3Path/`" --acl public-read" -ForegroundColor Gray
    Write-Host ""
    exit 0
}

# Upload to S3
try {
    Write-Host "Uploading to s3://za.co.storefront7.resources/$S3Path/..." -ForegroundColor Yellow
    Write-Host "Using AWS profile: $AwsProfile" -ForegroundColor Gray
    
    $profileArg = if ($AwsProfile -ne "default") { "--profile $AwsProfile" } else { "" }
    
    if ($profileArg) {
        aws s3 sync "$packageDir" "s3://za.co.storefront7.resources/$S3Path/" `
            --profile $AwsProfile `
            --acl public-read `
            --content-type 'application/gzip' `
            --cache-control 'public, max-age=604800'
    } else {
        aws s3 sync "$packageDir" "s3://za.co.storefront7.resources/$S3Path/" `
            --acl public-read `
            --content-type 'application/gzip' `
            --cache-control 'public, max-age=604800'
    }
    
    if ($LASTEXITCODE -ne 0) {
        throw "S3 upload failed"
    }
    
    Write-Host ""
    Write-Host "✓ SDK uploaded to S3 successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Install via:" -ForegroundColor Cyan
    Write-Host "  npm install https://content.storefront7.co.za/$S3Path/$($tarball.Name)" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host "✗ S3 upload failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "  1. AWS CLI is configured (aws configure --profile $AwsProfile)" -ForegroundColor Yellow
    Write-Host "  2. You have permissions to write to the S3 bucket" -ForegroundColor Yellow
    Write-Host "  3. The bucket exists: za.co.storefront7.resources" -ForegroundColor Yellow
    Write-Host "  4. Use a different profile: .\scripts\test-build-and-upload.ps1 $Version $S3Path your-profile-name" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Test completed successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan

