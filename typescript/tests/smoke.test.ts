/**
 * Proves the generated client actually round-trips against a REAL running Storefront.Api instance - not a
 * mock. Requires Storefront.Api running at API_URL (dev default http://localhost:5135); skips with a clear
 * message if it isn't reachable, rather than failing CI for an unrelated reason.
 *
 * We can't exercise a full authenticated business flow here (no seeded Store Access Key/tenant database is
 * available in every environment this runs in), so this proves what's reliably true everywhere instead: the
 * generated client sends a real HTTP request, the real API rejects it with the documented RFC 9457 shape,
 * and axios/the generated types deserialize that shape correctly. See CartController.GetCart's real 401
 * response for the exact contract being verified.
 *
 * Run with: npx ts-node tests/smoke.test.ts
 */
import * as assert from 'assert';
import { Configuration, CartApi } from '../src/index';

const API_URL = process.env.API_URL || 'http://localhost:5135';

async function isApiReachable(): Promise<boolean> {
	try {
		const response = await fetch(`${API_URL}/openapi/store.json`);
		return response.ok;
	} catch {
		return false;
	}
}

async function testMissingKeyReturnsTypedProblemDetails() {
	const config = new Configuration({ basePath: API_URL });
	const cartApi = new CartApi(config);

	try {
		await cartApi.cartGetCartApi();
		throw new Error('Expected cartGetCartApi() to reject with a 401 - the request was not rejected at all');
	} catch (err: any) {
		if (!err.response) throw err; // rethrow the "did not reject" error above, or a genuine network error

		assert.strictEqual(err.response.status, 401, `expected 401, got ${err.response.status}`);

		const body = err.response.data;
		assert.strictEqual(typeof body.type, 'string', 'problem details "type" should be a string');
		assert.strictEqual(typeof body.title, 'string', 'problem details "title" should be a string');
		assert.strictEqual(body.status, 401, 'problem details "status" should echo the HTTP status');
		assert.strictEqual(body.code, 'store_key_missing', `expected code "store_key_missing", got "${body.code}"`);
		assert.strictEqual(typeof body.detail, 'string', 'problem details "detail" should be a string');
		assert.strictEqual(typeof body.traceId, 'string', 'problem details "traceId" should be a string');

		console.log('✓ a real call through the generated client, against a real running API, returns the documented typed error shape');
	}
}

(async () => {
	if (!(await isApiReachable())) {
		console.log(`⚠ Storefront.Api not reachable at ${API_URL} - skipping smoke test (this is not a failure, just nothing to test against)`);
		return;
	}

	await testMissingKeyReturnsTypedProblemDetails();
	console.log('\nSmoke test passed.');
})().catch((err) => {
	console.error('Smoke test failed:', err);
	process.exit(1);
});
