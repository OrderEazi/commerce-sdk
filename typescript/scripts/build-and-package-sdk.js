#!/usr/bin/env node
/**
 * Build and Package SDK Script
 * 
 * This script:
 * 1. Loads the OpenAPI spec from the committed file
 * 2. Generates TypeScript client code (optional)
 * 3. Builds the TypeScript SDK
 * 4. Creates an npm package tarball
 * 5. Prepares it for S3 upload
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

// Configuration
// Primary source is Storefront.Api's live OpenAPI document (API_URL + /openapi/{OPENAPI_DOC}.json) - always
// current, no stale committed file to fall out of sync. LOCAL_SPEC_PATH is an escape hatch for CI environments
// where the API genuinely can't be reached (falls back to a pre-fetched file if one exists there).
// The SDK itself is generic and works with any store URL (baseUrl is configurable when creating the client).
const API_URL = process.env.API_URL || 'http://localhost:5135';
const OPENAPI_DOC = process.env.OPENAPI_DOC || 'store';
const OPENAPI_SPEC_URL = `${API_URL}/openapi/${OPENAPI_DOC}.json`;
const LOCAL_SPEC_PATH = process.env.LOCAL_SPEC_PATH || path.join(__dirname, '../src/generated/openapi-spec.json');
const SDK_VERSION = process.env.SDK_VERSION || process.env.VERSION || '1.0.0';
const SFVERSION = process.env.SFVERSION || '';
const SDK_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(SDK_DIR, 'src/generated');
const DIST_DIR = path.join(SDK_DIR, 'dist');
const NPM_PACKAGE_NAME = '@ordereazi/commerce-sdk';

console.log('==========================================');
console.log('Building OrderEazi Commerce Headless API TypeScript SDK');
console.log('==========================================');
console.log(`OpenAPI spec path: ${LOCAL_SPEC_PATH}`);
console.log(`SDK Version: ${SDK_VERSION}`);
console.log(`Storefront Version: ${SFVERSION}`);
console.log(`SDK Directory: ${SDK_DIR}`);
console.log('==========================================\n');

// Helper function to run shell commands
function runCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      cwd: SDK_DIR,
      stdio: 'inherit',
      ...options
    });
    return result;
  } catch (error) {
    console.error(`Error running command: ${command}`);
    throw error;
  }
}

// Step 1: Install dependencies
console.log('Step 1: Installing dependencies...');
try {
  runCommand('npm ci');
  console.log('✓ Dependencies installed\n');
} catch (error) {
  console.log('⚠ npm ci failed, trying npm install...');
  runCommand('npm install');
  console.log('✓ Dependencies installed\n');
}

// Step 2: Fetch the OpenAPI spec from the running API (falls back to a local file if unreachable)
console.log('Step 2: Loading OpenAPI specification...');
console.log(`  Primary source: ${OPENAPI_SPEC_URL}`);

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function fetchLiveSpec() {
  return new Promise((resolve, reject) => {
    const protocol = OPENAPI_SPEC_URL.startsWith('https') ? https : http;
    protocol.get(OPENAPI_SPEC_URL, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Storefront.Api returned HTTP ${res.statusCode} for ${OPENAPI_SPEC_URL}`));
        res.resume();
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Failed to parse OpenAPI spec response: ${error.message}`));
        }
      });
    }).on('error', reject);
  });
}

function getOpenAPISpec() {
  return fetchLiveSpec()
    .then((spec) => {
      console.log(`✓ Fetched OpenAPI spec live from: ${OPENAPI_SPEC_URL}\n`);
      return spec;
    })
    .catch((liveError) => {
      console.log(`⚠ Could not fetch live spec (${liveError.message})`);

      const specPath = path.join(OUTPUT_DIR, 'openapi-spec.json');

      if (fs.existsSync(LOCAL_SPEC_PATH)) {
        console.log(`  Falling back to local file: ${LOCAL_SPEC_PATH}\n`);
        return JSON.parse(fs.readFileSync(LOCAL_SPEC_PATH, 'utf8'));
      }

      if (fs.existsSync(specPath)) {
        console.log(`  Falling back to existing file: ${specPath}\n`);
        return JSON.parse(fs.readFileSync(specPath, 'utf8'));
      }

      throw new Error(
        `Could not reach Storefront.Api at ${API_URL} and no fallback spec file found.\n` +
        `Either start Storefront.Api (dotnet run --project src/Presentation/Storefront.Api) or set ` +
        `LOCAL_SPEC_PATH to a pre-fetched openapi-spec.json.`
      );
    });
}

// Main execution
(async () => {
  let spec;
  try {
    spec = await getOpenAPISpec();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'openapi-spec.json'), JSON.stringify(spec, null, 2));
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }

  // Step 3: Generate TypeScript client (optional - only if openapi-generator is available)
  console.log('Step 3: Generating TypeScript client code...');
  try {
    runCommand(
      `npx --yes @openapitools/openapi-generator-cli generate ` +
      `-i ${path.join(OUTPUT_DIR, 'openapi-spec.json')} ` +
      `-g typescript-axios ` +
      `-o ${path.join(OUTPUT_DIR, 'client')} ` +
      `--additional-properties=supportsES6=true,withInterfaces=true,typescriptThreePlus=true,npmName=${NPM_PACKAGE_NAME},npmVersion=${SDK_VERSION} ` +
      `--skip-validate-spec`,
      { stdio: 'pipe' }
    );
    console.log('✓ TypeScript client generated\n');
  } catch (error) {
    console.log('⚠ OpenAPI generator not available or failed, using existing client code\n');
  }

  // Step 4: Update package.json version
  console.log('Step 4: Updating package.json version...');
  try {
    const packageJsonPath = path.join(SDK_DIR, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    packageJson.version = SDK_VERSION;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`✓ Package version set to ${SDK_VERSION}\n`);
  } catch (error) {
    console.error(`ERROR: Failed to update package.json: ${error.message}`);
    process.exit(1);
  }

  // Step 5: Build TypeScript
  console.log('Step 5: Building TypeScript...');
  try {
    runCommand('npm run build');
    
    if (!fs.existsSync(DIST_DIR) || fs.readdirSync(DIST_DIR).length === 0) {
      throw new Error('Build failed - dist directory is empty or doesn\'t exist');
    }
    console.log('✓ TypeScript build completed\n');
  } catch (error) {
    console.error(`ERROR: Build failed: ${error.message}`);
    process.exit(1);
  }

  // Step 6: Create npm package tarball
  console.log('Step 6: Creating npm package tarball...');
  try {
    runCommand('npm pack --pack-destination ./dist');
    
    // Find the generated tarball
    const files = fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.tgz'));
    if (files.length === 0) {
      throw new Error('Failed to create npm package tarball');
    }
    
    // Get the most recent tarball
    const tarball = files.sort().reverse()[0];
    const tarballPath = path.join(DIST_DIR, tarball);
    console.log(`✓ Package tarball created: ${tarball}\n`);
    
    // Step 7: Prepare for S3 upload
    console.log('Step 7: Preparing package for S3 upload...');
    const packageDir = path.join(DIST_DIR, 'package');
    if (!fs.existsSync(packageDir)) {
      fs.mkdirSync(packageDir, { recursive: true });
    }
    
    // Copy the tarball to the package directory
    fs.copyFileSync(tarballPath, path.join(packageDir, tarball));
    
    // Also create a latest copy for easier access
    const latestTarball = 'ordereazi-commerce-sdk-latest.tgz';
    fs.copyFileSync(tarballPath, path.join(packageDir, latestTarball));

    // Create installation instructions JSON
    const installInfo = {
      name: NPM_PACKAGE_NAME,
      version: SDK_VERSION,
      installation: {
        fromS3: `https://content.storefront7.co.za/${SFVERSION}/sdk/${tarball}`,
        fromS3Latest: `https://content.storefront7.co.za/${SFVERSION}/sdk/${latestTarball}`,
        version: SDK_VERSION,
        storefrontVersion: SFVERSION
      }
    };
    
    fs.writeFileSync(
      path.join(packageDir, 'install.json'),
      JSON.stringify(installInfo, null, 2)
    );
    
    console.log('✓ Package prepared for S3 upload\n');
    
    console.log('==========================================');
    console.log('Build completed successfully!');
    console.log('==========================================');
    console.log(`Package tarball: ${tarball}`);
    console.log(`Package directory: ${packageDir}`);
    console.log('');
    console.log('To upload to S3, run:');
    console.log(`  aws s3 sync ${packageDir} s3://za.co.storefront7.resources/${SFVERSION}/sdk/ --acl public-read`);
    console.log('==========================================');
    
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }
})();

