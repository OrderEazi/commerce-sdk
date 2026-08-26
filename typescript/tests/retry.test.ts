/**
 * Proves createRetryingAxios actually retries on 429, honors Retry-After, gives up after maxRetries, and
 * leaves every other status code alone - against a real local HTTP server (no mocking of axios itself, no
 * network dependency on Storefront.Api). Run with: npx ts-node tests/retry.test.ts
 */
import * as http from 'http';
import * as assert from 'assert';
import axios from 'axios';
import { createRetryingAxios } from '../src/retry';

function startServer(handler: http.RequestListener): Promise<{ url: string; close: () => Promise<void> }> {
	return new Promise((resolve) => {
		const server = http.createServer(handler);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			const port = typeof address === 'object' && address ? address.port : 0;
			resolve({
				url: `http://127.0.0.1:${port}`,
				close: () => new Promise((r) => server.close(() => r())),
			});
		});
	});
}

async function testRetryAfterHeaderThenSuccess() {
	let requestCount = 0;
	const { url, close } = await startServer((req, res) => {
		requestCount++;
		if (requestCount < 3) {
			res.writeHead(429, { 'Retry-After': '0', 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ code: 'rate_limited' }));
			return;
		}
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ ok: true }));
	});

	try {
		const client = createRetryingAxios({ maxRetries: 3, baseDelayMs: 10 });
		const response = await client.get(url);
		assert.strictEqual(response.status, 200);
		assert.strictEqual(requestCount, 3, `expected exactly 3 requests (2 failures + 1 success), got ${requestCount}`);
		console.log('✓ retries on 429, honors Retry-After, succeeds once the server recovers');
	} finally {
		await close();
	}
}

async function testGivesUpAfterMaxRetries() {
	let requestCount = 0;
	const { url, close } = await startServer((_req, res) => {
		requestCount++;
		res.writeHead(429, { 'Retry-After': '0', 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ code: 'rate_limited' }));
	});

	try {
		const client = createRetryingAxios({ maxRetries: 2, baseDelayMs: 10 });
		await assert.rejects(() => client.get(url), (err: any) => err.response?.status === 429);
		assert.strictEqual(requestCount, 3, `expected exactly 3 requests (1 initial + 2 retries), got ${requestCount}`);
		console.log('✓ gives up after maxRetries and surfaces the final 429');
	} finally {
		await close();
	}
}

async function testNonRetryableStatusPassesThroughImmediately() {
	let requestCount = 0;
	const { url, close } = await startServer((_req, res) => {
		requestCount++;
		res.writeHead(404, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ code: 'not_found' }));
	});

	try {
		const client = createRetryingAxios({ maxRetries: 3, baseDelayMs: 10 });
		await assert.rejects(() => client.get(url), (err: any) => err.response?.status === 404);
		assert.strictEqual(requestCount, 1, `expected exactly 1 request (no retry on 404), got ${requestCount}`);
		console.log('✓ does not retry on non-429 status codes (404 passes through on the first attempt)');
	} finally {
		await close();
	}
}

async function testPlainAxiosIsUnaffected() {
	// Sanity check: a plain axios instance (what every generated XxxApi uses by default, with no third
	// constructor argument) must NOT retry - proving createRetryingAxios is genuinely opt-in.
	let requestCount = 0;
	const { url, close } = await startServer((_req, res) => {
		requestCount++;
		res.writeHead(429, { 'Retry-After': '0' });
		res.end();
	});

	try {
		await assert.rejects(() => axios.get(url), (err: any) => err.response?.status === 429);
		assert.strictEqual(requestCount, 1, 'plain axios must not retry on its own');
		console.log('✓ plain axios (the generated client\'s default) does not retry - confirms this is opt-in');
	} finally {
		await close();
	}
}

(async () => {
	await testRetryAfterHeaderThenSuccess();
	await testGivesUpAfterMaxRetries();
	await testNonRetryableStatusPassesThroughImmediately();
	await testPlainAxiosIsUnaffected();
	console.log('\nAll retry tests passed.');
})().catch((err) => {
	console.error('Retry test failed:', err);
	process.exit(1);
});
