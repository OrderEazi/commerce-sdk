const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration - points at a running Storefront.Api instance. Dev default matches
// src/Presentation/Storefront.Api/Properties/launchSettings.json's http profile.
const API_URL = process.env.API_URL || 'http://localhost:5135';
const OPENAPI_DOC = process.env.OPENAPI_DOC || 'store';
const OPENAPI_SPEC_URL = `${API_URL}/openapi/${OPENAPI_DOC}.json`;
const OUTPUT_DIR = path.join(__dirname, '../src/generated');

console.log('Generating TypeScript SDK from OpenAPI spec...');
console.log(`Fetching OpenAPI spec from: ${OPENAPI_SPEC_URL}`);

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Fetch OpenAPI spec
const protocol = OPENAPI_SPEC_URL.startsWith('https') ? https : http;

protocol.get(OPENAPI_SPEC_URL, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const spec = JSON.parse(data);

      // Save the spec for reference
      fs.writeFileSync(
        path.join(OUTPUT_DIR, 'openapi-spec.json'),
        JSON.stringify(spec, null, 2)
      );

      console.log('✓ OpenAPI spec fetched successfully');
      console.log('✓ Saved to src/generated/openapi-spec.json');
      console.log('\nNote: To generate TypeScript client code, use one of:');
      console.log('  - openapi-generator-cli: npx @openapitools/openapi-generator-cli generate -i src/generated/openapi-spec.json -g typescript-axios -o src/generated/client --additional-properties=npmName=@ordereazi/commerce-sdk');
      console.log('  - NSwag: npx nswag swagger2tsclient /input:src/generated/openapi-spec.json /output:src/generated/client.ts /namespace:StorefrontHeadlessApi /className:StorefrontHeadlessApiClient');
      console.log('  - Or use the generate-client.sh script');
    } catch (error) {
      console.error('Error parsing OpenAPI spec:', error);
      process.exit(1);
    }
  });
}).on('error', (error) => {
  console.error('Error fetching OpenAPI spec:', error.message);
  console.error('\nMake sure Storefront.Api is running at', API_URL);
  console.error('(dotnet run --project src/Presentation/Storefront.Api)');
  process.exit(1);
});
