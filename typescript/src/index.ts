/**
 * OrderEazi Commerce Headless API TypeScript SDK
 *
 * Auto-generated from Storefront.Api's OpenAPI specification via openapi-generator's typescript-axios
 * template - this is NOT hand-maintained. Re-run generation (see GENERATION.md) against a running
 * Storefront.Api instance to refresh it after the API changes; do not hand-edit files under
 * src/generated/, they'll be overwritten on the next generation.
 *
 * Exports a shared `Configuration` plus one `XxxApi` class per resource (named from the API's OpenAPI
 * tags) - not a single unified client class.
 *
 * @example
 * ```typescript
 * import { Configuration, CartApi, CheckoutApi } from '@ordereazi/commerce-sdk';
 *
 * const config = new Configuration({
 *   basePath: 'https://api.example.com',
 *   // Store Access Key (pk_store_.../sk_store_...) and/or JWT bearer token, per endpoint
 *   baseOptions: { headers: { 'X-Commerce-Key': 'pk_store_...' } }
 * });
 *
 * const cartApi = new CartApi(config);
 * const cart = await cartApi.cartGetCartApi();
 *
 * const checkoutApi = new CheckoutApi(config);
 * const paymentOptions = await checkoutApi.checkoutGetPaymentOptionsApi();
 * ```
 *
 * For automatic 429 retry/backoff, see `createRetryingAxios` (retry.ts) and ../../RETRY_POLICY.md.
 */
export * from './generated/client';
export { createRetryingAxios, type RetryOptions } from './retry';
