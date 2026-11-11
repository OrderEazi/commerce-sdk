/**
 * Proves the generated Admin client round-trips against a REAL running API - not a mock: it sends a real
 * request with no admin key and checks the API rejects it with an auth error the client surfaces as an
 * axios error response. Skips with a clear message if the API is not reachable, rather than failing for an
 * unrelated reason.
 *
 * Run with: npx ts-node tests/smoke.test.ts (API_URL defaults to http://localhost:5135)
 */
import * as assert from 'assert';
import { Configuration, AppsDataTransferImportsApi } from '../src/index';

const API_URL = process.env.API_URL || 'http://localhost:5135';

async function isApiReachable(): Promise<boolean> {
	try {
		const response = await fetch(`${API_URL}/openapi/admin.json`);
		return response.ok;
	} catch {
		return false;
	}
}

async function testMissingKeyIsRejected() {
	const imports = new AppsDataTransferImportsApi(new Configuration({ basePath: API_URL }));

	try {
		await imports.listImports();
		throw new Error('Expected the call to reject - the request was not rejected at all');
	} catch (err: any) {
		if (!err.response) throw err;

		assert.ok([401, 403].includes(err.response.status), `expected 401 or 403 without an admin key, got ${err.response.status}`);
		console.log(`✓ a real Admin call without a key is rejected with ${err.response.status}`);
	}
}

(async () => {
	if (!(await isApiReachable())) {
		console.log(`⚠ API not reachable at ${API_URL} - skipping smoke test (not a failure, just nothing to test against)`);
		return;
	}

	await testMissingKeyIsRejected();
	console.log('\nSmoke test passed.');
})().catch((err) => {
	console.error('Smoke test failed:', err);
	process.exit(1);
});
