# SDK Generation Guide

This guide explains how to generate the TypeScript SDK from Storefront.Api's OpenAPI specification.

## Prerequisites

1. `Storefront.Api` must be running (`dotnet run --project src/Presentation/Storefront.Api`) - dev default is `http://localhost:5135`
2. Node.js and npm installed
3. One of the following tools:
   - `@openapitools/openapi-generator-cli` (recommended)
   - `nswag`

## Quick Start

### Step 1: Install Dependencies

```bash
cd src/Tools/Storefront.Sdk/TypeScript
npm install
```

### Step 2: Start Storefront.Api

```bash
dotnet run --project src/Presentation/Storefront.Api
```

Make sure it's reachable at `http://localhost:5135` (or set `API_URL` in the scripts/env to wherever it's running).

### Step 3: Generate the SDK

#### Option A: Using openapi-generator-cli (Recommended)

```bash
# Install globally (optional)
npm install -g @openapitools/openapi-generator-cli

# Generate SDK - uses the "store" OpenAPI document, the one relevant to 3rd-party/customer-facing integrations
npx @openapitools/openapi-generator-cli generate \
  -i http://localhost:5135/openapi/store.json \
  -g typescript-axios \
  -o src/generated/client \
  --additional-properties=supportsES6=true,withInterfaces=true,typescriptThreePlus=true,npmName=@ordereazi/commerce-sdk,npmVersion=1.0.0
```

#### Option B: Using NSwag

```bash
# Install globally (optional)
npm install -g nswag

# Generate SDK
npx nswag swagger2tsclient \
  /input:http://localhost:5135/openapi/store.json \
  /output:src/generated/client.ts \
  /namespace:StorefrontHeadlessApi \
  /className:StorefrontHeadlessApiClient \
  /template:Fetch \
  /generateClientClasses:true \
  /generateClientInterfaces:true
```

#### Option C: Using the provided script

```bash
npm run generate
# or
bash scripts/generate-client.sh
```

### Step 4: Build

`src/index.ts` already re-exports `./generated/client` (see src/index.ts) - once generation has produced
files there, just build:

```bash
npm run build
```

## Using the Generated SDK

The generator produces a shared `Configuration` object plus one `XxxApi` class per resource (named from the
API's OpenAPI tags) - not a single unified client class:

```typescript
import { Configuration, CartApi } from '@ordereazi/commerce-sdk';

const config = new Configuration({
  basePath: 'http://localhost:5135',
  baseOptions: { headers: { 'X-Commerce-Key': 'pk_store_...' } }
});

const cartApi = new CartApi(config);
const cart = await cartApi.cartGetCartApi();
```

## Customization

### Custom Base URL

Set the `API_URL` environment variable:

```bash
API_URL=https://api.example.com npm run generate
```

### Custom OpenAPI Document

Storefront.Api serves four documents - `admin`, `store`, `callback`, `unversioned`. Third-party SDKs should
generate from `store` (the default). Override with `OPENAPI_DOC`:

```bash
OPENAPI_DOC=store API_URL=https://api.example.com bash scripts/generate-client.sh
```

### Custom Output Directory

Modify the `-o` parameter in the generation command to specify a different output directory.

## Troubleshooting

### API Not Running

If you get connection errors, make sure:
1. Storefront.Api is running (`dotnet run --project src/Presentation/Storefront.Api`)
2. The port is correct (dev default: 5135)
3. CORS is enabled (handled by `HeadlessCorsMiddleware` in Storefront.Api)

### Generation Errors

- Make sure you have the latest version of the generator tool
- Check that the OpenAPI spec is valid by visiting `/openapi/store.json` in your browser
- Try regenerating with verbose output

### Type Errors

After generation, you may need to:
1. Run `npm install` to install any new dependencies
2. Run `npm run build` to compile TypeScript

### `TS2527` on `common.ts`'s `createRequestFunction`

`axios` versions have shipped an internal `unique symbol` used to brand `AxiosResponse` (see
`node_modules/axios/index.d.ts`). Because the generated `common.ts` doesn't put an explicit return type on
`createRequestFunction`, TypeScript has to write out its full inferred type for the `.d.ts` output - and once
that type structurally touches axios's private symbol, `tsc` refuses with "inferred type ... references an
inaccessible unique symbol type". This is why `package.json` pins `axios` to an exact known-good version
(`1.7.9`) instead of a `^` range - a routine `npm install` pulling a newer axios patch can reintroduce this
build break with no code change on our side. If it recurs, either re-pin to another axios version confirmed
not to hit this, or add an explicit return type annotation as a `postProcessFile` hook.
3. Check that all imports are correct
