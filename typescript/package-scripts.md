# SDK Generation Scripts

## Option 1: Using openapi-generator-cli (Recommended)

```bash
# Install globally
npm install -g @openapitools/openapi-generator-cli

# Or use npx
npx @openapitools/openapi-generator-cli generate \
  -i src/generated/openapi-spec.json \
  -g typescript-axios \
  -o src/generated/client \
  --additional-properties=supportsES6=true,withInterfaces=true,typescriptThreePlus=true
```

## Option 2: Using NSwag

```bash
# Install globally
npm install -g nswag

# Or use npx
npx nswag swagger2tsclient \
  /input:src/generated/openapi-spec.json \
  /output:src/generated/client.ts \
  /namespace:StorefrontHeadlessApi \
  /className:StorefrontHeadlessApiClient
```

## Option 3: Using the provided script

```bash
# Make sure Storefront.Api is running:
#   dotnet run --project src/Presentation/Storefront.Api
# Then run:
bash scripts/generate-client.sh

# Or with a custom API URL:
API_URL=http://localhost:5135 bash scripts/generate-client.sh
```

## Manual Steps

1. Start Storefront.Api: `dotnet run --project src/Presentation/Storefront.Api` (dev default: `http://localhost:5135`)
2. Fetch the OpenAPI spec (the "store" document - the one relevant to 3rd-party/customer-facing integrations):
   ```bash
   curl http://localhost:5135/openapi/store.json -o src/generated/openapi-spec.json
   ```
3. Generate the client using one of the tools above
4. Build the SDK:
   ```bash
   npm run build
   ```

