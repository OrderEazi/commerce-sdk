/**
 * OrderEazi Commerce Admin API TypeScript SDK
 *
 * Generated from the Admin OpenAPI document (/openapi/admin.json) with openapi-generator's typescript-axios
 * template - not hand-maintained. Do not edit src/generated/; regenerate it (npm run generate).
 *
 * SERVER-SIDE ONLY. The Admin API takes an admin key (sk_admin_...) that must never reach a browser, and it
 * refuses any request that carries a browser Origin header. For storefront code use @ordereazi/commerce-sdk.
 *
 * @example
 * ```typescript
 * import { Configuration, AppsDataTransferImportsApi } from '@ordereazi/commerce-admin-sdk';
 *
 * const config = new Configuration({
 *   basePath: 'https://api.example.com',
 *   baseOptions: { headers: { 'X-Commerce-Key': process.env.COMMERCE_ADMIN_KEY! } }
 * });
 * const imports = new AppsDataTransferImportsApi(config);
 * ```
 *
 * For automatic 429 retry/backoff, see `createRetryingAxios` (retry.ts, copied from the Store package at
 * build time) and ../../RETRY_POLICY.md.
 */
export * from './generated/client';
export { createRetryingAxios, type RetryOptions } from './retry';
