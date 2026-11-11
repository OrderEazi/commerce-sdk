# @ordereazi/commerce-admin-sdk

TypeScript client for the OrderEazi Commerce **Admin** API. Generated from `/openapi/admin.json`.

**Server-side only.** The Admin API takes an admin key (`sk_admin_...`), and refuses any request that
carries a browser `Origin` header. Never put the key in browser or mobile code. For a storefront use
[`@ordereazi/commerce-sdk`](../typescript/README.md), which is a different package with a different key.

```bash
npm install @ordereazi/commerce-admin-sdk
```

```typescript
import { Configuration, AppsDataTransferImportsApi } from '@ordereazi/commerce-admin-sdk';

const config = new Configuration({
  basePath: 'https://api.example.com',
  baseOptions: { headers: { 'X-Commerce-Key': process.env.COMMERCE_ADMIN_KEY! } }
});

const imports = new AppsDataTransferImportsApi(config);
const results = await imports.getImportResults(importId); // counts plus issues by row, column, value and rule
```

One class per API area, named from the OpenAPI tags, plus the shared `Configuration`. For automatic 429
retry use `createRetryingAxios` - see [RETRY_POLICY.md](../RETRY_POLICY.md).

## Build

```bash
npm install
npm run generate   # needs Node and a JRE; API_URL defaults to http://localhost:5135
npm run build      # copies ../typescript/src/retry.ts, then tsc
npm test           # skips when no API is reachable at API_URL
```

`src/generated/` and `src/retry.ts` are build output and are not committed.
